import type { LeadRow } from '../lib/csv';
import {
  buildMailtoUrl,
  buildTelUrl,
  buildWhatsAppUrl,
  ensureHttpUrl,
  LINK_COLUMNS,
} from '../lib/csv';
import { LEAD_STATUS_LABELS } from '../lib/statuses';

const COPYABLE_COLUMNS = new Set(['Phone', 'Website']);

type Props = {
  leads: LeadRow[];
  headers: string[];
  selectedIds: Set<string>;
  activeId: string | null;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onRowClick: (id: string) => void;
  onOpenDetails: (id: string) => void;
  onOpenLink: (url: string) => void;
  onCopyField: (value: string, label?: string) => void;
  onMarkContacted: (id: string) => void;
};

function CopyBtn({
  value,
  label,
  onCopy,
  onSelect,
}: {
  value: string;
  label: string;
  onCopy: (value: string, label?: string) => void;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="cell-copy"
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
        onCopy(value, label);
      }}
    >
      Copy
    </button>
  );
}

function CellValue({
  header,
  lead,
  onOpenLink,
  onCopyField,
  onSelect,
}: {
  header: string;
  lead: LeadRow;
  onOpenLink: (url: string) => void;
  onCopyField: (value: string, label?: string) => void;
  onSelect: () => void;
}) {
  if (header === 'Status') {
    return (
      <span className={`status-badge ${lead.status}`}>
        {LEAD_STATUS_LABELS[lead.status]}
      </span>
    );
  }
  if (header === 'Notes') {
    return <span title={lead.notes}>{lead.notes || '—'}</span>;
  }

  const raw = lead.fields[header] ?? '';
  if (!raw) return <span style={{ color: 'var(--text-faint)' }}>—</span>;

  if (
    header === 'Lead Score' ||
    header === 'Website Score' ||
    header === 'Contactability Score' ||
    header === 'Rating' ||
    header === 'Review Count'
  ) {
    return <span className="mono">{raw}</span>;
  }

  if (LINK_COLUMNS.has(header)) {
    let url: string | null = null;
    if (header === 'Phone') url = buildTelUrl(raw);
    else if (header === 'Email') url = buildMailtoUrl(raw);
    else if (header === 'WhatsApp') url = buildWhatsAppUrl(raw);
    else url = ensureHttpUrl(raw);

    const copyable = COPYABLE_COLUMNS.has(header);

    if (url || copyable) {
      return (
        <span className="cell-with-copy">
          {url ? (
            <button
              type="button"
              className="cell-link"
              title={raw}
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
                onOpenLink(url!);
              }}
            >
              {raw}
            </button>
          ) : (
            <span title={raw}>{raw}</span>
          )}
          {copyable ? (
            <CopyBtn
              value={raw}
              label={header.toLowerCase()}
              onCopy={onCopyField}
              onSelect={onSelect}
            />
          ) : null}
        </span>
      );
    }
  }

  return <span title={raw}>{raw}</span>;
}

export function LeadTable({
  leads,
  headers,
  selectedIds,
  activeId,
  onToggleSelect,
  onSelectAll,
  onRowClick,
  onOpenDetails,
  onOpenLink,
  onCopyField,
  onMarkContacted,
}: Props) {
  const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));

  return (
    <div className="table-scroll">
      <table className="leads">
        <thead>
          <tr>
            <th className="col-check">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                aria-label="Select all visible"
              />
            </th>
            <th className="col-action">Action</th>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const selected = selectedIds.has(lead.id);
            const active = activeId === lead.id;
            const isContacted = lead.status === 'contacted';
            return (
              <tr
                key={lead.id}
                className={[
                  selected ? 'selected' : '',
                  active ? 'active' : '',
                  `status-${lead.status}`,
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onRowClick(lead.id)}
              >
                <td className="col-check" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleSelect(lead.id)}
                    aria-label={`Select ${lead.fields['Business Name']}`}
                  />
                </td>
                <td className="col-action" onClick={(e) => e.stopPropagation()}>
                  <div className="row-actions">
                    <button
                      type="button"
                      className={`btn-contacted${isContacted ? ' is-done' : ''}`}
                      title={
                        isContacted
                          ? 'Already marked contacted'
                          : 'Mark as contacted'
                      }
                      onClick={() => {
                        onRowClick(lead.id);
                        onMarkContacted(lead.id);
                      }}
                    >
                      {isContacted ? 'Contacted ✓' : 'Contacted'}
                    </button>
                    <button
                      type="button"
                      className="btn-details"
                      title="Open sidebar details"
                      onClick={() => onOpenDetails(lead.id)}
                    >
                      Details
                    </button>
                  </div>
                </td>
                {headers.map((h) => (
                  <td key={h}>
                    <CellValue
                      header={h}
                      lead={lead}
                      onOpenLink={onOpenLink}
                      onCopyField={onCopyField}
                      onSelect={() => onRowClick(lead.id)}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
          {!leads.length ? (
            <tr>
              <td
                colSpan={headers.length + 2}
                style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}
              >
                No leads match the current filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
