import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, DollarSign, Package, Percent, Star, Table2, Columns3, BarChart3, ArrowUpRight, ArrowDownRight, Shield, Globe, Code, AlertTriangle, Siren } from 'lucide-react';
import { KPI } from '@/features/data/model/dataStore';
import { cn } from '@/shared/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  dollar: DollarSign,
  package: Package,
  percent: Percent,
  star: Star,
  rows: Table2,
  columns: Columns3,
  chart: BarChart3,
  shield: Shield,
  globe: Globe,
  code: Code,
  alert: AlertTriangle,
  risk: Siren,
};

const statusColors: Record<string, string> = {
  good: 'border-success/40 bg-success/10 text-success',
  warning: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-500',
  critical: 'border-destructive/40 bg-destructive/10 text-destructive',
};

const trendColors: Record<string, string> = {
  up: 'text-success',
  down: 'text-destructive',
  stable: 'text-muted-foreground',
};

interface KPICardProps {
  kpi: KPI;
  index: number;
}

const KPICard = ({ kpi, index }: KPICardProps) => {
  if (kpi.businessKpi !== true) return null;

  const Icon = iconMap[kpi.icon] || DollarSign;
  const trend = kpi.trend ?? 'stable';
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const isPositive = (kpi.change ?? 0) >= 0;
  const sparklineValues = kpi.sparkline ?? [];
  const maxValue = sparklineValues.length > 0 ? Math.max(...sparklineValues) : 0;
  const minValue = sparklineValues.length > 0 ? Math.min(...sparklineValues) : 0;
  const range = maxValue - minValue || 1;
  const points = sparklineValues.map((value, pointIndex) => {
    const x = sparklineValues.length === 1 ? 100 : (pointIndex / Math.max(sparklineValues.length - 1, 1)) * 100;
    const y = 28 - (((value - minValue) / range) * 24);
    return `${x},${y}`;
  }).join(' ');

  const colorSchemes = [
    { bg: 'bg-blue-50', border: 'border-blue-100', icon: 'text-blue-600', trend: 'text-blue-600', trendBg: 'bg-blue-50' },
    { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: 'text-emerald-600', trend: 'text-emerald-600', trendBg: 'bg-emerald-50' },
    { bg: 'bg-violet-50', border: 'border-violet-100', icon: 'text-violet-600', trend: 'text-violet-600', trendBg: 'bg-violet-50' },
    { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'text-amber-600', trend: 'text-amber-600', trendBg: 'bg-amber-50' },
  ];
  const scheme = colorSchemes[index % colorSchemes.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -2 }}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md',
        scheme.border
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn('flex size-10 items-center justify-center rounded-lg', scheme.bg)}>
          <Icon className={cn('size-5', scheme.icon)} />
        </div>
        {kpi.change !== undefined && (
          <div className={cn('flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium', scheme.trendBg, scheme.trend)}>
            {isPositive ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            <span>{Math.abs(kpi.change ?? 0)}%</span>
          </div>
        )}
      </div>
      
      <div className="mt-4">
        <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{kpi.value}</p>
      </div>
    </motion.div>
  );
};

export default KPICard;
