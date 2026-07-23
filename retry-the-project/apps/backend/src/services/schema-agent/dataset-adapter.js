import { getDatasetById } from '../../database/dataset-repository.js';

function getE2EDataset(datasetId) {
  return globalThis.__INSIGHTFLOW_E2E_STORE__?.datasets?.get(datasetId) || null;
}

function findDataset(datasetId) {
  return getDatasetById(datasetId) || getE2EDataset(datasetId);
}

export async function getDatasetRowsById(datasetId) {
  const dataset = findDataset(datasetId);

  if (!dataset) {
    const error = new Error(`Dataset not found: ${datasetId}`);
    error.statusCode = 404;
    throw error;
  }

  return Array.isArray(dataset.rows) ? dataset.rows : dataset.data || [];
}

export async function getDatasetMetadataById(datasetId) {
  const dataset = findDataset(datasetId);

  if (!dataset) {
    const error = new Error(`Dataset not found: ${datasetId}`);
    error.statusCode = 404;
    throw error;
  }

  return {
    datasetId,
    name: dataset.name,
    fileName: dataset.fileName,
    uploadedAt: dataset.uploadedAt || dataset.createdAt,
    rowCount: dataset.rowCount || dataset.rows?.length || 0,
    columnCount: dataset.columnCount || dataset.columns?.length || 0,
    columns: dataset.columns || [],
    sourceType: dataset.sourceType,
  };
}
