import { useRef, useState } from 'react';
import { AxiosError } from 'axios';
import { FileText, Download, AlertTriangle, Printer } from 'lucide-react';
import { kavachApi } from '@/kavach/api/kavachApi';
import { useKavachFilters } from '@/kavach/context/FilterContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Input } from '@/shared/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/shared/components/ui/select';

const REPORT_SECTIONS = [
  'Executive Summary',
  'Filters Applied',
  'KPI Overview',
  'Crime Trends',
  'Hotspots',
  'Alerts',
  'Multiple Case Links',
  'Network Findings',
  'District Risk Scores',
  'Socioeconomic Findings',
  'Methodology',
  'Limitations',
];

export default function ReportsPage() {
  const { filters } = useKavachFilters();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const reportPdfBase64Ref = useRef<string | null>(null);
  const reportFilenameRef = useRef<string | null>(null);
  const [format, setFormat] = useState('html');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setReportGenerated(false);
    setReportHtml(null);
    reportPdfBase64Ref.current = null;
    reportFilenameRef.current = null;
    try {
      const reportFilters = { ...filters, dateFrom: dateFrom || filters.dateFrom, dateTo: dateTo || filters.dateTo };
      const res = await kavachApi.generateReport(reportFilters, format);
      setReportGenerated(true);
      const payload = typeof res.data === 'string'
        ? {html: res.data}
        : res.data?.data ?? res.data ?? {};
      const htmlContent = typeof payload.html === 'string' ? payload.html : '';
      setReportHtml(htmlContent || null);
      reportPdfBase64Ref.current = typeof payload.pdfBase64 === 'string' ? payload.pdfBase64 : null;
      reportFilenameRef.current = typeof payload.filename === 'string' ? payload.filename : null;
    } catch (err: unknown) {
      const message = err instanceof AxiosError ? err.message : 'Failed to generate report';
      setError(message);
      setReportGenerated(true);
      setReportHtml(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const reportPdfBase64 = reportPdfBase64Ref.current;
    if (!reportHtml && !reportPdfBase64) return;
    const bytes = reportPdfBase64 ? Uint8Array.from(atob(reportPdfBase64), (character) => character.charCodeAt(0)) : null;
    const blob = bytes
      ? new Blob([bytes], {type: 'application/pdf'})
      : new Blob([reportHtml ?? ''], {type: 'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = reportFilenameRef.current ?? `KAVACH_Report_${new Date().toISOString().slice(0, 10)}.${bytes ? 'pdf' : 'html'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const reportPdfBase64 = reportPdfBase64Ref.current;
    if (reportPdfBase64) {
      const bytes = Uint8Array.from(atob(reportPdfBase64), (character) => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], {type: 'application/pdf'}));
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }
    if (!reportHtml) return;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(reportHtml);
      win.document.close();
      win.print();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0F172A]">Reports</h1>
        <p className="text-sm text-slate-500">Generate and download intelligence reports</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-sm font-semibold text-slate-700">Report Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Date From</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Date To</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Format</label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="html">HTML</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full gap-2 bg-[#1D4ED8]"
            >
              <FileText className="size-4" />
              {loading ? 'Generating...' : 'Generate Report'}
            </Button>

            {reportGenerated && !error && reportHtml && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownload} className="flex-1 gap-1 text-xs">
                  <Download className="size-3" /> Download
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} className="flex-1 gap-1 text-xs">
                  <Printer className="size-3" /> Print
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <FileText className="size-4" /> Report Preview
              {reportGenerated && <Badge className="bg-[#15803D]">Generated</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : reportHtml ? (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <iframe
                  srcDoc={reportHtml}
                  title="Report Preview"
                  className="h-[600px] w-full"
                  sandbox="allow-same-origin"
                />
              </div>
            ) : reportGenerated && !error ? (
              <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
                <FileText className="size-8" />
                <p className="text-sm">Report generated successfully. Download or print to view.</p>
                <p className="text-xs text-slate-400">(No preview available for current format)</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 py-10 text-[#DC2626]">
                <AlertTriangle className="size-8" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-10 text-slate-400">
                <FileText className="size-12" />
                <p className="text-sm">Configure and generate a report</p>
                <ul className="mt-4 space-y-1 text-xs">
                  {REPORT_SECTIONS.map((s) => (
                    <li key={s} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-[#1D4ED8]" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
