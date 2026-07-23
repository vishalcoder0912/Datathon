import { useState } from 'react';
import { Download } from 'lucide-react';
import { useData } from '@/features/data/context/useData';
import { api } from '@/features/data/api/dataApi';

const ExportPage = () => {
  const { dataset } = useData();
  const [exporting, setExporting] = useState(false);

  const exportData = async (format: 'json' | 'csv' | 'md') => {
    if (!dataset) return;
    
    setExporting(true);
    try {
      const blob = await api.exportDataset(dataset.id, format);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analysis.${format === 'md' ? 'markdown' : format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExporting(false);
    }
  };

  const formats = [
    { format: 'json', title: 'JSON', desc: 'Complete analysis data' },
    { format: 'csv', title: 'CSV', desc: 'Spreadsheet format' },
    { format: 'md', title: 'Markdown', desc: 'Report format' },
  ];

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Export Analysis</h1>
      
      <div className="grid grid-cols-3 gap-4">
        {formats.map(({ format, title, desc }) => (
          <button type="button"
            key={format}
            onClick={() => exportData(format)}
            disabled={exporting}
            className="p-6 border rounded hover:shadow-lg transition flex flex-col items-center gap-3 disabled:opacity-50"
          >
            <Download className="size-8" />
            <div className="font-semibold">{title}</div>
            <div className="text-sm text-gray-600">{desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ExportPage;