import { useEffect, useRef, useState } from 'react';

type Props = {
  headers: string[];
  hiddenColumns: string[];
  onToggle: (col: string) => void;
  onShowAll: () => void;
  onHideScores: () => void;
};

export function ColumnPicker({
  headers,
  hiddenColumns,
  onToggle,
  onShowAll,
  onHideScores,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="popover-wrap" ref={ref}>
      <button type="button" className="btn btn-sm" onClick={() => setOpen((v) => !v)}>
        Columns{hiddenColumns.length ? ` (${hiddenColumns.length} hidden)` : ''}
      </button>
      {open ? (
        <div className="popover" role="dialog" aria-label="Column visibility">
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button type="button" className="btn btn-sm" onClick={onShowAll}>
              Show all
            </button>
            <button type="button" className="btn btn-sm" onClick={onHideScores}>
              Hide scores
            </button>
          </div>
          {headers.map((h) => (
            <label key={h}>
              <input
                type="checkbox"
                checked={!hiddenColumns.includes(h)}
                onChange={() => onToggle(h)}
              />
              {h}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
