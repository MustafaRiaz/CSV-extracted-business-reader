export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'replied'
  | 'meeting'
  | 'won'
  | 'not_interested'
  | 'do_not_contact';

export const LEAD_STATUSES: LeadStatus[] = [
  'new',
  'contacted',
  'replied',
  'meeting',
  'won',
  'not_interested',
  'do_not_contact',
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  replied: 'Replied',
  meeting: 'Meeting',
  won: 'Won',
  not_interested: 'Not Interested',
  do_not_contact: 'Do Not Contact',
};

/** Shortcut keys 1–7 map to these statuses */
export const STATUS_SHORTCUTS: Record<string, LeadStatus> = {
  '1': 'new',
  '2': 'contacted',
  '3': 'replied',
  '4': 'meeting',
  '5': 'won',
  '6': 'not_interested',
  '7': 'do_not_contact',
};

export const DONE_STATUSES: LeadStatus[] = [
  'won',
  'not_interested',
  'do_not_contact',
];

export function normalizeStatus(raw: string | undefined | null): LeadStatus {
  if (!raw) return 'new';
  const v = raw.trim().toLowerCase().replace(/\s+/g, '_');
  if (v === 'reached' || v === 'completed_contact') return 'contacted';
  if (v === 'completed' || v === 'done' || v === 'closed') return 'won';
  if ((LEAD_STATUSES as string[]).includes(v)) return v as LeadStatus;
  return 'new';
}

export function isLeadStatus(v: string): v is LeadStatus {
  return (LEAD_STATUSES as string[]).includes(v);
}
