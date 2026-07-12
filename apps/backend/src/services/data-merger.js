import { randomUUID } from "node:crypto";

function normalizeColumnName(name) {
  if (!name || typeof name !== 'string') return name;
  return name.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function preprocessRow(row, columnMapping) {
  const normalized = {};
  for (const [originalKey, value] of Object.entries(row)) {
    const newKey = columnMapping[originalKey] || normalizeColumnName(originalKey) || originalKey;
    normalized[newKey] = value;
  }
  return normalized;
}

export function mergeDatasets(datasets) {
  if (!datasets || datasets.length === 0) {
    return null;
  }

  if (datasets.length === 1) {
    return preprocessSingleDataset(datasets[0]);
  }

  const columnMapping = {};
  const allNormalizedColumns = new Set();
  const columnTypes = {};
  
  datasets.forEach(ds => {
    (ds.columns || []).forEach(col => {
      const normalizedName = normalizeColumnName(col.name) || col.name;
      columnMapping[col.name] = normalizedName;
      allNormalizedColumns.add(normalizedName);
      if (!columnTypes[normalizedName]) {
        columnTypes[normalizedName] = col.type;
      } else if (columnTypes[normalizedName] !== col.type) {
        columnTypes[normalizedName] = inferMergedType(columnTypes[normalizedName], col.type);
      }
    });
  });

  const mergedColumns = Array.from(allNormalizedColumns).map(name => ({
    name,
    type: columnTypes[name] || 'string',
    sample: []
  }));

  if (datasets.length > 1) {
    mergedColumns.push({
      name: '__sourceFile',
      type: 'string',
      sample: datasets.slice(0, 3).map(d => d.name || 'unknown')
    });
  }

  const allRows = [];
  datasets.forEach(ds => {
    const sourceName = ds.name || 'unknown';
    (ds.rows || []).forEach(row => {
      const normalizedRow = preprocessRow(row, columnMapping);
      allRows.push({ ...normalizedRow, __sourceFile: sourceName });
    });
  });

  let rowId = 0;
  const finalRows = allRows.map(row => {
    const newRow = { __rowId: rowId++ };
    allNormalizedColumns.forEach(col => {
      newRow[col] = row[col] ?? null;
    });
    if (row.__sourceFile) {
      newRow.__sourceFile = row.__sourceFile;
    }
    return newRow;
  });

  const mergedName = datasets.length > 1 
    ? `Combined (${datasets.map(d => normalizeColumnName(d.name) || 'Data').join(', ')})`
    : normalizeColumnName(datasets[0]?.name) || 'Merged Dataset';

  return {
    id: randomUUID(),
    name: mergedName,
    columns: mergedColumns,
    rows: finalRows,
    rowCount: finalRows.length,
    sourceType: 'merged',
    uploadedAt: new Date().toISOString(),
    sourceFiles: datasets.map(d => d.name || 'Unknown'),
    _metadata: {
      originalDatasets: datasets.length,
      totalRows: finalRows.length,
      mergedAt: new Date().toISOString()
    }
  };
}

function preprocessSingleDataset(dataset) {
  if (!dataset) return dataset;
  const columnMapping = {};
  const normalizedColumns = (dataset.columns || []).map(col => {
    const normalizedName = normalizeColumnName(col.name) || col.name;
    columnMapping[col.name] = normalizedName;
    return { ...col, name: normalizedName };
  });
  const normalizedRows = (dataset.rows || []).map(row => preprocessRow(row, columnMapping));
  return {
    ...dataset,
    columns: normalizedColumns,
    rows: normalizedRows,
    rowCount: normalizedRows.length
  };
}

function inferMergedType(type1, type2) {
  if (type1 === type2) return type1;
  if (type1 === 'number' || type2 === 'number') return 'number';
  if (type1 === 'date' || type2 === 'date') return 'date';
  return 'string';
}

export function detectCompatibleColumns(datasets) {
  const columnMap = new Map();
  
  datasets.forEach(ds => {
    (ds.columns || []).forEach(col => {
      if (!columnMap.has(col.name)) {
        columnMap.set(col.name, {
          name: col.name,
          type: col.type,
          sources: new Set()
        });
      }
      const entry = columnMap.get(col.name);
      entry.sources.add(ds.name || 'unknown');
      if (entry.type !== col.type) {
        entry.type = inferMergedType(entry.type, col.type);
      }
    });
  });

  return Array.from(columnMap.values()).map(entry => ({
    name: entry.name,
    type: entry.type,
    appearsIn: entry.sources.size,
    isCommon: entry.sources.size === datasets.length
  }));
}

export function buildUnifiedSchema(datasets) {
  if (!datasets || datasets.length === 0) {
    return null;
  }

  const merged = mergeDatasets(datasets);
  const compatibleColumns = detectCompatibleColumns(datasets);

  return {
    mergedDataset: merged,
    columnAnalysis: compatibleColumns,
    summary: {
      totalDatasets: datasets.length,
      totalColumns: compatibleColumns.length,
      commonColumns: compatibleColumns.filter(c => c.isCommon).length,
      uniqueColumns: compatibleColumns.filter(c => !c.isCommon).length
    },
    detectedDataTypes: detectDataTypes(compatibleColumns, merged.rows)
  };
}

function detectDataTypes(columns, rows) {
  const types = {
    SALES: ['revenue', 'sales', 'profit', 'amount', 'quantity', 'units', 'orders', 'customer', 'region', 'category', 'product'],
    INVENTORY: ['inventory', 'stock', 'sku', 'warehouse', 'reorder'],
    MARKETING: ['campaign', 'impression', 'click', 'conversion', 'ctr', 'cost', 'lead'],
    HR: ['employee', 'salary', 'department', 'hire', 'performance'],
    FINANCE: ['expense', 'budget', 'income', 'balance', 'asset', 'liability']
  };

  const columnNames = columns.map(c => c.name.toLowerCase());
  const detected = [];

  for (const [dataType, keywords] of Object.entries(types)) {
    const matches = keywords.filter(kw => columnNames.some(cn => cn.includes(kw)));
    if (matches.length >= 2) {
      detected.push({ type: dataType, confidence: matches.length / keywords.length, matches });
    }
  }

  return detected.sort((a, b) => b.confidence - a.confidence);
}

export default { mergeDatasets, detectCompatibleColumns, buildUnifiedSchema };
