import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { kavachApi } from '@/kavach/api/kavachApi';
import { useKavachFilters } from '@/kavach/context/FilterContext';
import GlobalFilters from '@/kavach/components/GlobalFilters';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Badge } from '@/shared/components/ui/badge';

type TrendTab = 'monthly' | 'weekly' | 'day-of-week' | 'hour' | 'daypart' | 'category-growth' | 'district-comparison' | 'mo-trends';

export default function TrendIntelligencePage() {
  const { filters } = useKavachFilters();
  const [activeTab, setActiveTab] = useState<TrendTab>('monthly');
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetcher = async () => {
      try {
        let res;
        switch (activeTab) {
          case 'monthly': res = await kavachApi.getMonthlyTrends(filters); break;
          case 'weekly': res = await kavachApi.getWeeklyTrends(filters); break;
          case 'day-of-week': res = await kavachApi.getDayOfWeekAnalysis(filters); break;
          case 'hour': res = await kavachApi.getHourOfDayAnalysis(filters); break;
          case 'daypart': res = await kavachApi.getDaypartAnalysis(filters); break;
          case 'category-growth': res = await kavachApi.getCategoryGrowth(filters); break;
          case 'district-comparison': res = await kavachApi.getDistrictComparison(filters); break;
          case 'mo-trends': res = await kavachApi.getModusOperandiTrends(filters); break;
        }
        if (!cancelled) setData(res?.data || {});
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load trends');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetcher();
    return () => { cancelled = true; };
  }, [activeTab, filters]);

  const renderChart = (chartData: unknown, type: 'line' | 'bar' | 'area' = 'bar') => {
    if (!Array.isArray(chartData) || chartData.length === 0) return null;
    return (
      <ResponsiveContainer width="100%" height={400}>
        {type === 'line' ? (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="incidents" stroke="#1D4ED8" strokeWidth={2} dot={{ r: 3 }} />
            {(chartData[0] as any)?.previous !== undefined && (
              <Line type="monotone" dataKey="previous" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            )}
          </LineChart>
        ) : type === 'area' ? (
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Area type="monotone" dataKey="incidents" stroke="#0891B2" fill="#0891B220" />
          </AreaChart>
        ) : (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="incidents" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    );
  };

  const tabConfig: { key: TrendTab; label: string; chartType: 'line' | 'bar' | 'area'; dataKey: string }[] = [
    { key: 'monthly', label: 'Monthly', chartType: 'line', dataKey: 'trends' },
    { key: 'weekly', label: 'Weekly', chartType: 'bar', dataKey: 'trends' },
    { key: 'day-of-week', label: 'Day of Week', chartType: 'bar', dataKey: 'analysis' },
    { key: 'hour', label: 'Hour of Day', chartType: 'area', dataKey: 'analysis' },
    { key: 'daypart', label: 'Daypart', chartType: 'bar', dataKey: 'analysis' },
    { key: 'category-growth', label: 'Category Growth', chartType: 'bar', dataKey: 'categories' },
    { key: 'district-comparison', label: 'District Comparison', chartType: 'bar', dataKey: 'districts' },
    { key: 'mo-trends', label: 'MO Trends', chartType: 'bar', dataKey: 'trends' },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-xl font-bold text-[#0F172A]">Trend Intelligence</h1><p className="text-sm text-slate-500">Pattern analysis across time and categories</p></div>
        <GlobalFilters />
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-center gap-3 p-10">
            <AlertTriangle className="size-8 text-[#DC2626]" />
            <p className="text-sm font-medium text-[#DC2626]">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const chartData = data ? (data as any)[tabConfig.find((t) => t.key === activeTab)?.dataKey || 'trends'] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0F172A]">Trend Intelligence</h1>
        <p className="text-sm text-slate-500">Pattern analysis across time and categories</p>
      </div>
      <GlobalFilters />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TrendTab)}>
        <TabsList className="flex-wrap">
          {tabConfig.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {tabConfig.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  {t.label}
                  {Array.isArray(chartData) && chartData.length > 0 && (chartData[0] as any)?.significant !== undefined && (
                    <Badge variant={(chartData[0] as any).significant > 0 ? 'destructive' : 'secondary'} className="ml-2 text-xs">
                      {(chartData[0] as any).significant > 0 ? (
                        <><TrendingUp className="mr-1 size-3" /> Significant Increase</>
                      ) : (
                        <><TrendingDown className="mr-1 size-3" /> Significant Decrease</>
                      )}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : Array.isArray(chartData) && chartData.length > 0 ? (
                  renderChart(chartData, t.chartType)
                ) : (
                  <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
                    <TrendingUp className="size-8" />
                    <p className="text-sm">No trend data available for {t.label.toLowerCase()}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
