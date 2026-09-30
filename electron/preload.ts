import { contextBridge, ipcRenderer } from 'electron';

export type SidecarData = {
  version: number;
  leadOverrides: Record<
    string,
    {
      status?: string;
      notes?: string;
    }
  >;
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
  columnOrder?: string[];
};

export type OpenCsvResult = {
  filePath: string;
  content: string;
  sidecar: SidecarData | null;
} | null;

export type SaveResult = {
  ok: boolean;
  error?: string;
  path?: string;
  progressPath?: string;
};

const api = {
  openCsv: (): Promise<OpenCsvResult> => ipcRenderer.invoke('dialog:openCsv'),
  exportCsv: (content: string, defaultName?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:exportCsv', content, defaultName),
  readCsv: (filePath: string): Promise<OpenCsvResult> =>
    ipcRenderer.invoke('file:readCsv', filePath),
  saveProgress: (csvPath: string, data: SidecarData): Promise<SaveResult> =>
    ipcRenderer.invoke('progress:save', csvPath, data),
  saveCsv: (csvPath: string, content: string): Promise<SaveResult> =>
    ipcRenderer.invoke('file:saveCsv', csvPath, content),
  saveCsvSync: (csvPath: string, content: string): boolean =>
    ipcRenderer.sendSync('file:saveCsvSync', csvPath, content) as boolean,
  saveProgressSync: (csvPath: string, data: SidecarData): boolean =>
    ipcRenderer.sendSync('progress:saveSync', csvPath, data) as boolean,
  openExternal: (url: string): Promise<boolean> =>
    ipcRenderer.invoke('shell:openExternal', url),
  getRecent: (): Promise<string[]> => ipcRenderer.invoke('app:getRecent'),
  addRecent: (filePath: string): Promise<string[]> =>
    ipcRenderer.invoke('app:addRecent', filePath),
  onMenuOpen: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('menu:open', handler);
    return () => ipcRenderer.removeListener('menu:open', handler);
  },
  onMenuExport: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('menu:export', handler);
    return () => ipcRenderer.removeListener('menu:export', handler);
  },
  onFlushSave: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('app:flush-save', handler);
    return () => ipcRenderer.removeListener('app:flush-save', handler);
  },
};

contextBridge.exposeInMainWorld('maplead', api);

export type MapLeadApi = typeof api;
