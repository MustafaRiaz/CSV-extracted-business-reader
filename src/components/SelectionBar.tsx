import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadStatus,
} from '../lib/statuses';

type Props = {
  selectedCount: number;
  onBulkStatus: (status: LeadStatus) => void;
  onDelete: () => void;
  onCopyPhones: () => void;
  onCopyEmails: () => void;
  onCopyWebsites: () => void;
  onClearSelection: () => void;
};

export function SelectionBar({
  selectedCount,
  onBulkStatus,
  onDelete,
  onCopyPhones,
  onCopyEmails,
  onCopyWebsites,
  onClearSelection,
}: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="selection-bar" role="toolbar" aria-label="Bulk actions">
      <span className="selection-count">
        <strong>{selectedCount}</strong> selected
      </span>

      <select
        className="filter-select"
        value=""
        onChange={(e) => {
          if (e.target.value) {
            onBulkStatus(e.target.value as LeadStatus);
            e.target.value = '';
          }
        }}
        aria-label="Set status for selected"
      >
        <option value="">Set status…</option>
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {LEAD_STATUS_LABELS[s]}
          </option>
        ))}
      </select>

      <button type="button" className="btn btn-sm" onClick={onCopyPhones}>
        Copy phones
      </button>
      <button type="button" className="btn btn-sm" onClick={onCopyEmails}>
        Copy emails
      </button>
      <button type="button" className="btn btn-sm" onClick={onCopyWebsites}>
        Copy websites
      </button>

      <button type="button" className="btn btn-sm btn-danger" onClick={onDelete}>
        Delete
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={onClearSelection}>
        Clear
      </button>
    </div>
  );
}
