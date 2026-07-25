import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import type {ReactNode} from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import DashboardPage from '@/kavach/pages/DashboardPage';
import GlobalFilters from '@/kavach/components/GlobalFilters';
import { FilterProvider, useKavachFilters } from '@/kavach/context/FilterContext';

interface MockChildrenProps {
  children?: ReactNode;
}

interface MockSelectItemProps extends MockChildrenProps {
  value?: string;
}

interface MockSelectValueProps {
  placeholder?: string;
}

vi.mock('@/shared/components/ui/select', () => ({
  Select: ({ children }: MockChildrenProps) => <div data-testid="mock-select">{children}</div>,
  SelectTrigger: ({ children }: MockChildrenProps) => <button data-testid="mock-select-trigger">{children}</button>,
  SelectContent: ({ children }: MockChildrenProps) => <div data-testid="mock-select-content">{children}</div>,
  SelectItem: ({ children, value }: MockSelectItemProps) => <option data-testid="mock-select-item" value={value}>{children}</option>,
  SelectValue: ({ placeholder }: MockSelectValueProps) => <span data-testid="mock-select-value">{placeholder || 'All'}</span>,
}));

const mockOverviewData = {
  data: {
    totalIncidents: 1250,
    activeInvestigations: 342,
    closedInvestigations: 678,
    pending: 180,
    cold: 50,
    highRiskDistricts: 8,
    activeHotspots: 12,
    repeatOffenders: 45,
    currentAlerts: 62,
    periodChange: 15.3,
    mostCommonCategory: 'Cybercrime',
    avgInvestigationDuration: 45,
    dataQualityScore: 87,
    recordCount: 1250,
  },
};

let mockApiResolve: (value: unknown) => void;
let mockApiReject: (value: unknown) => void;

vi.mock('@/kavach/api/kavachApi', () => ({
  kavachApi: {
    getOverview: vi.fn(() => new Promise((resolve, reject) => {
      mockApiResolve = resolve;
      mockApiReject = reject;
    })),
    getDistricts: vi.fn(() => Promise.resolve({ data: [] })),
    getHotspots: vi.fn(() => Promise.resolve({ data: [] })),
    getAnomalies: vi.fn(() => Promise.resolve({ data: [] })),
    getOffenders: vi.fn(() => Promise.resolve({ data: [] })),
    getAlerts: vi.fn(() => Promise.resolve({ data: [] })),
    getCopilotSuggestions: vi.fn(() => Promise.resolve({ data: [] })),
    getNetwork: vi.fn(() => Promise.resolve({ data: { nodes: [], edges: [] } })),
    getMonthlyTrends: vi.fn(() => Promise.resolve({ data: [] })),
    getDistrictRisks: vi.fn(() => Promise.resolve({ data: [] })),
    getCorrelations: vi.fn(() => Promise.resolve({ data: {} })),
    getDistrict: vi.fn(() => Promise.resolve({ data: null })),
    loadDemoData: vi.fn(() => Promise.resolve({ data: { loaded: true } })),
    copilotQuery: vi.fn(() => Promise.resolve({ data: { type: 'overview', data: {}, message: 'test' } })),
  },
}));

function FilterStateDisplay() {
  const { filters, setFilter, setDateFrom, setDistricts, resetFilters, activeFilterCount } = useKavachFilters();
  return (
    <div>
      <span data-testid="date-from">{filters.dateFrom}</span>
      <span data-testid="districts">{filters.districts.join(',')}</span>
      <span data-testid="active-count">{activeFilterCount}</span>
      <button data-testid="set-date-from" onClick={() => setDateFrom('2024-01-01')}>Set Date From</button>
      <button data-testid="set-districts" onClick={() => setDistricts(['Bengaluru Urban'])}>Set Districts</button>
      <button data-testid="set-filter" onClick={() => setFilter('severity', 'HIGH')}>Set Severity</button>
      <button data-testid="reset" onClick={resetFilters}>Reset</button>
    </div>
  );
}

describe('Kavach Frontend Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DashboardPage', () => {
    it('renders KPI cards with overview data', async () => {
      render(
        <FilterProvider>
          <DashboardPage />
        </FilterProvider>
      );

      await act(async () => {
        mockApiResolve(mockOverviewData);
      });

      await waitFor(() => {
        expect(screen.getByText('Total Incidents')).toBeInTheDocument();
        expect(screen.getByText('1250')).toBeInTheDocument();
      });

      expect(screen.getByText('Active Investigations')).toBeInTheDocument();
      expect(screen.getByText('342')).toBeInTheDocument();
      expect(screen.getByText('Closed Investigations')).toBeInTheDocument();
      expect(screen.getByText('678')).toBeInTheDocument();
      expect(screen.getByText('High-Risk Districts')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('Active Hotspots')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('Multiple Case Links')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getByText('Current Alerts')).toBeInTheDocument();
      expect(screen.getByText('62')).toBeInTheDocument();
    });

    it('renders "KAVACH Command Centre" heading', async () => {
      render(
        <FilterProvider>
          <DashboardPage />
        </FilterProvider>
      );

      expect(screen.getByText('KAVACH AI Workspace')).toBeInTheDocument();
    });

    it('renders GlobalFilters component inside DashboardPage', async () => {
      render(
        <FilterProvider>
          <DashboardPage />
        </FilterProvider>
      );

      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('renders error state when API fails', async () => {
      render(
        <FilterProvider>
          <DashboardPage />
        </FilterProvider>
      );

      await act(async () => {
        mockApiReject(new Error('Failed to load dashboard'));
      });

      await waitFor(() => {
        expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument();
      });
    });

    it('shows loading skeletons initially', () => {
      render(
        <FilterProvider>
          <DashboardPage />
        </FilterProvider>
      );

      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows heading when overview data is null', async () => {
      render(
        <FilterProvider>
          <DashboardPage />
        </FilterProvider>
      );

      await act(async () => {
        mockApiResolve({ data: null });
      });

      await waitFor(() => {
        expect(screen.getByText('KAVACH AI Workspace')).toBeInTheDocument();
      });
    });
  });

  describe('FilterContext', () => {
    it('provides default filter state', () => {
      render(
        <FilterProvider>
          <FilterStateDisplay />
        </FilterProvider>
      );

      expect(screen.getByTestId('date-from').textContent).toBe('');
      expect(screen.getByTestId('districts').textContent).toBe('');
      expect(screen.getByTestId('active-count').textContent).toBe('0');
    });

    it('updates dateFrom filter', () => {
      render(
        <FilterProvider>
          <FilterStateDisplay />
        </FilterProvider>
      );

      fireEvent.click(screen.getByTestId('set-date-from'));
      expect(screen.getByTestId('date-from').textContent).toBe('2024-01-01');
      expect(screen.getByTestId('active-count').textContent).toBe('1');
    });

    it('updates districts filter', () => {
      render(
        <FilterProvider>
          <FilterStateDisplay />
        </FilterProvider>
      );

      fireEvent.click(screen.getByTestId('set-districts'));
      expect(screen.getByTestId('districts').textContent).toBe('Bengaluru Urban');
      expect(screen.getByTestId('active-count').textContent).toBe('1');
    });

    it('updates via setFilter generic method', () => {
      render(
        <FilterProvider>
          <FilterStateDisplay />
        </FilterProvider>
      );

      fireEvent.click(screen.getByTestId('set-filter'));
      expect(screen.getByTestId('active-count').textContent).toBe('1');
    });

    it('resets filters to defaults', () => {
      render(
        <FilterProvider>
          <FilterStateDisplay />
        </FilterProvider>
      );

      fireEvent.click(screen.getByTestId('set-date-from'));
      expect(screen.getByTestId('active-count').textContent).toBe('1');

      fireEvent.click(screen.getByTestId('reset'));
      expect(screen.getByTestId('date-from').textContent).toBe('');
      expect(screen.getByTestId('active-count').textContent).toBe('0');
    });

    it('tracks active filter count correctly', () => {
      render(
        <FilterProvider>
          <FilterStateDisplay />
        </FilterProvider>
      );

      fireEvent.click(screen.getByTestId('set-date-from'));
      fireEvent.click(screen.getByTestId('set-districts'));
      expect(screen.getByTestId('active-count').textContent).toBe('2');

      fireEvent.click(screen.getByTestId('reset'));
      expect(screen.getByTestId('active-count').textContent).toBe('0');
    });
  });

  describe('GlobalFilters', () => {
    it('renders filter controls', () => {
      render(
        <FilterProvider>
          <GlobalFilters />
        </FilterProvider>
      );

      expect(screen.getByText('Filters')).toBeInTheDocument();
      expect(screen.getByText('Reset')).toBeInTheDocument();
      expect(screen.getByText('Date From')).toBeInTheDocument();
      expect(screen.getByText('Date To')).toBeInTheDocument();
      expect(screen.getByText('Districts')).toBeInTheDocument();
      expect(screen.getByText('Crime Categories')).toBeInTheDocument();
    });

    it('renders district options in multi-select', () => {
      render(
        <FilterProvider>
          <GlobalFilters />
        </FilterProvider>
      );

      expect(screen.getByText('Bengaluru Urban')).toBeInTheDocument();
      expect(screen.getByText('Mysuru')).toBeInTheDocument();
    });

    it('shows active filter count badge', () => {
      function FilterActivator() {
        const { setDateFrom } = useKavachFilters();
        return <button data-testid="activate" onClick={() => setDateFrom('2024-01-01')}>Activate</button>;
      }

      render(
        <FilterProvider>
          <GlobalFilters />
          <FilterActivator />
        </FilterProvider>
      );

      expect(screen.queryByText('1')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('activate'));

      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });
});
