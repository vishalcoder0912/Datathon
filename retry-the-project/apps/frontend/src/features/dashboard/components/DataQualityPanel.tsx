import { AlertTriangle, CheckCircle2, AlertCircle, XCircle, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import { DataQualityReport } from '@/features/data/model/dataStore';
import { cn } from '@/shared/lib/utils';

interface DataQualityPanelProps {
  qualityReport: DataQualityReport | null;
}

const DataQualityPanel = ({ qualityReport }: DataQualityPanelProps) => {
  if (!qualityReport) return null;

  const { summary, issues, columnStats } = qualityReport;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="size-4 text-red-500" />;
      case 'high': return <AlertCircle className="size-4 text-amber-500" />;
      case 'medium': return <AlertTriangle className="size-4 text-yellow-500" />;
      default: return <AlertCircle className="size-4 text-muted-foreground" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <ShieldCheck className="size-5 text-green-600" />;
    if (score >= 70) return <ShieldAlert className="size-5 text-amber-600" />;
    return <ShieldX className="size-5 text-red-600" />;
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          {getScoreIcon(summary.qualityScore)}
          <div>
            <p className="text-base font-semibold text-foreground">Data Quality Report</p>
            <p className="text-sm text-muted-foreground">Automated validation results</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn('text-3xl font-bold', getScoreColor(summary.qualityScore))}>
            {summary.qualityScore}%
          </p>
          <p className="text-xs text-muted-foreground">Quality Score</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
        <div className={cn(
          'rounded-lg border p-3',
          summary.duplicates > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'
        )}>
          <p className="text-xs font-medium text-muted-foreground">Duplicates</p>
          <p className={cn(
            'text-xl font-semibold mt-1',
            summary.duplicates > 0 ? 'text-amber-600' : 'text-green-600'
          )}>
            {summary.duplicates}
          </p>
        </div>
        <div className={cn(
          'rounded-lg border p-3',
          summary.outliers > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'
        )}>
          <p className="text-xs font-medium text-muted-foreground">Outliers</p>
          <p className={cn(
            'text-xl font-semibold mt-1',
            summary.outliers > 0 ? 'text-amber-600' : 'text-green-600'
          )}>
            {summary.outliers}
          </p>
        </div>
        <div className={cn(
          'rounded-lg border p-3',
          summary.missingValues > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'
        )}>
          <p className="text-xs font-medium text-muted-foreground">Missing</p>
          <p className={cn(
            'text-xl font-semibold mt-1',
            summary.missingValues > 0 ? 'text-amber-600' : 'text-green-600'
          )}>
            {summary.missingValues}
          </p>
        </div>
        <div className={cn(
          'rounded-lg border p-3',
          summary.invalidValues > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
        )}>
          <p className="text-xs font-medium text-muted-foreground">Invalid</p>
          <p className={cn(
            'text-xl font-semibold mt-1',
            summary.invalidValues > 0 ? 'text-red-600' : 'text-green-600'
          )}>
            {summary.invalidValues}
          </p>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="pt-4 border-t border-border/50">
          <p className="text-sm font-medium text-foreground mb-3">Detected Issues</p>
          <div className="space-y-2">
            {issues.slice(0, 6).map((issue, idx) => (
              <div key={idx} className="flex items-start gap-3 text-sm">
                {getSeverityIcon(issue.severity)}
                <span className="text-foreground flex-1">{issue.message}</span>
                <span className="text-xs text-muted-foreground">({issue.count})</span>
              </div>
            ))}
            {issues.length > 6 && (
              <p className="text-xs text-muted-foreground text-center pt-2">+{issues.length - 6} more issues</p>
            )}
          </div>
        </div>
      )}

      {columnStats.some(c => c.missing > 0 || c.outliers > 0 || c.invalid > 0) && (
        <div className="pt-4 border-t border-border/50 mt-4">
          <p className="text-sm font-medium text-foreground mb-3">Column Statistics</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Column</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Missing</th>
                  <th className="pb-2 font-medium">Outliers</th>
                  <th className="pb-2 font-medium">Invalid</th>
                </tr>
              </thead>
              <tbody>
                {columnStats.filter(c => c.missing > 0 || c.outliers > 0 || c.invalid > 0).map((col, idx) => (
                  <tr key={idx} className="border-t border-border/50">
                    <td className="py-2 text-foreground font-medium">{col.name}</td>
                    <td className="py-2 text-muted-foreground">{col.type}</td>
                    <td className={col.missing > 0 ? 'text-amber-600' : 'text-green-600'}>{col.missing}</td>
                    <td className={col.outliers > 0 ? 'text-amber-600' : 'text-green-600'}>{col.outliers}</td>
                    <td className={col.invalid > 0 ? 'text-red-600' : 'text-green-600'}>{col.invalid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataQualityPanel;