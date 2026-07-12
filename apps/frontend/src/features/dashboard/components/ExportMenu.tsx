import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/shared/components/ui/dropdown-menu';
import { toast } from 'sonner';

export function ExportMenu({ dataset, charts, insights, disabled }) {
  const [exporting, setExporting] = useState(null);

  const exportToFormat = async (format) => {
    if (!dataset) {
      toast.error('No data to export');
      return;
    }

    setExporting(format);
    
    try {
      const response = await fetch('/api/automation/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: dataset.name,
          rows: dataset.rows,
          columns: dataset.columns,
          insights,
          charts,
          format
        })
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataset.name || 'report'}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed');
    } finally {
      setExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || exporting !== null}>
          {exporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportToFormat('html')}>
          <FileText className="mr-2 size-4" />
          HTML Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToFormat('pdf')}>
          <FileText className="mr-2 size-4" />
          PDF Document
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => exportToFormat('excel')}>
          <FileSpreadsheet className="mr-2 size-4" />
          Excel Spreadsheet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ExportMenu;