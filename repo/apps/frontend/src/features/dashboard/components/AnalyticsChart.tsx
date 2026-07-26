import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, SlidersHorizontal } from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ScatterChart,
  Scatter, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ComposedChart, Legend,
} from 'recharts';
import { ChartConfig } from '@/features/data/model/dataStore';
import { Input } from '@/shared/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/components/ui/sheet';
import { Switch } from '@/shared/components/ui/switch';

const PALETTES = {
  blue: ['#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#1d4ed8'],
  green: ['#dcfce7', '#86efac', '#4ade80', '#22c55e', '#15803d'],
  purple: ['#f3e8ff', '#d8b4fe', '#c084fc', '#a855f7', '#7e22ce'],
  orange: ['#ffedd5', '#fdba74', '#fb923c', '#f97316', '#c2410c'],
} as const;

type PaletteKey = keyof typeof PALETTES;
type LocalChartType = ChartConfig['type'];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value?: string | number; dataKey?: string; color?: string }>;
  label?: string | number;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm text-muted-foreground">
          {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

interface AnalyticsChartProps {
  config: ChartConfig;
  index: number;
}

const AnalyticsChart = ({ config, index }: AnalyticsChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartType, setChartType] = useState<LocalChartType>(config.type);
  const [xLabel, setXLabel] = useState(config.xLabel || config.xKey);
  const [yLabel, setYLabel] = useState(config.yLabel || config.yKey);
  const [palette, setPalette] = useState<PaletteKey>('blue');
  const [showGrid, setShowGrid] = useState(true);
  const [showLegend, setShowLegend] = useState(chartType === 'pie');
  const [curved, setCurved] = useState(true);

  const colors = PALETTES[palette];
  const isPieChart = chartType === 'pie';
  const chartData = useMemo(() => {
    const data = config.data || [];
    if (chartType === 'bar' || chartType === 'pie') {
      return [...data].sort((a, b) => Number(b[config.yKey] ?? 0) - Number(a[config.yKey] ?? 0));
    }
    return data;
  }, [config.data, chartType, config.yKey]);
  const hasRenderableChart = Array.isArray(chartData) && chartData.length > 0 && Boolean(config.xKey) && Boolean(config.yKey);

  useEffect(() => {
    setShowLegend(chartType === 'pie');
  }, [chartType]);

  const exportPng = async () => {
    if (!chartRef.current) return;
    try {
      const url = await toPng(chartRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.title.replace(/\s+/g, '_').toLowerCase()}.png`;
      a.click();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error occurred';
      console.error('Export failed:', errorMsg);
      alert(`Failed to export chart: ${errorMsg}`);
    }
  };

  const renderChart = () => {
    const commonProps = { data: chartData };
    const curveType = curved ? 'monotone' : 'linear';
    const grid = showGrid ? <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 20% 90%)" vertical={false} /> : null;
    const legend = showLegend ? (
      <Legend
        wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
        iconSize={16}
        iconType="circle"
        align="center"
        verticalAlign="bottom"
      />
    ) : null;

    const axisStyle = { fontSize: 12, fill: 'hsl(215 16% 47%)' };

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps} margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
            <defs>
              <linearGradient id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[3]} stopOpacity={0.4} />
                <stop offset="95%" stopColor={colors[3]} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            {grid}
            <XAxis dataKey={config.xKey} tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            {legend}
            <Area type={curveType} dataKey={config.yKey} stroke={colors[3]} fill={`url(#gradient-${index})`} strokeWidth={2} />
          </AreaChart>
        );
      case 'histogram':
      case 'bar':
        return (
          <BarChart {...commonProps} margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
            {grid}
            <XAxis dataKey={config.xKey} tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            {legend}
            <Bar dataKey={config.yKey} fill={colors[3]} radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart {...commonProps} margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
            {grid}
            <XAxis dataKey={config.xKey} tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            {legend}
            <Line type={curveType} dataKey={config.yKey} stroke={colors[3]} strokeWidth={2} dot={{ fill: colors[3], strokeWidth: 0, r: 4 }} />
          </LineChart>
        );
      case 'scatter':
        return (
          <ScatterChart {...commonProps} margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
            {grid}
            <XAxis type="number" dataKey={config.xKey} name={xLabel} tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis type="number" dataKey={config.yKey} name={yLabel} tick={axisStyle} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
            {legend}
            <Scatter data={chartData} fill={colors[3]} />
          </ScatterChart>
        );
      case 'radar':
        return (
          <RadarChart outerRadius="70%" data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <PolarGrid stroke="hsl(215 20% 90%)" />
            <PolarAngleAxis dataKey={config.xKey} tick={{ fill: 'hsl(215 16% 47%)', fontSize: 12 }} />
            <PolarRadiusAxis tick={{ fill: 'hsl(215 16% 47%)', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            {legend}
            <Radar dataKey={config.yKey} stroke={colors[3]} fill={colors[3]} fillOpacity={0.3} />
          </RadarChart>
        );
      case 'composed':
        return (
          <ComposedChart {...commonProps} margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
            {grid}
            <XAxis dataKey={config.xKey} tick={axisStyle} axisLine={false} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            {legend}
            <Bar dataKey={config.yKey} fill={colors[2]} radius={[4, 4, 0, 0]} />
            <Line type={curveType} dataKey={config.yKey} stroke={colors[3]} strokeWidth={2} dot={false} />
          </ComposedChart>
        );
      case 'pie':
        return (
          <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <Pie data={chartData} dataKey={config.yKey} nameKey={config.xKey} cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            {legend}
          </PieChart>
        );
      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Unsupported chart type: {chartType}
          </div>
        );
    }
  };

  const renderedChart = renderChart();

  if (!renderedChart || !chartData || chartData.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
        className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md"
        ref={chartRef}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chart</p>
            <h3 className="mt-1 text-base font-semibold text-foreground">{config.title}</h3>
          </div>
        </div>
        <div className="h-72 flex items-center justify-center text-muted-foreground">
          No data available for this chart
        </div>
      </motion.div>
    );
  }

  return (
    hasRenderableChart ? (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md"
      ref={chartRef}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chart</p>
          <h3 className="mt-1 text-base font-semibold text-foreground">{config.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg p-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Customize chart"
              >
                <SlidersHorizontal className="size-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
              <SheetHeader className="pb-4">
                <SheetTitle className="text-lg font-semibold">Chart Settings</SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  Customize chart type, colors, and display options.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Chart Type</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['bar', 'line', 'area', 'pie', 'scatter', 'radar', 'composed'] as LocalChartType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setChartType(type)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          chartType === type 
                            ? 'border-primary bg-primary/10 text-primary' 
                            : 'border-border text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Color Palette</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(PALETTES) as PaletteKey[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPalette(key)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          palette === key 
                            ? 'border-primary bg-primary/10 text-foreground' 
                            : 'border-border text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        <span className="flex gap-1">
                          {PALETTES[key].slice(0, 3).map((color) => (
                            <span key={color} className="size-3 rounded-full" style={{ backgroundColor: color }} />
                          ))}
                        </span>
                        <span className="capitalize">{key}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">X Label</p>
                    <Input
                      value={xLabel}
                      onChange={(e) => setXLabel(e.target.value)}
                      className="rounded-lg border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Y Label</p>
                    <Input
                      value={yLabel}
                      onChange={(e) => setYLabel(e.target.value)}
                      className="rounded-lg border-border"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Display Options</p>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Show Grid</span>
                      <Switch checked={showGrid} onCheckedChange={setShowGrid} />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Show Legend</span>
                      <Switch checked={showLegend} onCheckedChange={setShowLegend} />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Smooth Curves</span>
                      <Switch checked={curved} onCheckedChange={setCurved} />
                    </label>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <button
            type="button"
            onClick={exportPng}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Download as PNG"
          >
            <Download className="size-4" />
          </button>
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {renderedChart}
        </ResponsiveContainer>
      </div>
    </motion.div>
    ) : null
  );
};

export default AnalyticsChart;
