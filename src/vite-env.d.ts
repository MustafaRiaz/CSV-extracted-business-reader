/// <reference types="vite/client" />

export type SidecarData = {
  version: number;
  leadOverrides: Record<string, { status?: string; notes?: string }>;
  deletedIds?: string[];
  hiddenColumns: string[];
  hideDone: boolean;
  openSidebarOnClick?: boolean;
  filters?: {
    search?: string;
    statuses?: string[];
    city?: string;
    minScore?: number;
    hasPhone?: boolean;
    hasEmail?: boolean;
    hasWebsite?: boolean;
  };
};

export type SaveResult = {
  ok: boolean;
  error?: string;
  path?: string;
  progressPath?: string;
};

export type MapLeadApi = {
  openCsv: () => Promise<{
    filePath: string;
    content: string;
    sidecar: SidecarData | null;
  } | null>;
  exportCsv: (content: string, defaultName?: string) => Promise<string | null>;
  readCsv: (filePath: string) => Promise<{
    filePath: string;
    content: string;
    sidecar: SidecarData | null;
  } | null>;
  saveProgress: (csvPath: string, data: SidecarData) => Promise<SaveResult>;
  saveCsv: (csvPath: string, content: string) => Promise<SaveResult>;
  saveCsvSync: (csvPath: string, content: string) => boolean;
  saveProgressSync: (csvPath: string, data: SidecarData) => boolean;
  openExternal: (url: string) => Promise<boolean>;
  getRecent: () => Promise<string[]>;
  addRecent: (filePath: string) => Promise<string[]>;
  onMenuOpen: (cb: () => void) => () => void;
  onMenuExport: (cb: () => void) => () => void;
  onFlushSave: (cb: () => void) => () => void;
};

declare global {
  interface Window {
    maplead: MapLeadApi;
    mapleadPreloadOk?: boolean;
  }
}

export {};
