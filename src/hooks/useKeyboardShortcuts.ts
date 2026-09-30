import { useEffect, useState } from 'react';
import { STATUS_SHORTCUTS } from '../lib/statuses';
import { useLeadsStore } from '../store/leadsStore';

export function useKeyboardShortcuts(visibleIds: string[]) {
  const [focusNotesToken, setFocusNotesToken] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      const store = useLeadsStore.getState();

      if (e.key === 'Escape') {
        if (typing) {
          (target as HTMLElement).blur();
          return;
        }
        store.setDrawerOpen(false);
        return;
      }

      if (typing) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        store.navigate(1, visibleIds);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        store.navigate(-1, visibleIds);
      } else if (e.key === 'c') {
        e.preventDefault();
        void store.copyActiveRow();
      } else if (e.key === 'n' || e.key === 'd') {
        e.preventDefault();
        if (store.activeId) {
          store.openDrawerFor(store.activeId);
          if (e.key === 'n') setFocusNotesToken((t) => t + 1);
        }
      } else if (e.key === 'Delete') {
        if (store.selectedIds.size > 0) {
          e.preventDefault();
          store.deleteSelected();
        }
      } else if (STATUS_SHORTCUTS[e.key]) {
        e.preventDefault();
        if (store.selectedIds.size > 0) {
          store.bulkStatus(STATUS_SHORTCUTS[e.key]);
        } else if (store.activeId) {
          store.setStatus(store.activeId, STATUS_SHORTCUTS[e.key]);
          store.setToast(`Status → ${STATUS_SHORTCUTS[e.key]}`);
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visibleIds]);

  return focusNotesToken;
}
