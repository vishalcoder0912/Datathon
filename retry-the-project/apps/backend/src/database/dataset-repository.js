import { mkdirSync, existsSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "..", "data");

mkdirSync(dataDir, { recursive: true });

const databasePath = path.join(dataDir, "insightflow.sqlite");
const localDatasetDir = path.join(dataDir, "local-datasets");
mkdirSync(localDatasetDir, { recursive: true });

if (!existsSync(databasePath)) {
  console.log(`[DB] Creating database at: ${databasePath}`);
}
const db = new DatabaseSync(databasePath);
db.exec("PRAGMA busy_timeout = 5000");

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    file_name TEXT,
    uploaded_at TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    column_count INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dataset_columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    sample_json TEXT NOT NULL,
    FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS dataset_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id TEXT NOT NULL,
    row_index INTEGER NOT NULL,
    row_json TEXT NOT NULL,
    FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    sql_text TEXT,
    chart_json TEXT,
    insights_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS dataset_files (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    file_path TEXT,
    optimized_path TEXT,
    size_bytes INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS dataset_schemas (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    schema_json TEXT NOT NULL,
    profile_json TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    column_count INTEGER NOT NULL,
    raw_rows_sent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS column_profiles (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    schema_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    type TEXT,
    profile_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE,
    FOREIGN KEY(schema_id) REFERENCES dataset_schemas(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS dataset_pipeline_runs (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    selected_pipeline TEXT NOT NULL,
    status TEXT NOT NULL,
    policy_json TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS dashboard_artifacts (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    pipeline_run_id TEXT,
    dashboard_json TEXT NOT NULL,
    raw_rows_sent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE,
    FOREIGN KEY(pipeline_run_id) REFERENCES dataset_pipeline_runs(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL,
    dataset_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT,
    widget_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(artifact_id) REFERENCES dashboard_artifacts(id) ON DELETE CASCADE,
    FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    input_json TEXT NOT NULL,
    output_json TEXT,
    raw_rows_sent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agent_tool_calls (
    id TEXT PRIMARY KEY,
    agent_run_id TEXT NOT NULL,
    dataset_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    input_json TEXT NOT NULL,
    output_json TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(agent_run_id) REFERENCES agent_runs(id) ON DELETE CASCADE,
    FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rag_memories (
    id TEXT PRIMARY KEY,
    dataset_id TEXT,
    memory_type TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    content_json TEXT NOT NULL,
    feedback_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_dataset_columns_dataset_id ON dataset_columns(dataset_id);
  CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset_id ON dataset_rows(dataset_id);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_dataset_id ON chat_messages(dataset_id);
  CREATE INDEX IF NOT EXISTS idx_dataset_files_dataset_id ON dataset_files(dataset_id);
  CREATE INDEX IF NOT EXISTS idx_dataset_schemas_dataset_id ON dataset_schemas(dataset_id);
  CREATE INDEX IF NOT EXISTS idx_column_profiles_dataset_id ON column_profiles(dataset_id);
  CREATE INDEX IF NOT EXISTS idx_pipeline_runs_dataset_id ON dataset_pipeline_runs(dataset_id);
  CREATE INDEX IF NOT EXISTS idx_dashboard_artifacts_dataset_id ON dashboard_artifacts(dataset_id);
  CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_artifact_id ON dashboard_widgets(artifact_id);
  CREATE INDEX IF NOT EXISTS idx_agent_runs_dataset_id ON agent_runs(dataset_id);
  CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_run_id ON agent_tool_calls(agent_run_id);
  CREATE INDEX IF NOT EXISTS idx_rag_memories_fingerprint ON rag_memories(fingerprint);
`);

// Migration: Add new columns for local datasets support
try {
  db.exec("ALTER TABLE datasets ADD COLUMN is_local INTEGER DEFAULT 0");
} catch (e) {
  // Column might already exist, ignore error
}

try {
  db.exec("ALTER TABLE datasets ADD COLUMN local_dataset_id TEXT");
} catch (e) {
  // Column might already exist, ignore error
}

try {
  db.exec("CREATE INDEX IF NOT EXISTS idx_datasets_local_id ON datasets(local_dataset_id)");
} catch (e) {
  // Index might already exist, ignore error
}

for (const statement of [
  "ALTER TABLE datasets ADD COLUMN original_file_path TEXT",
  "ALTER TABLE datasets ADD COLUMN optimized_file_path TEXT",
  "ALTER TABLE datasets ADD COLUMN optimized_format TEXT",
]) {
  try {
    db.exec(statement);
  } catch (e) {
    // Column might already exist, ignore error
  }
}

const parseJson = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const withTransaction = (work) => {
  db.exec("BEGIN");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};

const setMeta = db.prepare(`
  INSERT INTO meta (key, value)
  VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

const getMeta = db.prepare("SELECT value FROM meta WHERE key = ?");
const insertDataset = db.prepare(`
  INSERT INTO datasets (
    id,
    name,
    source_type,
    file_name,
    uploaded_at,
    row_count,
    column_count,
    original_file_path,
    optimized_file_path,
    optimized_format
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertDatasetColumn = db.prepare(`
  INSERT INTO dataset_columns (dataset_id, name, type, sample_json)
  VALUES (?, ?, ?, ?)
`);
const insertDatasetRow = db.prepare(`
  INSERT INTO dataset_rows (dataset_id, row_index, row_json)
  VALUES (?, ?, ?)
`);
const insertChatMessage = db.prepare(`
  INSERT INTO chat_messages (id, dataset_id, role, content, sql_text, chart_json, insights_json, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const getDatasetRecord = db.prepare("SELECT * FROM datasets WHERE id = ?");
const listDatasetRecords = db.prepare("SELECT * FROM datasets ORDER BY uploaded_at DESC");
const getDatasetColumns = db.prepare("SELECT name, type, sample_json FROM dataset_columns WHERE dataset_id = ? ORDER BY id ASC");
const getDatasetRows = db.prepare("SELECT id, row_index, row_json FROM dataset_rows WHERE dataset_id = ? ORDER BY row_index ASC");
const getChatMessageRows = db.prepare("SELECT * FROM chat_messages WHERE dataset_id = ? ORDER BY created_at ASC");
const getDatasetRow = db.prepare("SELECT id, row_json FROM dataset_rows WHERE dataset_id = ? AND id = ?");
const updateDatasetRow = db.prepare("UPDATE dataset_rows SET row_json = ? WHERE dataset_id = ? AND id = ?");
const deleteDatasetById = db.prepare("DELETE FROM datasets WHERE id = ?");
const insertDatasetFile = db.prepare(`
  INSERT INTO dataset_files (id, dataset_id, file_path, optimized_path, size_bytes, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const insertDatasetSchema = db.prepare(`
  INSERT INTO dataset_schemas (id, dataset_id, schema_json, profile_json, row_count, column_count, raw_rows_sent, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertColumnProfile = db.prepare(`
  INSERT INTO column_profiles (id, dataset_id, schema_id, name, role, type, profile_json, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const latestDatasetSchema = db.prepare(`
  SELECT * FROM dataset_schemas WHERE dataset_id = ? ORDER BY created_at DESC LIMIT 1
`);
const insertPipelineRun = db.prepare(`
  INSERT INTO dataset_pipeline_runs (id, dataset_id, selected_pipeline, status, policy_json, started_at, finished_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const updatePipelineRun = db.prepare(`
  UPDATE dataset_pipeline_runs SET status = ?, policy_json = ?, finished_at = ? WHERE id = ?
`);
const latestPipelineRun = db.prepare(`
  SELECT * FROM dataset_pipeline_runs WHERE dataset_id = ? ORDER BY started_at DESC LIMIT 1
`);
const insertDashboardArtifact = db.prepare(`
  INSERT INTO dashboard_artifacts (id, dataset_id, pipeline_run_id, dashboard_json, raw_rows_sent, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertDashboardWidget = db.prepare(`
  INSERT INTO dashboard_widgets (id, artifact_id, dataset_id, type, title, widget_json, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const latestDashboardArtifact = db.prepare(`
  SELECT * FROM dashboard_artifacts WHERE dataset_id = ? ORDER BY created_at DESC LIMIT 1
`);
const insertAgentRun = db.prepare(`
  INSERT INTO agent_runs (id, dataset_id, kind, status, input_json, output_json, raw_rows_sent, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateAgentRun = db.prepare(`
  UPDATE agent_runs SET status = ?, output_json = ?, raw_rows_sent = ?, updated_at = ? WHERE id = ?
`);
const insertAgentToolCall = db.prepare(`
  INSERT INTO agent_tool_calls (id, agent_run_id, dataset_id, tool_name, input_json, output_json, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertRagMemory = db.prepare(`
  INSERT INTO rag_memories (id, dataset_id, memory_type, fingerprint, content_json, feedback_json, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const mapDataset = (datasetRecord) => {
  if (!datasetRecord) return null;

  const columns = getDatasetColumns.all(datasetRecord.id).map((column) => ({
    name: column.name,
    type: column.type,
    sample: parseJson(column.sample_json, []),
  }));

  const rows = getDatasetRows.all(datasetRecord.id).map((row) => ({
    __rowId: row.id,
    ...parseJson(row.row_json, {}),
  }));

  return {
    id: datasetRecord.id,
    name: datasetRecord.name,
    columns,
    rows,
    uploadedAt: datasetRecord.uploaded_at,
    rowCount: datasetRecord.row_count,
    sourceType: datasetRecord.source_type,
    fileName: datasetRecord.file_name,
    originalFilePath: datasetRecord.original_file_path || undefined,
    optimizedFilePath: datasetRecord.optimized_file_path || undefined,
    optimizedFormat: datasetRecord.optimized_format || undefined,
    metadata: {
      originalFilePath: datasetRecord.original_file_path || undefined,
      optimizedFilePath: datasetRecord.optimized_file_path || undefined,
      optimizedFormat: datasetRecord.optimized_format || undefined,
      rowCount: datasetRecord.row_count,
    },
  };
};

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function writeDatasetCsvCache(datasetId, columns = [], rows = []) {
  if (!Array.isArray(rows) || !rows.length || !Array.isArray(columns) || !columns.length) {
    return null;
  }

  const filePath = path.join(localDatasetDir, `${datasetId}.csv`);
  const names = columns.map((column) => column.name || String(column)).filter(Boolean);
  const header = names.map(csvEscape).join(",");
  const body = rows.map((row) => names.map((name) => csvEscape(row[name])).join(",")).join("\n");
  writeFileSync(filePath, `${header}\n${body}\n`, "utf8");
  return filePath;
}

export const createDataset = ({
  name,
  fileName = null,
  columns,
  rows,
  rowCount = null,
  sourceType = "upload",
  originalFilePath = null,
  optimizedFilePath = null,
  optimizedFormat = null,
}) => {
  const datasetId = randomUUID();
  const uploadedAt = new Date().toISOString();
  const cleanRows = rows.map((row) =>
    Object.fromEntries(Object.entries(row).filter(([key]) => key !== "__rowId")),
  );
  const csvCachePath = optimizedFilePath || originalFilePath || writeDatasetCsvCache(datasetId, columns, cleanRows);
  const resolvedOptimizedFormat = optimizedFormat || (csvCachePath ? "csv" : null);
  const finalRowCount = Number.isFinite(Number(rowCount)) ? Number(rowCount) : cleanRows.length;

  return withTransaction(() => {
    insertDataset.run(
      datasetId,
      name,
      sourceType,
      fileName,
      uploadedAt,
      finalRowCount,
      columns.length,
      originalFilePath || csvCachePath,
      csvCachePath,
      resolvedOptimizedFormat,
    );

    // Save extra local fields if table supports them
    try {
      if (isLocal) {
        db.prepare("UPDATE datasets SET is_local = 1, local_dataset_id = ? WHERE id = ?").run(localDatasetId || datasetId, datasetId);
      }
    } catch (e) {
      // Ignore if table columns do not exist
    }

    columns.forEach((column) => {
      insertDatasetColumn.run(
        datasetId,
        column.name,
        column.type,
        JSON.stringify(column.sample ?? []),
      );
    });

    cleanRows.forEach((row, index) => {
      insertDatasetRow.run(datasetId, index, JSON.stringify(row));
    });

    setMeta.run("current_dataset_id", datasetId);

    if (csvCachePath) {
      let sizeBytes = 0;
      try {
        sizeBytes = existsSync(csvCachePath) ? statSync(csvCachePath).size : 0;
      } catch {
        sizeBytes = 0;
      }
      insertDatasetFile.run(randomUUID(), datasetId, originalFilePath || csvCachePath, csvCachePath, sizeBytes, uploadedAt);
    }

    return getDatasetById(datasetId);
  });
};

export const getDatasetById = (datasetId) => {
  const sqliteDataset = mapDataset(getDatasetRecord.get(datasetId));
  if (sqliteDataset) return sqliteDataset;

  const e2eStore = globalThis.__INSIGHTFLOW_E2E_STORE__;
  if (e2eStore && e2eStore.datasets && e2eStore.datasets.has(datasetId)) {
    return e2eStore.datasets.get(datasetId);
  }
  return null;
};

const mapDatasetLight = (datasetRecord) => {
  if (!datasetRecord) return null;
  return {
    id: datasetRecord.id,
    name: datasetRecord.name,
    uploadedAt: datasetRecord.uploaded_at,
    rowCount: datasetRecord.row_count,
    columnCount: datasetRecord.column_count,
    sourceType: datasetRecord.source_type,
    fileName: datasetRecord.file_name,
    originalFilePath: datasetRecord.original_file_path || undefined,
    optimizedFilePath: datasetRecord.optimized_file_path || undefined,
    optimizedFormat: datasetRecord.optimized_format || undefined,
  };
};

export const listDatasets = () => {
  const persisted = listDatasetRecords.all().map(mapDatasetLight);

  const e2eStore = globalThis.__INSIGHTFLOW_E2E_STORE__;
  if (e2eStore && e2eStore.datasets) {
    const e2eList = Array.from(e2eStore.datasets.values()).map(d => ({
      id: d.id,
      name: d.name,
      uploadedAt: d.createdAt || d.uploadedAt,
      rowCount: d.rowCount || d.rows?.length || 0,
      columnCount: d.columnCount || d.columns?.length || 0,
      sourceType: d.sourceType,
      fileName: d.fileName,
    }));
    for (const d of e2eList) {
      if (!persisted.some(p => p.id === d.id)) {
        persisted.push(d);
      }
    }
  }

  return persisted;
};

export const getCurrentDatasetId = () => getMeta.get("current_dataset_id")?.value ?? null;

export const getCurrentDataset = () => {
  const currentDatasetId = getCurrentDatasetId();
  if (currentDatasetId) {
    const d = getDatasetById(currentDatasetId);
    if (d) return d;
  }

  const e2eStore = globalThis.__INSIGHTFLOW_E2E_STORE__;
  if (e2eStore && e2eStore.currentDatasetId) {
    return getDatasetById(e2eStore.currentDatasetId);
  }

  return null;
};

export const getChatMessages = (datasetId) =>
  getChatMessageRows.all(datasetId).map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    sql: message.sql_text ?? undefined,
    chart: parseJson(message.chart_json, undefined),
    insights: parseJson(message.insights_json, []),
    timestamp: message.created_at,
  }));

export const saveChatMessages = (datasetId, messages) => {
  withTransaction(() => {
    setMeta.run("current_dataset_id", datasetId);

    messages.forEach((message) => {
      insertChatMessage.run(
        message.id,
        datasetId,
        message.role,
        message.content,
        message.sql ?? null,
        message.chart ? JSON.stringify(message.chart) : null,
        message.insights ? JSON.stringify(message.insights) : null,
        message.timestamp,
      );
    });
  });
};

export const saveChatMessage = (datasetId, message) => {
  saveChatMessages(datasetId, [message]);
};

export const clearChatMessages = (datasetId) => {
  db.prepare("DELETE FROM chat_messages WHERE dataset_id = ?").run(datasetId);
};

export const patchDatasetRow = ({ datasetId, rowId, column, value }) => {
  const existingRow = getDatasetRow.get(datasetId, rowId);
  if (!existingRow) {
    return null;
  }

  const nextRow = {
    ...parseJson(existingRow.row_json, {}),
    [column]: value,
  };

  updateDatasetRow.run(JSON.stringify(nextRow), datasetId, rowId);
  return getDatasetById(datasetId);
};

export const deleteDataset = (datasetId) => {
  const existing = getDatasetRecord.get(datasetId);
  if (!existing) {
    return false;
  }

  withTransaction(() => {
    deleteDatasetById.run(datasetId);
    if (getCurrentDatasetId() === datasetId) {
      setMeta.run("current_dataset_id", "");
    }
  });

  return true;
};

export const getDatabasePath = () => databasePath;

export const saveDatasetSchemaProfile = ({
  datasetId,
  schema,
  profile,
  rawRowsSent = false,
}) => {
  const schemaId = randomUUID();
  const createdAt = new Date().toISOString();
  const columns = Array.isArray(profile?.columns) ? profile.columns : [];

  withTransaction(() => {
    insertDatasetSchema.run(
      schemaId,
      datasetId,
      JSON.stringify(schema || profile || {}),
      JSON.stringify(profile || schema || {}),
      Number(profile?.rowCount || schema?.rowCount || 0),
      Number(profile?.columnCount || columns.length || 0),
      rawRowsSent ? 1 : 0,
      createdAt,
    );

    for (const column of columns) {
      insertColumnProfile.run(
        randomUUID(),
        datasetId,
        schemaId,
        column.name || "",
        column.role || null,
        column.type || null,
        JSON.stringify(column),
        createdAt,
      );
    }
  });

  return { id: schemaId, datasetId, schema, profile, rawRowsSent, createdAt };
};

export const getLatestDatasetSchema = (datasetId) => {
  const row = latestDatasetSchema.get(datasetId);
  if (!row) return null;
  return {
    id: row.id,
    datasetId: row.dataset_id,
    schema: parseJson(row.schema_json, {}),
    profile: parseJson(row.profile_json, {}),
    rawRowsSent: Boolean(row.raw_rows_sent),
    createdAt: row.created_at,
  };
};

export const createDatasetPipelineRun = ({ datasetId, selectedPipeline, policy = {}, status = "running" }) => {
  const id = randomUUID();
  const startedAt = new Date().toISOString();
  insertPipelineRun.run(id, datasetId, selectedPipeline, status, JSON.stringify(policy), startedAt, null);
  return { id, datasetId, selectedPipeline, status, policy, startedAt };
};

export const finishDatasetPipelineRun = ({ runId, status = "completed", policy = {} }) => {
  const finishedAt = new Date().toISOString();
  updatePipelineRun.run(status, JSON.stringify(policy), finishedAt, runId);
  return { id: runId, status, policy, finishedAt };
};

export const getLatestDatasetPipelineRun = (datasetId) => {
  const row = latestPipelineRun.get(datasetId);
  if (!row) return null;
  return {
    id: row.id,
    datasetId: row.dataset_id,
    selectedPipeline: row.selected_pipeline,
    status: row.status,
    policy: parseJson(row.policy_json, {}),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
};

export const saveDashboardArtifact = ({
  datasetId,
  pipelineRunId = null,
  dashboard,
  rawRowsSent = false,
}) => {
  const artifactId = randomUUID();
  const now = new Date().toISOString();
  const widgets = [
    ...(Array.isArray(dashboard?.kpis) ? dashboard.kpis.map((widget) => ({ ...widget, type: "kpi" })) : []),
    ...(Array.isArray(dashboard?.charts) ? dashboard.charts.map((widget) => ({ ...widget, type: widget.type || "chart" })) : []),
  ];

  withTransaction(() => {
    insertDashboardArtifact.run(
      artifactId,
      datasetId,
      pipelineRunId,
      JSON.stringify(dashboard || {}),
      rawRowsSent ? 1 : 0,
      now,
      now,
    );

    for (const widget of widgets) {
      insertDashboardWidget.run(
        randomUUID(),
        artifactId,
        datasetId,
        widget.type || "widget",
        widget.title || null,
        JSON.stringify(widget),
        now,
      );
    }
  });

  return { id: artifactId, datasetId, pipelineRunId, dashboard, rawRowsSent, createdAt: now, updatedAt: now };
};

export const getLatestDashboardArtifact = (datasetId) => {
  const row = latestDashboardArtifact.get(datasetId);
  if (!row) return null;
  return {
    id: row.id,
    datasetId: row.dataset_id,
    pipelineRunId: row.pipeline_run_id,
    dashboard: parseJson(row.dashboard_json, {}),
    rawRowsSent: Boolean(row.raw_rows_sent),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const createAgentRun = ({
  datasetId,
  kind,
  input = {},
  status = "running",
  rawRowsSent = false,
}) => {
  const id = randomUUID();
  const now = new Date().toISOString();
  insertAgentRun.run(id, datasetId, kind, status, JSON.stringify(input), null, rawRowsSent ? 1 : 0, now, now);
  return { id, datasetId, kind, status, input, rawRowsSent, createdAt: now, updatedAt: now };
};

export const finishAgentRun = ({
  runId,
  status = "completed",
  output = {},
  rawRowsSent = false,
}) => {
  const updatedAt = new Date().toISOString();
  updateAgentRun.run(status, JSON.stringify(output), rawRowsSent ? 1 : 0, updatedAt, runId);
  return { id: runId, status, output, rawRowsSent, updatedAt };
};

export const saveAgentToolCall = ({
  agentRunId,
  datasetId,
  toolName,
  input = {},
  output = {},
  status = "completed",
}) => {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  insertAgentToolCall.run(id, agentRunId, datasetId, toolName, JSON.stringify(input), JSON.stringify(output), status, createdAt);
  return { id, agentRunId, datasetId, toolName, input, output, status, createdAt };
};

export const saveRagMemory = ({
  datasetId = null,
  memoryType = "dashboard_pattern",
  fingerprint,
  content = {},
  feedback = null,
}) => {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  insertRagMemory.run(
    id,
    datasetId,
    memoryType,
    fingerprint || datasetId || id,
    JSON.stringify(content),
    feedback ? JSON.stringify(feedback) : null,
    createdAt,
  );
  return { id, datasetId, memoryType, fingerprint, content, feedback, createdAt };
};
