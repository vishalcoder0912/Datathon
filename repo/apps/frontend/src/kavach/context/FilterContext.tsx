import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

export interface KavachFilters {
  dateFrom: string;
  dateTo: string;
  districts: string[];
  policeStations: string[];
  crimeCategories: string[];
  status: string;
  severity: string;
  timeOfDay: string;
}

interface FilterContextValue {
  filters: KavachFilters;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  setDistricts: (v: string[]) => void;
  setPoliceStations: (v: string[]) => void;
  setCrimeCategories: (v: string[]) => void;
  setStatus: (v: string) => void;
  setSeverity: (v: string) => void;
  setTimeOfDay: (v: string) => void;
  setFilter: <K extends keyof KavachFilters>(key: K, value: KavachFilters[K]) => void;
  resetFilters: () => void;
  activeFilterCount: number;
}

const defaultFilters: KavachFilters = {
  dateFrom: '',
  dateTo: '',
  districts: [],
  policeStations: [],
  crimeCategories: [],
  status: '',
  severity: '',
  timeOfDay: '',
};

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<KavachFilters>(defaultFilters);

  const setDateFrom = useCallback((v: string) => setFilters((prev) => ({ ...prev, dateFrom: v })), []);
  const setDateTo = useCallback((v: string) => setFilters((prev) => ({ ...prev, dateTo: v })), []);
  const setDistricts = useCallback((v: string[]) => setFilters((prev) => ({ ...prev, districts: v })), []);
  const setPoliceStations = useCallback((v: string[]) => setFilters((prev) => ({ ...prev, policeStations: v })), []);
  const setCrimeCategories = useCallback((v: string[]) => setFilters((prev) => ({ ...prev, crimeCategories: v })), []);
  const setStatus = useCallback((v: string) => setFilters((prev) => ({ ...prev, status: v })), []);
  const setSeverity = useCallback((v: string) => setFilters((prev) => ({ ...prev, severity: v })), []);
  const setTimeOfDay = useCallback((v: string) => setFilters((prev) => ({ ...prev, timeOfDay: v })), []);

  const setFilter = useCallback(<K extends keyof KavachFilters>(key: K, value: KavachFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.districts.length > 0) count++;
    if (filters.policeStations.length > 0) count++;
    if (filters.crimeCategories.length > 0) count++;
    if (filters.status) count++;
    if (filters.severity) count++;
    if (filters.timeOfDay) count++;
    return count;
  }, [filters]);

  return (
    <FilterContext.Provider
      value={{
        filters,
        setDateFrom,
        setDateTo,
        setDistricts,
        setPoliceStations,
        setCrimeCategories,
        setStatus,
        setSeverity,
        setTimeOfDay,
        setFilter,
        resetFilters,
        activeFilterCount,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useKavachFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useKavachFilters must be used within FilterProvider');
  return ctx;
}
