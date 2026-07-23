// Export-related routes
import { sendSuccess, sendError } from '../utils/response-utils.js';
import { HTTP_STATUS, ERROR_CODES } from '../config/constants.js';
import { getDatasetById } from '../database/dataset-repository.js';

export async function handleExportRoutes(request, response, pathname) {
  const { method } = request;

  // GET /api/datasets/:id/export/:format - Export dataset
  if (pathname.match(/^\/api\/datasets\/[^/]+\/export\/(json|csv|md)$/) && method === 'GET') {
    try {
      const parts = pathname.split('/');
      const datasetId = parts[3];
      const format = parts[5];
      
      const dataset = getDatasetById(datasetId);
      
      if (!dataset) {
        sendError(response, HTTP_STATUS.NOT_FOUND, 'Dataset not found', ERROR_CODES.NOT_FOUND);
        return true;
      }
      
      let content;
      let contentType;
      let filename;
      
      switch (format) {
        case 'json':
          content = JSON.stringify(dataset, null, 2);
          contentType = 'application/json';
          filename = `${dataset.name || 'dataset'}.json`;
          break;
          
        case 'csv':
          content = convertToCSV(dataset);
          contentType = 'text/csv';
          filename = `${dataset.name || 'dataset'}.csv`;
          break;
          
        case 'md':
          content = convertToMarkdown(dataset);
          contentType = 'text/markdown';
          filename = `${dataset.name || 'dataset'}.md`;
          break;
          
        default:
          sendError(response, HTTP_STATUS.BAD_REQUEST, 'Unsupported format', ERROR_CODES.VALIDATION_ERROR);
          return true;
      }
      
      // Set headers for file download
      response.setHeader('Content-Type', contentType);
      response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      response.setHeader('Content-Length', Buffer.byteLength(content));
      response.writeHead(200);
      response.end(content);
      
      console.log(`[EXPORT] ✅ Exported dataset as ${format}`);
      return true;
    } catch (error) {
      console.error('Dataset export error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to export dataset', ERROR_CODES.DATABASE_ERROR);
      return true;
    }
  }

  // POST /api/datasets/:id/export/report - Generate report
  if (pathname.match(/^\/api\/datasets\/[^/]+\/export\/report$/) && method === 'POST') {
    try {
      const datasetId = pathname.split('/')[3];
      const dataset = getDatasetById(datasetId);
      
      if (!dataset) {
        sendError(response, HTTP_STATUS.NOT_FOUND, 'Dataset not found', ERROR_CODES.NOT_FOUND);
        return true;
      }
      
      const report = generateReport(dataset);
      
      sendSuccess(response, { report }, 'Report generated');
      return true;
    } catch (error) {
      console.error('Report generation error:', error);
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to generate report', ERROR_CODES.DATABASE_ERROR);
      return true;
    }
  }

  return false;
}

function convertToCSV(dataset) {
  const { rows, columns } = dataset;
  const headers = columns.map(c => c.name);
  const lines = [headers.join(',')];
  
  rows.forEach(row => {
    const values = headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    lines.push(values.join(','));
  });
  
  return lines.join('\n');
}

function convertToMarkdown(dataset) {
  const { rows, columns, name } = dataset;
  let md = `# ${name || 'Dataset Export'}\n\n`;
  md += `**Rows:** ${rows.length}  \n`;
  md += `**Columns:** ${columns.length}  \n\n`;
  
  md += `## Columns\n\n`;
  columns.forEach(c => {
    md += `- **${c.name}**: ${c.type || c.inferredType || 'unknown'}\n`;
  });
  
  md += `\n## Sample Data (first 10 rows)\n\n`;
  md += `| ${columns.map(c => c.name).join(' | ')} |\n`;
  md += `| ${columns.map(() => '---').join(' | ')} |\n`;
  
  rows.slice(0, 10).forEach(row => {
    md += `| ${columns.map(c => row[c.name] ?? '').join(' | ')} |\n`;
  });
  
  return md;
}

function generateReport(dataset) {
  const { rows, columns, name } = dataset;
  const numericCols = columns.filter(c => c.type === 'number' || c.inferredType === 'numeric');
  
  return {
    title: `Analysis Report: ${name || 'Dataset'}`,
    generatedAt: new Date().toISOString(),
    summary: {
      totalRows: rows.length,
      totalColumns: columns.length,
      numericColumns: numericCols.length,
      categoricalColumns: columns.length - numericCols.length
    },
    statistics: numericCols.reduce((acc, col) => {
      const values = rows.map(r => parseFloat(r[col.name])).filter(v => !isNaN(v));
      if (values.length > 0) {
        acc[col.name] = {
          min: Math.min(...values),
          max: Math.max(...values),
          mean: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
          median: values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
        };
      }
      return acc;
    }, {}),
    recommendations: [
      'Consider visualizing numeric distributions',
      'Check for correlations between numeric columns',
      'Look for outliers in the data'
    ]
  };
}

export default { handleExportRoutes };
