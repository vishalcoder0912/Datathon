import { Dataset } from '@/features/data/model/dataStore';

export function exportDatasetCSV(dataset: Dataset) {
  const headers = dataset.columns.map(c => c.name);
  const csvRows = [
    headers.join(','),
    ...dataset.rows.map(row =>
      headers.map(h => {
        const val = row[h];
        const str = String(val ?? '');
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    ),
  ];

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${dataset.name.replace(/\s+/g, '_').toLowerCase()}_export.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
