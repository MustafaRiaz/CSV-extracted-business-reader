import { create } from 'zustand';
import type { SidecarData } from '../vite-env';
import {
  type LeadRow,
  leadsToCsv,
  leadToTsv,
  orderHeaders,
  parseCsv,
} from '../lib/csv';
import {
  DONE_STATUSES,
  type LeadStatus,
  normalizeStatus,
} from '../lib/statuses';

export type Filters = {
  search: string;
  statuses: LeadStatus[];
  city: string;
  minScore: number;
  hasPhone: boolean;
  hasEmail: boolean;
  hasWebsite: boolean;
};

type LeadsState = {
  filePath: string | null;
  headers: string[];
  leads: LeadRow[];
  deletedIds: string[];
  hiddenColumns: string[];
  hideDone: boolean;
  openSidebarOnClick: boolean;
  filters: Filters;
  selectedIds: Set<string>;
  activeId: string | null;
  drawerOpen: boolean;
  recent: string[];
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  toast: string | null;

  setToast: (msg: string | null) => void;
  loadFromOpen: (payload: {
    filePath: string;
    content: string;
    sidecar: SidecarData | null;
  }) => void;
  applySidecar: (sidecar: SidecarData) => void;
  setStatus: (id: string, status: LeadStatus) => void;
  setNotes: (id: string, notes: string) => void;
  bulkStatus: (status: LeadStatus) => void;
  deleteSelected: () => void;
  copySelectedField: (field: 'Phone' | 'Email' | 'Website') => Promise<void>;
  toggleHiddenColumn: (col: string) => void;
  setHiddenColumns: (cols: string[]) => void;
  setHideDone: (v: boolean) => void;
  setOpenSidebarOnClick: (v: boolean) => void;
  setFilters: (partial: Partial<Filters>) => void;
  toggleSelect: (id: string) => void;
  selectAllFiltered: (ids: string[]) => void;
  clearSelection: () => void;
  setActive: (id: string | null, opts?: { openDrawer?: boolean }) => void;
  openDrawerFor: (id: string) => void;
  setDrawerOpen: (v: boolean) => void;
  navigate: (delta: 1 | -1, visibleIds: string[]) => void;
  persist: () => Promise<void>;
  flushPersist: () => Promise<boolean>;
  flushPersistSync: () => boolean;
  exportCsv: () => Promise<void>;
  openFile: () => Promise<void>;
  openRecent: (path: string) => Promise<void>;
  loadRecent: () => Promise<void>;
  copyActiveRow: () => Promise<void>;
  copyField: (value: string, label?: string) => Promise<void>;
  getVisibleLeads: () => LeadRow[];
  getVisibleHeaders: () => string[];
  getStats: () => Record<string, number>;
};

const defaultFilters = (): Filters => ({
  search: '',
  statuses: [],
  city: '',
  minScore: 0,
  hasPhone: false,
  hasEmail: false,
  hasWebsite: false,
});

function statusRank(s: LeadStatus): number {
  switch (s) {
    case 'new':
      return 0;
    case 'contacted':
      return 1;
    case 'replied':
      return 2;
    case 'meeting':
      return 3;
    case 'won':
    case 'not_interested':
    case 'do_not_contact':
      return 4;
    default:
      return 0;
  }
}

function preferStatus(a: LeadStatus, b: LeadStatus): LeadStatus {
  return statusRank(a) >= statusRank(b) ? a : b;
}

function applyOverrides(
  leads: LeadRow[],
  overrides: SidecarData['leadOverrides'] | undefined,
): LeadRow[] {
  if (!overrides) return leads;
  return leads.map((lead) => {
    const o = overrides[lead.id];
    if (!o) return lead;
    const status = o.status
      ? preferStatus(lead.status, normalizeStatus(o.status))
      : lead.status;
    const notes =
      o.notes != null && o.notes !== ''
        ? o.notes
        : lead.notes;
    return {
      ...lead,
      status,
      notes,
      fields: {
        ...lead.fields,
        Status: status,
        Notes: notes,
      },
    };
  });
}

/** Also match overrides by legacy id shapes if exact id missing */
function applyOverridesFlexible(
  leads: LeadRow[],
  overrides: SidecarData['leadOverrides'] | undefined,
): LeadRow[] {
  if (!overrides) return leads;
  const byExact = applyOverrides(leads, overrides);

  const byNamePhone = new Map<string, { status?: string; notes?: string }>();
  for (const [id, o] of Object.entries(overrides)) {
    const parts = id.split('|');
    if (parts.length >= 2) {
      byNamePhone.set(`${parts[0]}|${parts[1]}`, o);
    }
  }

  return byExact.map((lead) => {
    if (overrides[lead.id]) return lead;
    const parts = lead.id.split('|');
    const fallback = byNamePhone.get(`${parts[0]}|${parts[1]}`);
    if (!fallback) return lead;
    const status = fallback.status
      ? preferStatus(lead.status, normalizeStatus(fallback.status))
      : lead.status;
    const notes =
      fallback.notes != null && fallback.notes !== ''
        ? fallback.notes
        : lead.notes;
    return {
      ...lead,
      status,
      notes,
      fields: { ...lead.fields, Status: status, Notes: notes },
    };
  });
}

function buildSidecar(state: LeadsState): SidecarData {
  const leadOverrides: SidecarData['leadOverrides'] = {};
  for (const lead of state.leads) {
    leadOverrides[lead.id] = {
      status: lead.status,
      notes: lead.notes,
    };
  }
  return {
    version: 1,
    leadOverrides,
    deletedIds: state.deletedIds,
    hiddenColumns: state.hiddenColumns,
    hideDone: state.hideDone,
    openSidebarOnClick: state.openSidebarOnClick,
    filters: {
      search: state.filters.search,
      statuses: state.filters.statuses,
      city: state.filters.city,
      minScore: state.filters.minScore,
      hasPhone: state.filters.hasPhone,
      hasEmail: state.filters.hasEmail,
      hasWebsite: state.filters.hasWebsite,
    },
  };
}

function filterLeads(
  leads: LeadRow[],
  filters: Filters,
  hideDone: boolean,
): LeadRow[] {
  const q = filters.search.trim().toLowerCase();
  return leads.filter((lead) => {
    if (hideDone && DONE_STATUSES.includes(lead.status)) return false;
    if (filters.statuses.length && !filters.statuses.includes(lead.status)) {
      return false;
    }
    if (filters.city) {
      const city = (lead.fields['City'] ?? '').toLowerCase();
      if (!city.includes(filters.city.toLowerCase())) return false;
    }
    if (filters.minScore > 0) {
      const score = Number(lead.fields['Lead Score'] ?? 0);
      if (Number.isNaN(score) || score < filters.minScore) return false;
    }
    if (filters.hasPhone && !(lead.fields['Phone'] ?? '').trim()) return false;
    if (filters.hasEmail && !(lead.fields['Email'] ?? '').trim()) return false;
    if (filters.hasWebsite && !(lead.fields['Website'] ?? '').trim()) return false;
    if (q) {
      const hay = [
        lead.fields['Business Name'],
        lead.fields['Phone'],
        lead.fields['Email'],
        lead.fields['Address'],
        lead.fields['Category'],
        lead.notes,
        lead.status,
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function localProgressKey(filePath: string) {
  const base = filePath.split(/[/\\]/).pop() ?? filePath;
  return `maplead-progress:${base.toLowerCase()}`;
}

function saveLocalProgress(filePath: string, data: SidecarData) {
  try {
    localStorage.setItem(localProgressKey(filePath), JSON.stringify(data));
    localStorage.setItem(
      `maplead-progress:full:${filePath}`,
      JSON.stringify(data),
    );
  } catch (err) {
    console.warn('localStorage save failed', err);
  }
}

function loadLocalProgress(filePath: string): SidecarData | null {
  try {
    const raw =
      localStorage.getItem(`maplead-progress:full:${filePath}`) ||
      localStorage.getItem(localProgressKey(filePath));
    if (!raw) return null;
    return JSON.parse(raw) as SidecarData;
  } catch {
    return null;
  }
}

function mergeOverrides(
  a: SidecarData['leadOverrides'] = {},
  b: SidecarData['leadOverrides'] = {},
): SidecarData['leadOverrides'] {
  const out: SidecarData['leadOverrides'] = { ...a };
  for (const [id, ob] of Object.entries(b)) {
    const oa = out[id];
    if (!oa) {
      out[id] = ob;
      continue;
    }
    const statusA = normalizeStatus(oa.status);
    const statusB = normalizeStatus(ob.status);
    out[id] = {
      status: preferStatus(statusA, statusB),
      notes:
        ob.notes != null && ob.notes !== ''
          ? ob.notes
          : oa.notes,
    };
  }
  return out;
}

function mergeSidecars(
  a: SidecarData | null | undefined,
  b: SidecarData | null | undefined,
): SidecarData | null {
  if (!a && !b) return null;
  if (!a) return b ?? null;
  if (!b) return a;
  return {
    version: 1,
    leadOverrides: mergeOverrides(a.leadOverrides, b.leadOverrides),
    deletedIds: [...new Set([...(a.deletedIds ?? []), ...(b.deletedIds ?? [])])],
    hiddenColumns: b.hiddenColumns?.length ? b.hiddenColumns : a.hiddenColumns,
    hideDone: b.hideDone ?? a.hideDone,
    openSidebarOnClick: b.openSidebarOnClick ?? a.openSidebarOnClick,
    filters: b.filters ?? a.filters,
  };
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

export const useLeadsStore = create<LeadsState>((set, get) => ({
  filePath: null,
  headers: [],
  leads: [],
  deletedIds: [],
  hiddenColumns: [],
  hideDone: false,
  openSidebarOnClick: false,
  filters: defaultFilters(),
  selectedIds: new Set(),
  activeId: null,
  drawerOpen: false,
  recent: [],
  saveStatus: 'idle',
  toast: null,

  setToast: (msg) => {
    set({ toast: msg });
    if (msg) {
      setTimeout(() => {
        if (get().toast === msg) set({ toast: null });
      }, 2200);
    }
  },

  loadFromOpen: ({ filePath, content, sidecar }) => {
    const { headers, leads } = parseCsv(content);
    const ordered = orderHeaders(headers);
    const local = loadLocalProgress(filePath);
    const merged = mergeSidecars(sidecar as SidecarData | null, local);

    let nextLeads = leads;
    let deletedIds: string[] = [];
    let hiddenColumns: string[] = [];
    let hideDone = false;
    let openSidebarOnClick = false;
    let filters = defaultFilters();

    if (merged) {
      deletedIds = merged.deletedIds ?? [];
      const deleted = new Set(deletedIds);
      nextLeads = applyOverridesFlexible(
        leads.filter((l) => !deleted.has(l.id)),
        merged.leadOverrides,
      );
      hiddenColumns = merged.hiddenColumns ?? [];
      hideDone = Boolean(merged.hideDone);
      openSidebarOnClick = Boolean(merged.openSidebarOnClick);
      if (merged.filters) {
        filters = {
          search: merged.filters.search ?? '',
          statuses: (merged.filters.statuses as LeadStatus[]) ?? [],
          city: merged.filters.city ?? '',
          minScore: merged.filters.minScore ?? 0,
          hasPhone: Boolean(merged.filters.hasPhone),
          hasEmail: Boolean(merged.filters.hasEmail),
          hasWebsite: Boolean(merged.filters.hasWebsite),
        };
      }
    }

    const contacted = nextLeads.filter((l) => l.status === 'contacted').length;
    set({
      filePath,
      headers: ordered,
      leads: nextLeads,
      deletedIds,
      hiddenColumns,
      hideDone,
      openSidebarOnClick,
      filters,
      selectedIds: new Set(),
      activeId: nextLeads[0]?.id ?? null,
      drawerOpen: false,
      saveStatus: 'idle',
    });
    if (contacted > 0) {
      get().setToast(`Restored ${contacted} contacted lead${contacted === 1 ? '' : 's'}`);
    }
  },

  applySidecar: (sidecar) => {
    const { leads } = get();
    set({
      leads: applyOverrides(leads, sidecar.leadOverrides),
      hiddenColumns: sidecar.hiddenColumns ?? [],
      hideDone: Boolean(sidecar.hideDone),
    });
  },

  setStatus: (id, status) => {
    set({
      leads: get().leads.map((l) =>
        l.id === id
          ? { ...l, status, fields: { ...l.fields, Status: status } }
          : l,
      ),
    });
    void get().flushPersist();
  },

  setNotes: (id, notes) => {
    set({
      leads: get().leads.map((l) =>
        l.id === id
          ? { ...l, notes, fields: { ...l.fields, Notes: notes } }
          : l,
      ),
    });
    void get().persist();
  },

  bulkStatus: (status) => {
    const { selectedIds, leads } = get();
    if (!selectedIds.size) return;
    const count = selectedIds.size;
    set({
      leads: leads.map((l) =>
        selectedIds.has(l.id)
          ? { ...l, status, fields: { ...l.fields, Status: status } }
          : l,
      ),
    });
    void get().flushPersist();
    get().setToast(`Updated ${count} leads → ${status}`);
  },

  deleteSelected: () => {
    const { selectedIds, leads, deletedIds, activeId } = get();
    if (!selectedIds.size) return;
    const count = selectedIds.size;
    const ok = window.confirm(
      `Delete ${count} selected lead${count === 1 ? '' : 's'}? This removes them from the workspace (export will omit them).`,
    );
    if (!ok) return;

    const nextDeleted = [...new Set([...deletedIds, ...selectedIds])];
    const nextLeads = leads.filter((l) => !selectedIds.has(l.id));
    const activeGone = activeId != null && selectedIds.has(activeId);

    set({
      leads: nextLeads,
      deletedIds: nextDeleted,
      selectedIds: new Set(),
      activeId: activeGone ? nextLeads[0]?.id ?? null : activeId,
      drawerOpen: activeGone ? false : get().drawerOpen,
    });
    void get().flushPersist();
    get().setToast(`Deleted ${count} lead${count === 1 ? '' : 's'}`);
  },

  copySelectedField: async (field) => {
    const { selectedIds, leads } = get();
    if (!selectedIds.size) return;
    const values = leads
      .filter((l) => selectedIds.has(l.id))
      .map((l) => (l.fields[field] ?? '').trim())
      .filter(Boolean);
    if (!values.length) {
      get().setToast(`No ${field.toLowerCase()} values in selection`);
      return;
    }
    // Unique, keep order
    const unique = [...new Set(values)];
    await navigator.clipboard.writeText(unique.join('\n'));
    get().setToast(
      `Copied ${unique.length} ${field.toLowerCase()}${unique.length === 1 ? '' : 's'}`,
    );
  },

  toggleHiddenColumn: (col) => {
    const hidden = new Set(get().hiddenColumns);
    if (hidden.has(col)) hidden.delete(col);
    else hidden.add(col);
    set({ hiddenColumns: [...hidden] });
    void get().persist();
  },

  setHiddenColumns: (cols) => {
    set({ hiddenColumns: cols });
    void get().persist();
  },

  setHideDone: (v) => {
    set({ hideDone: v });
    void get().persist();
  },

  setOpenSidebarOnClick: (v) => {
    set({ openSidebarOnClick: v });
    void get().persist();
  },

  setFilters: (partial) => {
    set({ filters: { ...get().filters, ...partial } });
    void get().persist();
  },

  toggleSelect: (id) => {
    const next = new Set(get().selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ selectedIds: next });
  },

  selectAllFiltered: (ids) => {
    set({ selectedIds: new Set(ids) });
  },

  clearSelection: () => set({ selectedIds: new Set() }),

  setActive: (id, opts) => {
    const { openSidebarOnClick, drawerOpen } = get();
    if (opts?.openDrawer === true) {
      set({ activeId: id, drawerOpen: id != null });
      return;
    }
    // Select row; open drawer only if preference is on, or keep it if already open
    set({
      activeId: id,
      drawerOpen: id != null && (openSidebarOnClick || drawerOpen),
    });
  },

  openDrawerFor: (id) => {
    set({ activeId: id, drawerOpen: true });
  },

  setDrawerOpen: (v) => set({ drawerOpen: v }),

  navigate: (delta, visibleIds) => {
    if (!visibleIds.length) return;
    const { activeId, openSidebarOnClick, drawerOpen } = get();
    const idx = activeId ? visibleIds.indexOf(activeId) : -1;
    let next = idx + delta;
    if (next < 0) next = visibleIds.length - 1;
    if (next >= visibleIds.length) next = 0;
    set({
      activeId: visibleIds[next],
      drawerOpen: openSidebarOnClick || drawerOpen,
    });
  },

  persist: async () => {
    if (!get().filePath || !window.maplead) return;
    if (persistTimer) clearTimeout(persistTimer);
    // Short debounce for rapid typing in notes; status clicks still flush quickly
    persistTimer = setTimeout(() => {
      void get().flushPersist();
    }, 150);
  },

  flushPersist: async () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    const latest = get();
    if (!latest.filePath) return false;

    const sidecar = buildSidecar(latest);
    saveLocalProgress(latest.filePath, sidecar);

    if (!window.maplead) {
      set({ saveStatus: 'error' });
      get().setToast('Not in desktop app — progress kept in browser only');
      return false;
    }

    const canWriteSheet =
      /[/\\]/.test(latest.filePath) &&
      latest.filePath.toLowerCase().endsWith('.csv');

    set({ saveStatus: 'saving' });
    try {
      const csv = leadsToCsv(latest.headers, latest.leads);
      const progressResult = await window.maplead.saveProgress(
        latest.filePath,
        sidecar,
      );
      if (!progressResult?.ok) {
        set({ saveStatus: 'error' });
        get().setToast(
          `Progress save failed: ${progressResult?.error ?? 'unknown'}`,
        );
        return false;
      }

      if (canWriteSheet) {
        const csvResult = await window.maplead.saveCsv(latest.filePath, csv);
        if (!csvResult?.ok) {
          // Progress is still saved in app data — warn but don't hard-fail UX
          set({ saveStatus: 'saved' });
          get().setToast(
            `Progress saved (CSV locked?). Close Excel and click Contacted again. ${csvResult?.error ?? ''}`,
          );
          return true;
        }
      }

      const contacted = latest.leads.filter((l) => l.status === 'contacted').length;
      set({ saveStatus: 'saved' });
      get().setToast(`Saved · ${contacted} contacted`);
      return true;
    } catch (err) {
      console.error('persist failed', err);
      set({ saveStatus: 'error' });
      get().setToast(`Save failed: ${String(err)}`);
      return false;
    }
  },

  flushPersistSync: () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    const latest = get();
    if (!latest.filePath) return false;
    const sidecar = buildSidecar(latest);
    saveLocalProgress(latest.filePath, sidecar);
    if (!window.maplead) return false;
    try {
      const csv = leadsToCsv(latest.headers, latest.leads);
      window.maplead.saveProgressSync?.(latest.filePath, sidecar);
      const canWriteSheet =
        /[/\\]/.test(latest.filePath) &&
        latest.filePath.toLowerCase().endsWith('.csv');
      if (canWriteSheet) {
        window.maplead.saveCsvSync?.(latest.filePath, csv);
      }
      return true;
    } catch (err) {
      console.error('flushPersistSync failed', err);
      return false;
    }
  },

  exportCsv: async () => {
    const { headers, leads, filePath } = get();
    if (!window.maplead) return;
    const csv = leadsToCsv(headers, leads);
    const base = filePath
      ? filePath.replace(/\.csv$/i, '') + '-updated.csv'
      : 'maplead-export.csv';
    const saved = await window.maplead.exportCsv(csv, base);
    if (saved) get().setToast('Exported CSV');
  },

  openFile: async () => {
    if (!window.maplead) {
      get().setToast('Open the Electron desktop window (npm run dev) — browser cannot save');
      return;
    }
    try {
      const result = await window.maplead.openCsv();
      if (!result) return;
      get().loadFromOpen(result);
      const recent = await window.maplead.addRecent(result.filePath);
      set({ recent });
      get().setToast(`Opened ${result.filePath.split(/[/\\]/).pop()}`);
    } catch (err) {
      console.error('openFile failed', err);
      get().setToast('Failed to open CSV');
    }
  },

  openRecent: async (path) => {
    if (!window.maplead) return;
    try {
      const result = await window.maplead.readCsv(path);
      if (!result) return;
      get().loadFromOpen(result);
      const recent = await window.maplead.addRecent(result.filePath);
      set({ recent });
    } catch {
      get().setToast('Could not open recent file');
    }
  },

  loadRecent: async () => {
    if (!window.maplead) return;
    const recent = await window.maplead.getRecent();
    set({ recent });
  },

  copyActiveRow: async () => {
    const { activeId, leads, headers } = get();
    const lead = leads.find((l) => l.id === activeId);
    if (!lead) return;
    const tsv = leadToTsv(headers, lead);
    await navigator.clipboard.writeText(tsv);
    get().setToast('Row copied (TSV)');
  },

  copyField: async (value, label) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    get().setToast(label ? `Copied ${label}` : 'Copied');
  },

  getVisibleLeads: () => {
    const { leads, filters, hideDone } = get();
    return filterLeads(leads, filters, hideDone);
  },

  getVisibleHeaders: () => {
    const { headers, hiddenColumns } = get();
    return headers.filter((h) => !hiddenColumns.includes(h));
  },

  getStats: () => {
    const stats: Record<string, number> = {};
    for (const lead of get().leads) {
      stats[lead.status] = (stats[lead.status] ?? 0) + 1;
    }
    stats.total = get().leads.length;
    return stats;
  },
}));
