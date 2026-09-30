import { useEffect, useRef } from 'react';
import type { LeadRow } from '../lib/csv';
import {
  buildMailtoUrl,
  buildTelUrl,
  buildWhatsAppUrl,
  ensureHttpUrl,
} from '../lib/csv';
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadStatus,
} from '../lib/statuses';

type Props = {
  lead: LeadRow;
  onClose: () => void;
  onStatus: (status: LeadStatus) => void;
  onNotes: (notes: string) => void;
  onCopyRow: () => void;
  onCopyField: (value: string, label?: string) => void;
  onOpenLink: (url: string) => void;
  focusNotesToken: number;
};

const DETAIL_KEYS = [
  'Category',
  'Rating',
  'Review Count',
  'Address',
  'City',
  'Country',
  'Phone',
  'Email',
  'WhatsApp',
  'Website',
  'Google Maps URL',
  'Instagram',
  'Facebook',
  'Lead Score',
  'Website Score',
  'Contactability Score',
  'Source Search',
  'Discovered At',
] as const;

export function LeadDrawer({
  lead,
  onClose,
  onStatus,
  onNotes,
  onCopyRow,
  onCopyField,
  onOpenLink,
  focusNotesToken,
}: Props) {
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const name = lead.fields['Business Name'] || 'Untitled lead';

  useEffect(() => {
    if (focusNotesToken > 0) {
      notesRef.current?.focus();
    }
  }, [focusNotesToken]);

  const openIf = (url: string | null) => {
    if (url) onOpenLink(url);
  };

  return (
    <aside className="drawer" aria-label="Lead details">
      <div className="drawer-header">
        <div>
          <div className="drawer-title">{name}</div>
          <div className="drawer-meta">
            {lead.fields['Category'] || 'Business'}
            {lead.fields['City'] ? ` · ${lead.fields['City']}` : ''}
          </div>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
          Esc
        </button>
      </div>

      <div className="drawer-body">
        <div className="field-block">
          <div className="field-label">Status</div>
          <select
            value={lead.status}
            onChange={(e) => onStatus(e.target.value as LeadStatus)}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="field-block">
          <div className="field-label">Notes</div>
          <textarea
            ref={notesRef}
            value={lead.notes}
            onChange={(e) => onNotes(e.target.value)}
            placeholder="Call notes, next steps…"
          />
        </div>

        <div className="drawer-actions">
          <button type="button" className="btn btn-sm" onClick={onCopyRow}>
            Copy row
          </button>
          {lead.fields['Phone'] ? (
            <>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onCopyField(lead.fields['Phone'], 'phone')}
              >
                Copy phone
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => openIf(buildTelUrl(lead.fields['Phone']))}
              >
                Call
              </button>
            </>
          ) : null}
          {lead.fields['Email'] ? (
            <>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onCopyField(lead.fields['Email'], 'email')}
              >
                Copy email
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => openIf(buildMailtoUrl(lead.fields['Email']))}
              >
                Email
              </button>
            </>
          ) : null}
          {lead.fields['WhatsApp'] || lead.fields['Phone'] ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() =>
                openIf(
                  buildWhatsAppUrl(
                    lead.fields['WhatsApp'] || lead.fields['Phone'],
                  ),
                )
              }
            >
              WhatsApp
            </button>
          ) : null}
          {lead.fields['Website'] ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => openIf(ensureHttpUrl(lead.fields['Website']))}
            >
              Website
            </button>
          ) : null}
          {lead.fields['Google Maps URL'] ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => openIf(ensureHttpUrl(lead.fields['Google Maps URL']))}
            >
              Maps
            </button>
          ) : null}
        </div>

        <dl className="detail-grid">
          {DETAIL_KEYS.map((key) => {
            const val = lead.fields[key];
            if (!val) return null;
            return (
              <div className="detail-row" key={key}>
                <dt>{key}</dt>
                <dd>{val}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    </aside>
  );
}
