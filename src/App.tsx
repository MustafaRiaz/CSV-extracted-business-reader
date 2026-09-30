import { useEffect, useMemo } from 'react';
import { ColumnPicker } from './components/ColumnPicker';
import { FilterBar } from './components/FilterBar';
import { LeadDrawer } from './components/LeadDrawer';
import { LeadTable } from './components/LeadTable';
import { SelectionBar } from './components/SelectionBar';
import { StatsBar } from './components/StatsBar';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useLeadsStore } from './store/leadsStore';

export default function App() {
  const filePath = useLeadsStore((s) => s.filePath);
  const headers = useLeadsStore((s) => s.headers);
  const leads = useLeadsStore((s) => s.leads);
  const hiddenColumns = useLeadsStore((s) => s.hiddenColumns);
  const hideDone = useLeadsStore((s) => s.hideDone);
  const openSidebarOnClick = useLeadsStore((s) => s.openSidebarOnClick);
  const filters = useLeadsStore((s) => s.filters);
  const selectedIds = useLeadsStore((s) => s.selectedIds);
  const activeId = useLeadsStore((s) => s.activeId);
  const drawerOpen = useLeadsStore((s) => s.drawerOpen);
  const recent = useLeadsStore((s) => s.recent);
  const saveStatus = useLeadsStore((s) => s.saveStatus);
  const toast = useLeadsStore((s) => s.toast);

  const openFile = useLeadsStore((s) => s.openFile);
  const openRecent = useLeadsStore((s) => s.openRecent);
  const loadRecent = useLeadsStore((s) => s.loadRecent);
  const exportCsv = useLeadsStore((s) => s.exportCsv);
  const setFilters = useLeadsStore((s) => s.setFilters);
  const setHideDone = useLeadsStore((s) => s.setHideDone);
  const setOpenSidebarOnClick = useLeadsStore((s) => s.setOpenSidebarOnClick);
  const toggleHiddenColumn = useLeadsStore((s) => s.toggleHiddenColumn);
  const setHiddenColumns = useLeadsStore((s) => s.setHiddenColumns);
  const toggleSelect = useLeadsStore((s) => s.toggleSelect);
  const selectAllFiltered = useLeadsStore((s) => s.selectAllFiltered);
  const clearSelection = useLeadsStore((s) => s.clearSelection);
  const setActive = useLeadsStore((s) => s.setActive);
  const openDrawerFor = useLeadsStore((s) => s.openDrawerFor);
  const setDrawerOpen = useLeadsStore((s) => s.setDrawerOpen);
  const setStatus = useLeadsStore((s) => s.setStatus);
  const setNotes = useLeadsStore((s) => s.setNotes);
  const bulkStatus = useLeadsStore((s) => s.bulkStatus);
  const deleteSelected = useLeadsStore((s) => s.deleteSelected);
  const copySelectedField = useLeadsStore((s) => s.copySelectedField);
  const copyActiveRow = useLeadsStore((s) => s.copyActiveRow);
  const copyField = useLeadsStore((s) => s.copyField);

  useEffect(() => {
    void loadRecent();
    if (!window.maplead) return;
    const offOpen = window.maplead.onMenuOpen(() => void openFile());
    const offExport = window.maplead.onMenuExport(() => void exportCsv());
    const offFlush = window.maplead.onFlushSave?.(() => {
      useLeadsStore.getState().flushPersistSync();
    });
    const onUnload = () => {
      useLeadsStore.getState().flushPersistSync();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      offOpen();
      offExport();
      offFlush?.();
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [loadRecent, openFile, exportCsv]);

  const visibleLeads = useMemo(
    () => useLeadsStore.getState().getVisibleLeads(),
    [leads, filters, hideDone],
  );
  const visibleHeaders = useMemo(
    () => headers.filter((h) => !hiddenColumns.includes(h)),
    [headers, hiddenColumns],
  );
  const stats = useMemo(() => useLeadsStore.getState().getStats(), [leads]);
  const visibleIds = useMemo(() => visibleLeads.map((l) => l.id), [visibleLeads]);
  const focusNotesToken = useKeyboardShortcuts(visibleIds);

  const activeLead = leads.find((l) => l.id === activeId) ?? null;

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) {
      const c = (l.fields['City'] ?? '').trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const openLink = (url: string) => {
    void window.maplead?.openExternal(url);
  };

  if (!filePath) {
    return (
      <div className="app">
        <div className="empty">
          <div className="brand-name" style={{ fontSize: 13, color: 'var(--accent)' }}>
            MapLead Workspace
          </div>
          <h1>Open a lead sheet</h1>
          <p>
            Load a MapLead Hunter CSV to filter, hide columns, update statuses, take
            notes, and work outreach without leaving your desk.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => void openFile()}>
            Open CSV
          </button>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            After marking contacted, wait for “Saved · N contacted”.
          </p>
          {recent.length ? (
            <div className="empty-recent">
              <div className="field-label" style={{ textAlign: 'left' }}>
                Recent
              </div>
              {recent.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="recent-btn"
                  onClick={() => void openRecent(p)}
                  title={p}
                >
                  {p}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-name">MapLead Workspace</div>
          <div className="brand-sub" title={filePath}>
            {filePath.split(/[/\\]/).pop()} · {visibleLeads.length}/{leads.length} shown
          </div>
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn" onClick={() => void openFile()}>
            Open
          </button>
          <button type="button" className="btn" onClick={() => void exportCsv()}>
            Export
          </button>
          <input
            className="search"
            placeholder="Search name, phone, notes…"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
          />
          <span
            className={`save-pill ${saveStatus === 'saved' ? 'saved' : ''} ${saveStatus === 'error' ? 'error' : ''}`}
          >
            {saveStatus === 'saving'
              ? 'Saving sheet…'
              : saveStatus === 'saved'
                ? 'Sheet saved'
                : saveStatus === 'error'
                  ? 'Save failed'
                  : 'Ready'}
          </span>
        </div>
      </header>

      <div className="toolbar">
        <ColumnPicker
          headers={headers}
          hiddenColumns={hiddenColumns}
          onToggle={toggleHiddenColumn}
          onShowAll={() => setHiddenColumns([])}
          onHideScores={() =>
            setHiddenColumns([
              ...new Set([
                ...hiddenColumns,
                'Website Score',
                'Contactability Score',
                'Discovered At',
                'Source Search',
                'Country',
              ]),
            ])
          }
        />
        <FilterBar
          filters={filters}
          cities={cities}
          onChange={setFilters}
          hideDone={hideDone}
          onHideDone={setHideDone}
          openSidebarOnClick={openSidebarOnClick}
          onOpenSidebarOnClick={setOpenSidebarOnClick}
        />
        <StatsBar stats={stats} />
      </div>

      <SelectionBar
        selectedCount={selectedIds.size}
        onBulkStatus={bulkStatus}
        onDelete={deleteSelected}
        onCopyPhones={() => void copySelectedField('Phone')}
        onCopyEmails={() => void copySelectedField('Email')}
        onCopyWebsites={() => void copySelectedField('Website')}
        onClearSelection={clearSelection}
      />

      <div className="shortcuts-hint">
        <span className="kbd">j</span>/<span className="kbd">k</span> navigate ·{' '}
        <span className="kbd">c</span> copy row · <span className="kbd">n</span> /{' '}
        <span className="kbd">d</span> open details ·{' '}
        <span className="kbd">1</span>–<span className="kbd">7</span> status ·{' '}
        <span className="kbd">Del</span> delete selected · <span className="kbd">Esc</span> close
      </div>

      <div className="main">
        <div className="table-panel">
          <LeadTable
            leads={visibleLeads}
            headers={visibleHeaders}
            selectedIds={selectedIds}
            activeId={activeId}
            onToggleSelect={toggleSelect}
            onSelectAll={() => {
              if (
                visibleLeads.length &&
                visibleLeads.every((l) => selectedIds.has(l.id))
              ) {
                clearSelection();
              } else {
                selectAllFiltered(visibleLeads.map((l) => l.id));
              }
            }}
            onRowClick={(id) => setActive(id)}
            onOpenDetails={(id) => openDrawerFor(id)}
            onOpenLink={openLink}
            onCopyField={(v, label) => void copyField(v, label)}
            onMarkContacted={(id) => {
              setStatus(id, 'contacted');
            }}
          />
        </div>
        {drawerOpen && activeLead ? (
          <LeadDrawer
            lead={activeLead}
            onClose={() => setDrawerOpen(false)}
            onStatus={(status) => setStatus(activeLead.id, status)}
            onNotes={(notes) => setNotes(activeLead.id, notes)}
            onCopyRow={() => void copyActiveRow()}
            onCopyField={(v, label) => void copyField(v, label)}
            onOpenLink={openLink}
            focusNotesToken={focusNotesToken}
          />
        ) : null}
      </div>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
