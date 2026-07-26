import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', '..', '..', 'data', 'local-datasets');

mkdirSync(dataDir, { recursive: true });

const sanitizeColumns = (columns = []) => {
  const seen = new Set();

  return columns.reduce((acc, column, index) => {
    const rawName = String(column?.name || `column_${index + 1}`).trim();
    const normalizedName = rawName || `column_${index + 1}`;
    const safeBaseName = normalizedName.toLowerCase() === 'id' ? '_source_id' : normalizedName;
    let safeName = safeBaseName;
    let suffix = 1;

    while (seen.has(safeName.toLowerCase())) {
      safeName = `${safeBaseName}_${suffix++}`;
    }

    seen.add(safeName.toLowerCase());
    acc.push({
      ...column,
      name: safeName,
      originalName: rawName,
    });
    return acc;
  }, []);
};

/**
 * Creates a local SQLite database from uploaded file data
 * @param {Object} dataset - Dataset with schema and data
 * @returns {Object} Database info with path and ID
 */
export const createLocalDatabase = (dataset) => {
  const datasetId = randomUUID();
  const dbPath = path.join(dataDir, `${datasetId}.sqlite`);

  const db = new DatabaseSync(dbPath);

  // Create table based on schema
  const columns = sanitizeColumns(dataset.columns || []);
  const columnDefs = columns.map(col => {
    let sqlType = 'TEXT';
    if (col.type === 'number') sqlType = 'REAL';
    else if (col.type === 'date') sqlType = 'TEXT';
    return `"${col.name}" ${sqlType}`;
  }).join(', ');

  db.exec(`
    CREATE TABLE IF NOT EXISTS dataset (
      __row_id INTEGER PRIMARY KEY AUTOINCREMENT,
      ${columnDefs}
    );
  `);

  // Insert data in batches for performance
  const rows = dataset.rows || [];
  const batchSize = 1000;

  const insert = db.prepare(`
    INSERT INTO dataset (${columns.map(c => `"${c.name}"`).join(', ')})
    VALUES (${columns.map(() => '?').join(', ')})
  `);

  db.exec('BEGIN TRANSACTION');

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    for (const row of batch) {
      const values = columns.map(col => {
        const val = row[col.originalName] ?? row[col.name];
        if (val === null || val === undefined) return null;
        if (col.type === 'number') return Number(val) || 0;
        return String(val);
      });
      insert.run(...values);
    }
  }

  db.exec('COMMIT');
  db.close();

  return {
    datasetId,
    dbPath,
    rowCount: rows.length,
    columnCount: columns.length,
  };
};

/**
 * Executes a SQL query on a local database
 * @param {string} datasetId - Dataset ID
 * @param {string} sql - SQL query to execute
 * @param {number} page - Page number (0-indexed)
 * @param {number} limit - Results per page
 * @returns {Object} Query results with pagination info
 */
export const executeLocalQuery = (datasetId, sql, page = 0, limit = 100) => {
  const dbPath = path.join(dataDir, `${datasetId}.sqlite`);

  if (!existsSync(dbPath)) {
    throw new Error('Local database not found');
  }

  const db = new DatabaseSync(dbPath);

  try {
    // Validate SQL
    const upperSQL = sql.toUpperCase();
    const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE'];
    for (const keyword of dangerousKeywords) {
      if (upperSQL.includes(keyword)) {
        throw new Error(`Dangerous SQL keyword detected: ${keyword}`);
      }
    }

    // Add pagination if not present
    let paginatedSQL = sql;
    if (!upperSQL.includes('LIMIT')) {
      paginatedSQL = `${sql} LIMIT ${limit} OFFSET ${page * limit}`;
    }

    const normalizedSQL = sql.replace(/\bdataset\b/gi, 'dataset').replace(/\bdata\b/gi, 'dataset');
    const finalSQL = upperSQL.includes('LIMIT')
      ? normalizedSQL
      : `${normalizedSQL} LIMIT ${limit} OFFSET ${page * limit}`;

    const results = db.prepare(finalSQL).all();

    // Get column names from results
    const columns = results.length > 0 ? Object.keys(results[0]) : [];

    // Get total count for pagination
    const countSQL = normalizedSQL
      .replace(/SELECT\s+.*?\s+FROM/i, 'SELECT COUNT(*) FROM')
      .split('ORDER BY')[0]
      .split('LIMIT')[0];
    const totalCount = db.prepare(countSQL).get()['COUNT(*)'] || results.length;

    db.close();

    return {
      data: results,
      columns,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  } catch (error) {
    db.close();
    throw new Error(`Query execution failed: ${error.message}`);
  }
};

/**
 * Gets data from local database with pagination
 * @param {string} datasetId - Dataset ID
 * @param {number} page - Page number (0-indexed)
 * @param {number} limit - Results per page
 * @returns {Object} Data with pagination info
 */
export const getLocalData = (datasetId, page = 0, limit = 100) => {
  const dbPath = path.join(dataDir, `${datasetId}.sqlite`);

  if (!existsSync(dbPath)) {
    throw new Error('Local database not found');
  }

  const db = new DatabaseSync(dbPath);

  try {
    const offset = page * limit;
    const rows = db.prepare(`SELECT * FROM dataset LIMIT ${limit} OFFSET ${offset}`).all();
    
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM dataset').get().count;
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    db.close();

    return {
      data: rows,
      columns,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  } catch (error) {
    db.close();
    throw new Error(`Failed to get data: ${error.message}`);
  }
};

/**
 * Deletes a local database
 * @param {string} datasetId - Dataset ID
 */
export const deleteLocalDatabase = (datasetId) => {
  const dbPath = path.join(dataDir, `${datasetId}.sqlite`);

  if (existsSync(dbPath)) {
    // Note: In a real implementation, you'd use fs.unlink here
    // For now, we'll just log
    console.log(`Local database marked for deletion: ${dbPath}`);
  }
};

/**
 * Gets database file path for a dataset
 * @param {string} datasetId - Dataset ID
 * @returns {string} Database file path
 */
export const getDatabasePath = (datasetId) => {
  return path.join(dataDir, `${datasetId}.sqlite`);
};
