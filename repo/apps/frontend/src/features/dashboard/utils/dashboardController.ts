export interface DashboardCommand {
  action: 'SHOW_ALL' | 'SHOW_CHART' | 'FILTER' | 'GENERATE_CHART' | 'MODIFY_CHART' | 'ANSWER' | 'DELETE' | 'CLEAR' | 'COMPARE' | 'TREND';
  charts?: string[];
  filter?: Record<string, string>;
  chart?: string | {
    type: string;
    x: string;
    y: string;
    aggregation?: string;
  };
  changes?: Record<string, unknown>;
  message?: string;
}

export function processQuery(query: string, datasetColumns: string[]): DashboardCommand {
  const q = query.toLowerCase();
  const cols = datasetColumns.map(c => c.toLowerCase());
  
  if (q.includes('delete') || q.includes('remove chart')) {
    return { action: 'DELETE' };
  }
  
  if (q.includes('clear') && (q.includes('filter') || q.includes('all') || q.includes('reset'))) {
    return { action: 'CLEAR' };
  }
  
  if (q.includes('show all') || q.includes('all chart') || q.includes('everything') || q.includes('full dashboard') || q.includes('reset')) {
    return { action: 'SHOW_ALL' };
  }
  
  const filterPatterns = [
    /filter\s+(?:by|on)\s+(\w+)\s*[=:]\s*(.+)/i,
    /show\s+only\s+(\w+)\s*[=:]\s*(.+)/i,
    /where\s+(\w+)\s*[=:]\s*(.+)/i,
  ];
  
  for (const pattern of filterPatterns) {
    const match = query.match(pattern);
    if (match) {
      const colName = match[1].trim();
      const colValue = match[2].trim().replace(/["']/g, '');
      const foundCol = cols.find(c => c.includes(colName.toLowerCase()));
      if (foundCol) {
        return { action: 'FILTER', filter: { [foundCol]: colValue } };
      }
    }
  }
  
  if (q.includes('salary') && q.includes('country')) {
    return { action: 'SHOW_CHART', charts: ['salary_by_country'] };
  }
  if (q.includes('experience') && q.includes('country')) {
    return { action: 'SHOW_CHART', charts: ['experience_by_country'] };
  }
  if (q.includes('language') || q.includes('popular')) {
    return { action: 'SHOW_CHART', charts: ['language_frequency'] };
  }
  if (q.includes('education')) {
    return { action: 'SHOW_CHART', charts: ['education_distribution', 'salary_by_education'] };
  }
  if (q.includes('salary') && (q.includes('experience') || q.includes('vs') || q.includes('compare'))) {
    return { action: 'SHOW_CHART', charts: ['salary_vs_experience'] };
  }
  
  let chartType = 'bar';
  let chartX = cols[0];
  let chartY = cols.find(c => c.includes('salary') || c.includes('revenue') || c.includes('value')) || cols[1];
  
  if (q.includes('line')) chartType = 'line';
  else if (q.includes('pie') || q.includes('distribution') || q.includes('percentage')) chartType = 'pie';
  else if (q.includes('scatter') || q.includes('correlation')) chartType = 'scatter';
  else if (q.includes('area')) chartType = 'area';
  else if (q.includes('radar')) chartType = 'radar';
  
  const byMatch = q.match(/by\s+(\w+)/);
  if (byMatch) {
    const target = byMatch[1].toLowerCase();
    const found = cols.find(c => c.includes(target));
    if (found) chartX = found;
  }
  
  const forMatch = q.match(/for\s+(\w+)/);
  if (forMatch) {
    const target = forMatch[1].toLowerCase();
    const found = cols.find(c => c.includes(target));
    if (found) chartY = found;
  }
  
  if (q.includes('bar') || q.includes('chart') || q.includes('graph') || q.includes('visual')) {
    if (q.includes('change') || q.includes('modify') || q.includes('switch') || q.includes('convert')) {
      return { action: 'MODIFY_CHART', chart: 'current', changes: { type: chartType } };
    }
    return { action: 'GENERATE_CHART', chart: { type: chartType, x: chartX, y: chartY } };
  }
  
  if (q.includes('change') || q.includes('modify') || q.includes('convert') || q.includes('switch') || q.includes('make it') || q.includes('transform')) {
    const chartMatch = q.match(/(?:chart|graph|to)\s+(\w+)/);
    if (chartMatch) {
      const newType = q.includes('line') ? 'line' : q.includes('pie') ? 'pie' : q.includes('bar') ? 'bar' : q.includes('scatter') ? 'scatter' : q.includes('area') ? 'area' : 'bar';
      return { action: 'MODIFY_CHART', chart: 'current', changes: { type: newType } };
    }
    return { action: 'MODIFY_CHART', chart: 'current', changes: { type: chartType } };
  }
  
  if (q.includes('trend') || q.includes('over time') || q.includes('growth') || q.includes('timeline')) {
    return { action: 'TREND' };
  }
  
  if (q.includes('compare') || q.includes('versus') || q.includes('vs')) {
    return { action: 'COMPARE' };
  }
  
  if (q.includes('what') || q.includes('how') || q.includes('explain') || q.includes('describe') || q.includes('tell me')) {
    let msg = 'Here are some things I can do:\n';
    msg += '• "Show all charts" - Display entire dashboard\n';
    msg += '• "Show salary by country" - Display specific chart\n';
    msg += '• "Create bar chart" - Generate new chart\n';
    msg += '• "Filter by country = USA" - Apply filters\n';
    msg += '• "Change to line chart" - Modify existing chart\n';
    msg += '• "Delete chart" - Remove last chart\n';
    msg += '• "Clear filters" - Reset all filters\n';
    return { action: 'ANSWER', message: msg };
  }
  
  return { action: 'ANSWER', message: `I understood "${query}" but couldn't map it to a dashboard action. Try: "show all charts", "create bar chart", "filter by country = USA", etc.` };
}