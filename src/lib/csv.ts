import Papa from 'papaparse';
import type { LeadStatus } from './statuses';
import { normalizeStatus } from './statuses';

export type LeadRow = {
  id: string;
  /** Original CSV field values keyed by header */
  fields: Record<string, string>;
  status: LeadStatus;
  notes: string;
};

export const PREFERRED_COLUMN_ORDER = [
  'Business Name',
  'Status',
  'Phone',
  'Email',
  'WhatsApp',
  'Website',
  'Google Maps URL',
  'Lead Score',
  'Rating',
  'Review Count',
  'Category',
  'Address',
  'City',
  'Country',
  'Instagram',
  'Facebook',
  'Website Score',
  'Contactability Score',
  'Notes',
  'Source Search',
  'Discovered At',
];

export const LINK_COLUMNS = new Set([
  'Phone',
  'Email',
  'Website',
  'Google Maps URL',
  'Instagram',
  'Facebook',
  'WhatsApp',
]);

function rowKey(fields: Record<string, string>, index: number): string {
  // Stable key (avoid Maps URL — encoding can change on rewrite and break sidecar match)
  const name = (fields['Business Name'] ?? '').trim().toLowerCase();
  const phone = (fields['Phone'] ?? '').replace(/\D/g, '');
  const email = (fields['Email'] ?? '').trim().toLowerCase();
  if (name || phone || email) {
    return `${name}|${phone}|${email}`;
  }
  return `row_${index}`;
}

export function parseCsv(content: string): { headers: string[]; leads: LeadRow[] } {
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const headers =
    parsed.meta.fields?.filter((h) => h && h.trim().length > 0) ?? [];

  const leads: LeadRow[] = parsed.data.map((row, index) => {
    const fields: Record<string, string> = {};
    for (const h of headers) {
      fields[h] = row[h] != null ? String(row[h]) : '';
    }
    return {
      id: rowKey(fields, index),
      fields,
      status: normalizeStatus(fields['Status']),
      notes: fields['Notes'] ?? '',
    };
  });

  return { headers, leads };
}

export function orderHeaders(headers: string[]): string[] {
  const preferred = PREFERRED_COLUMN_ORDER.filter((h) => headers.includes(h));
  const rest = headers.filter((h) => !preferred.includes(h));
  return [...preferred, ...rest];
}

export function leadsToCsv(headers: string[], leads: LeadRow[]): string {
  const cols = [...headers];
  if (!cols.includes('Status')) cols.push('Status');
  if (!cols.includes('Notes')) cols.push('Notes');

  const data = leads.map((lead) => {
    const row: Record<string, string> = {};
    for (const c of cols) {
      if (c === 'Status') row[c] = lead.status;
      else if (c === 'Notes') row[c] = lead.notes;
      else row[c] = lead.fields[c] ?? '';
    }
    return row;
  });

  return Papa.unparse(data, { columns: cols, newline: '\r\n' });
}

export function leadToTsv(headers: string[], lead: LeadRow): string {
  const values = headers.map((h) => {
    if (h === 'Status') return lead.status;
    if (h === 'Notes') return lead.notes;
    return lead.fields[h] ?? '';
  });
  return `${headers.join('\t')}\n${values.map(escapeTsv).join('\t')}`;
}

function escapeTsv(v: string): string {
  if (v.includes('\t') || v.includes('\n') || v.includes('"')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export function buildTelUrl(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '');
  if (!digits) return null;
  return `tel:${digits}`;
}

export function buildMailtoUrl(email: string): string | null {
  const e = email.trim();
  if (!e || !e.includes('@')) return null;
  return `mailto:${e}`;
}

export function buildWhatsAppUrl(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  if (v.startsWith('whatsapp:')) return v;
  const digits = v.replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export function ensureHttpUrl(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.includes('.')) return `https://${u}`;
  return null;
}
