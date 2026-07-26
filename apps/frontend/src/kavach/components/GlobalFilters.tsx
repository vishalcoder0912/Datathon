import { useMemo } from 'react';
import { RotateCcw, Filter } from 'lucide-react';
import { useKavachFilters } from '@/kavach/context/FilterContext';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

const districtOptions = [
  'Bengaluru Urban', 'Bengaluru Rural', 'Mysuru', 'Hubli-Dharwad', 'Mangaluru',
  'Belagavi', 'Kalaburagi', 'Davangere', 'Ballari', 'Tumakuru', 'Shivamogga',
  'Udupi', 'Hassan', 'Raichur', 'Bidar', 'Chikkaballapur', 'Kolar',
  'Mandya', 'Ramanagara', 'Vijayapura', 'Bagalkote', 'Gadag', 'Haveri',
  'Chitradurga', 'Dakshina Kannada', 'Uttara Kannada', 'Kodagu', 'Chamarajanagara',
  'Koppal', 'Yadgir', 'Dharwad',
];

const crimeCategoryOptions = [
  'Theft', 'Robbery', 'Burglary', 'Assault', 'Homicide',
  'Cyber Crime', 'Fraud', 'Drug Offences', 'Domestic Violence',
  'Kidnapping', 'Vehicle Theft', 'Chain Snatching', 'Criminal Trespass',
  'Sexual Offences', 'Rioting', 'Property Damage',
];

const statusOptions = [
  'Under Investigation', 'Charge Sheet Filed', 'Closed', 'Pending Trial', 'Awaiting Action',
];

const severityOptions = ['Critical', 'High', 'Medium', 'Low'];

const timeOfDayOptions = ['Early Morning (0-6)', 'Morning (6-12)', 'Afternoon (12-18)', 'Night (18-24)'];

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
}

function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((s) => s !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <div className="relative">
      <div className="mb-1 text-xs font-semibold text-slate-500">{label}</div>
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white p-2">
        {options.slice(0, 20).map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-[#1D4ED8] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt}
            </button>
          );
        })}
        {options.length > 20 && (
          <span className="px-2 py-0.5 text-xs text-slate-400">+{options.length - 20} more</span>
        )}
      </div>
    </div>
  );
}

export default function GlobalFilters() {
  const {
    filters,
    setDateFrom,
    setDateTo,
    setDistricts,
    setPoliceStations,
    setCrimeCategories,
    setStatus,
    setSeverity,
    setTimeOfDay,
    resetFilters,
    activeFilterCount,
  } = useKavachFilters();

  const policeStationOptions = useMemo(() => {
    return filters.districts.length > 0
      ? filters.districts
          .slice(0, 3)
          .flatMap((d) => [`${d} PS 1`, `${d} PS 2`])
      : [];
  }, [filters.districts]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Filter className="size-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-[#1D4ED8] px-2 py-0.5 text-xs text-white">
              {activeFilterCount}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 gap-1 text-xs text-slate-500">
          <RotateCcw className="size-3" />
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Date From</label>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Date To</label>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Status</label>
          <Select value={filters.status} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {statusOptions.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Severity</label>
          <Select value={filters.severity} onValueChange={(v) => setSeverity(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {severityOptions.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Time of Day</label>
          <Select value={filters.timeOfDay} onValueChange={(v) => setTimeOfDay(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {timeOfDayOptions.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MultiSelect label="Districts" options={districtOptions} selected={filters.districts} onChange={setDistricts} />
        <MultiSelect label="Police Stations" options={policeStationOptions} selected={filters.policeStations} onChange={setPoliceStations} />
        <MultiSelect label="Crime Categories" options={crimeCategoryOptions} selected={filters.crimeCategories} onChange={setCrimeCategories} />
      </div>
    </div>
  );
}
