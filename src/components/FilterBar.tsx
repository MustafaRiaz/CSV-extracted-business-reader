import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadStatus,
} from '../lib/statuses';
import type { Filters } from '../store/leadsStore';

type Props = {
  filters: Filters;
  cities: string[];
  onChange: (partial: Partial<Filters>) => void;
  hideDone: boolean;
  onHideDone: (v: boolean) => void;
  openSidebarOnClick: boolean;
  onOpenSidebarOnClick: (v: boolean) => void;
};

export function FilterBar({
  filters,
  cities,
  onChange,
  hideDone,
  onHideDone,
  openSidebarOnClick,
  onOpenSidebarOnClick,
}: Props) {
  const toggleStatus = (s: LeadStatus) => {
    const set = new Set(filters.statuses);
    if (set.has(s)) set.delete(s);
    else set.add(s);
    onChange({ statuses: [...set] });
  };

  return (
    <div className="filter-row">
      <div className="status-filters">
        {LEAD_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={`status-filter-btn${filters.statuses.includes(s) ? ' on' : ''}`}
            onClick={() => toggleStatus(s)}
          >
            {LEAD_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <select
        className="filter-select"
        value={filters.city}
        onChange={(e) => onChange({ city: e.target.value })}
        aria-label="Filter by city"
      >
        <option value="">All cities</option>
        {cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <input
        className="filter-input"
        type="number"
        min={0}
        max={100}
        placeholder="Min score"
        value={filters.minScore || ''}
        onChange={(e) =>
          onChange({ minScore: e.target.value ? Number(e.target.value) : 0 })
        }
        style={{ width: 96 }}
      />

      <label className="filter-check">
        <input
          type="checkbox"
          checked={filters.hasPhone}
          onChange={(e) => onChange({ hasPhone: e.target.checked })}
        />
        Phone
      </label>
      <label className="filter-check">
        <input
          type="checkbox"
          checked={filters.hasEmail}
          onChange={(e) => onChange({ hasEmail: e.target.checked })}
        />
        Email
      </label>
      <label className="filter-check">
        <input
          type="checkbox"
          checked={filters.hasWebsite}
          onChange={(e) => onChange({ hasWebsite: e.target.checked })}
        />
        Website
      </label>
      <label className="filter-check">
        <input
          type="checkbox"
          checked={hideDone}
          onChange={(e) => onHideDone(e.target.checked)}
        />
        Hide done
      </label>
      <label className="filter-check">
        <input
          type="checkbox"
          checked={openSidebarOnClick}
          onChange={(e) => onOpenSidebarOnClick(e.target.checked)}
        />
        Open sidebar on click
      </label>
    </div>
  );
}
