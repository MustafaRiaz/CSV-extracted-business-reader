import { LEAD_STATUS_LABELS, type LeadStatus } from '../lib/statuses';

type Props = {
  stats: Record<string, number>;
};

const ORDER: LeadStatus[] = [
  'new',
  'contacted',
  'replied',
  'meeting',
  'won',
  'not_interested',
  'do_not_contact',
];

export function StatsBar({ stats }: Props) {
  return (
    <div className="stats" aria-label="Lead stats">
      <span className="stat-chip">
        Total <strong>{stats.total ?? 0}</strong>
      </span>
      {ORDER.map((s) =>
        stats[s] ? (
          <span key={s} className="stat-chip">
            {LEAD_STATUS_LABELS[s]} <strong>{stats[s]}</strong>
          </span>
        ) : null,
      )}
    </div>
  );
}
