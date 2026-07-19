import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface ImportDataState {
  hasCustomData: boolean;
  importedCount: number;
  lastImportAt: Date | null;
  refreshKey: number;
}

interface ImportDataContextValue extends ImportDataState {
  notifyImported: (count: number) => void;
  reset: () => void;
}

const ImportDataContext = createContext<ImportDataContextValue | null>(null);

export function ImportDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ImportDataState>({
    hasCustomData: false,
    importedCount: 0,
    lastImportAt: null,
    refreshKey: 0,
  });

  const notifyImported = useCallback((count: number) => {
    setState(prev => ({
      hasCustomData: true,
      importedCount: prev.importedCount + count,
      lastImportAt: new Date(),
      refreshKey: prev.refreshKey + 1,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({ hasCustomData: false, importedCount: 0, lastImportAt: null, refreshKey: 0 });
  }, []);

  return (
    <ImportDataContext.Provider value={{ ...state, notifyImported, reset }}>
      {children}
    </ImportDataContext.Provider>
  );
}

export function useImportData() {
  const ctx = useContext(ImportDataContext);
  if (!ctx) throw new Error('useImportData must be used inside ImportDataProvider');
  return ctx;
}
