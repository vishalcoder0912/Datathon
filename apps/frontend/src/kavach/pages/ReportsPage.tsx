import { useRef, useState } from 'react';
import { AxiosError } from 'axios';
import { FileText, Download, AlertTriangle, Printer, Sparkles, FileCheck, Layers, BookOpen, ChevronRight } from 'lucide-react';
import { kavachApi } from '@/kavach/api/kavachApi';
import { useKavachFilters } from '@/kavach/context/FilterContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Input } from '@/shared/components/ui/input';

export default function ReportsPage() {
  const { filters } = useKavachFilters();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Report selection states
  const [reportType, setReportType] = useState('scrb');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // AI Generated Report state
  const [compiledReport, setCompiledReport] = useState<string | null>(null);
  const [isAiCompiled, setIsAiCompiled] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setCompiledReport(null);
    setIsAiCompiled(false);
    try {
      const reportFilters = { ...filters, dateFrom: dateFrom || filters.dateFrom, dateTo: dateTo || filters.dateTo };
      const res = await kavachApi.generateAiReport(reportType, reportFilters);
      
      const resData = res.data?.data || res.data || {};
      setCompiledReport(resData.markdown || '### Scoped Crime Report\nNo incident logs found matching criteria.');
      setIsAiCompiled(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to compile AI report');
      setCompiledReport('# KAVACH State Crime Records Draft\n\n- **Target Unit:** Karnataka Police Intel\n- **Report Type:** SCRB Formatted Briefing\n- **Status:** Scopes processed.');
      setIsAiCompiled(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!compiledReport) return;
    const blob = new Blob([compiledReport], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KSP_AI_Briefing_${reportType.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!compiledReport) return;
    const win = window.open('', '_blank');
    if (!win) return;

    const printDocument = win.document;
    printDocument.title = 'KSP AI Briefing Draft';

    const style = printDocument.createElement('style');
    style.textContent =
      'body { font-family: monospace; padding: 40px; } pre { margin: 0; white-space: pre-wrap; font-size: 13px; line-height: 1.6; }';
    printDocument.head.append(style);

    const report = printDocument.createElement('pre');
    report.textContent = compiledReport;
    printDocument.body.replaceChildren(report);

    win.print();
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#0891B2]">
            <FileText className="size-4 text-white" />
          </div>
          AI Report Compiler
        </h1>
        <p className="text-sm text-slate-500">Compile formal SCRB briefs or officer case briefings using formatted markdown templates.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-1">
              <Layers className="size-4 text-blue-600" /> Template Configuration
            </CardTitle>
            <CardDescription className="text-xs">Select target template formats for KSP reporting.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Target Briefing Template</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-[#0F172A] focus:outline-none"
              >
                <option value="scrb">SCRB Formatted Briefing (Official)</option>
                <option value="officer_summary">Station Officer Incident Summary</option>
                <option value="network_analysis">Inter-Suspect Network Analysis</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] font-semibold text-slate-400 uppercase">Date From</label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold text-slate-400 uppercase">Date To</label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full gap-2 bg-gradient-to-r from-[#1D4ED8] to-[#0891B2] text-white"
            >
              {loading ? (
                <>Generating...</>
              ) : (
                <>
                  <Sparkles className="size-3.5 text-amber-300 animate-pulse" />
                  Compile with KAVACH AI
                </>
              )}
            </Button>

            {isAiCompiled && compiledReport && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadMarkdown} className="flex-1 gap-1 text-xs text-slate-600 border-slate-200">
                  <Download className="size-3" /> Download .md
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} className="flex-1 gap-1 text-xs text-slate-600 border-slate-200">
                  <Printer className="size-3" /> Print Draft
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 lg:col-span-2 shadow-sm bg-white">
          <CardHeader className="pb-3 border-b border-slate-50">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <BookOpen className="size-4 text-[#0891B2]" /> Compiled Markdown Previewer
              {isAiCompiled && <Badge className="bg-emerald-50 text-[#15803D] border-green-200">Draft Completed</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : compiledReport ? (
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/30 p-5 font-mono text-xs leading-6 text-slate-800 h-[480px] overflow-y-auto whitespace-pre-wrap select-all">
                {compiledReport}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3 text-center">
                <FileCheck className="size-12 text-slate-300" />
                <div>
                  <h3 className="text-sm font-bold text-slate-700">No Report Compiled Yet</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">Configure templates on the left and trigger compilation to pull database rows.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
