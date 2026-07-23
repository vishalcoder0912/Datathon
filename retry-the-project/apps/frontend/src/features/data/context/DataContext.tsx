import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { api, DatasetImportPayload } from '@/features/data/api/dataApi';
import { ChatMessage, DataColumn, Dataset, DatasetAnalysis, DatasetCellValue, DatasetRow } from '@/features/data/model/dataStore';
import { DataContext } from '@/features/data/context/data-context-store';

const toNumber = (value: string) => {
  const normalized = value.replace(/[$,€£₹%\s]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

function inferType(name: string, values: string[]): DataColumn["type"] {
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (/^(lat|latitude)$/.test(normalizedName)) return "latitude";
  if (/^(lng|lon|long|longitude)$/.test(normalizedName)) return "longitude";
  if (/country|nation/.test(normalizedName)) return "country";
  if (/city|town|municipality/.test(normalizedName)) return "city";

  const sample = values.map((value) => String(value ?? "").trim()).filter(Boolean).slice(0, 50);
  if (sample.length === 0) return "string";

  const numericCount = sample.filter((value) => toNumber(value) !== null).length;
  const dateCount = sample.filter((value) => !Number.isNaN(Date.parse(value))).length;
  const booleanCount = sample.filter((value) => /^(true|false|yes|no|0|1)$/i.test(value)).length;
  const uniqueCount = new Set(sample.map((value) => value.toLowerCase())).size;

  if (booleanCount / sample.length > 0.85) return "boolean";
  if (dateCount / sample.length > 0.85) {
    return sample.some((value) => /:\d{2}/.test(value)) ? "datetime" : "date";
  }
  if (numericCount / sample.length > 0.85) {
    if (sample.some((value) => /%/.test(value)) || /percent|rate|ratio/.test(normalizedName)) return "percentage";
    if (sample.some((value) => /[$€£₹]/.test(value)) || /salary|revenue|sales|profit|amount|price|cost|income|usd|inr/.test(normalizedName)) return "currency";
    return "number";
  }
  if (uniqueCount <= Math.max(12, sample.length * 0.45)) return "category";
  return sample.some((value) => value.length > 80) ? "text" : "string";
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unable to connect to the local API.';

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const normalizeCellValue = (value: unknown): DatasetCellValue => {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return JSON.stringify(value);
};

const normalizeDatasetRow = (value: unknown): DatasetRow => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, normalizeCellValue(entryValue)]),
  );
};

const looksLikeDictionaryRow = (row: DatasetRow) => {
  const keys = Object.keys(row).map((key) =>
    key.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
  );
  const source = String(row._source_file ?? row._sourceFile ?? row.source ?? "").toLowerCase();

  return (
    source.includes("dictionary") ||
    (keys.includes("column") &&
      (keys.includes("type") || keys.includes("data_type")) &&
      (keys.includes("description") || keys.includes("definition")))
  );
};

const normalizeDataset = (dataset: Dataset | null): Dataset | null => {
  if (!dataset) return null;

  const columns = Array.isArray(dataset.columns) ? dataset.columns : [];
  const rows = Array.isArray(dataset.rows) ? dataset.rows.map(normalizeDatasetRow) : [];

  return {
    ...dataset,
    columns,
    uploadedAt: dataset.uploadedAt ? new Date(dataset.uploadedAt) : new Date(),
    rows,
    rowCount: Number.isFinite(Number(dataset.rowCount)) ? Number(dataset.rowCount) : rows.length,
  };
};

const normalizeChatMessage = (message: ChatMessage): ChatMessage => ({
  ...message,
  timestamp: new Date(message.timestamp),
});

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [analysis, setAnalysis] = useState<DatasetAnalysis | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const applyApiState = useCallback((nextDataset: Dataset | null, nextMessages: ChatMessage[] = [], nextAnalysis?: DatasetAnalysis | null) => {
    setDataset(normalizeDataset(nextDataset));
    setChatMessages(Array.isArray(nextMessages) ? nextMessages.map(normalizeChatMessage) : []);
    if (nextAnalysis) {
      setAnalysis({
        ...nextAnalysis,
        chartRecommendations: Array.isArray(nextAnalysis.chartRecommendations) ? nextAnalysis.chartRecommendations : [],
        insights: Array.isArray(nextAnalysis.insights) ? nextAnalysis.insights : [],
      });
    } else {
      setAnalysis(null);
    }
  }, []);

  const hydrateState = useCallback(async () => {
    setIsHydrating(true);
    setApiError(null);

    try {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          const state = await api.getState();
          applyApiState(state.dataset, state.chatMessages, state.analysis);
          setApiError(null);
          return;
        } catch (error) {
          if (attempt === 5) {
            throw error;
          }

          await wait(500 * (attempt + 1));
        }
      }
    } catch (error) {
      setApiError(getErrorMessage(error));
    } finally {
      setIsHydrating(false);
    }
  }, [applyApiState]);

  useEffect(() => {
    void hydrateState();
  }, [hydrateState]);

  const buildDatasetPayload = useCallback((inputRows: DatasetRow[], fields: string[], fileName: string): DatasetImportPayload => {
    const rows = inputRows.filter((row) => !looksLikeDictionaryRow(row));

    if (rows.length === 0) {
      throw new Error("File contains no analyzable data rows after removing schema/dictionary rows");
    }

    const columns: DataColumn[] = fields.map(name => ({
      name,
      type: inferType(name, rows.slice(0, 50).map(r => String(r[name] ?? ''))),
      sample: rows.slice(0, 3).map(r => String(r[name] ?? '')),
    }));

    return {
      name: fileName.replace(/\.(csv|xlsx|xls|json)$/i, ''),
      columns: columns,
      rows,
      fileName,
      sourceType: 'upload',
    };
  }, []);

  const importDatasetPayload = useCallback(async (payload: DatasetImportPayload) => {
    try {
      const state = await api.importDataset(payload);
      applyApiState(state.dataset, state.chatMessages, state.analysis || undefined);
      setApiError(null);
    } catch (error) {
      setApiError(getErrorMessage(error));
      throw error;
    }
  }, [applyApiState]);

  const parseFilePayload = useCallback(async (file: File): Promise<DatasetImportPayload> => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      return new Promise<DatasetImportPayload>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          dynamicTyping: false,
          skipEmptyLines: true,
          complete: (results) => {
            try {
              const rows = (results.data || []).map(normalizeDatasetRow);
              
              if (rows.length === 0) {
                throw new Error('CSV file contains no data rows');
              }
              
              const fields = results.meta?.fields || [];
              resolve(buildDatasetPayload(rows, fields, file.name));
            } catch (error) {
              reject(error);
            }
          },
          error: (err) => reject(err),
        });
      });
    }

    if (ext === 'json') {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const rows = (Array.isArray(parsed) ? parsed : [parsed]).map(normalizeDatasetRow);
      
      if (rows.length === 0) {
        throw new Error('JSON file contains no data rows');
      }
      
      const fields = Object.keys(rows[0] || {});
      return buildDatasetPayload(rows, fields, file.name);
    }

    if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Excel file contains no sheets');
      }
      
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      if (!sheet) {
        throw new Error('Failed to read Excel sheet');
      }
      
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet).map(normalizeDatasetRow);
      
      if (rows.length === 0) {
        throw new Error('Excel sheet contains no data rows');
      }
      
      const fields = Object.keys(rows[0] || {});
      return buildDatasetPayload(rows, fields, file.name);
    }

    throw new Error('Unsupported file type');
  }, [buildDatasetPayload]);

  const uploadFile = useCallback(async (file: File) => {
    const payload = await parseFilePayload(file);
    await importDatasetPayload(payload);
  }, [importDatasetPayload, parseFilePayload]);

  const uploadFiles = useCallback(async (files: File[]) => {
    const selectedFiles = files.filter(Boolean);

    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    setApiError(null);

    try {
      if (selectedFiles.length === 1) {
        await uploadFile(selectedFiles[0]);
        return;
      }

      const payloads = await Promise.all(selectedFiles.map(parseFilePayload));
      const state = await api.mergeDatasets(payloads);
      applyApiState(state.dataset, state.chatMessages, state.analysis || undefined);
      setApiError(null);
    } catch (error) {
      setApiError(getErrorMessage(error));
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [applyApiState, parseFilePayload, uploadFile]);

  const importPdfFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setApiError(null);

    try {
      const result = await api.importPdf(file);
      setDataset(normalizeDataset(result.dataset));
      setAnalysis(result.analysis ?? null);
      setChatMessages([]);
      return result;
    } catch (error) {
      setApiError(getErrorMessage(error));
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const loadDemo = useCallback(async () => {
    try {
      const state = await api.loadDemo();
      applyApiState(state.dataset, state.chatMessages, state.analysis || undefined);
      setApiError(null);
    } catch (error) {
      setApiError(getErrorMessage(error));
      throw error;
    }
  }, [applyApiState]);

  const resetAppState = useCallback(async () => {
    try {
      const state = await api.resetState();
      applyApiState(state.dataset, state.chatMessages, state.analysis || null);
      setApiError(null);
    } catch (error) {
      setDataset(null);
      setChatMessages([]);
      setAnalysis(null);
      setApiError(getErrorMessage(error));
    }
  }, [applyApiState]);

  const sendChatQuery = useCallback(async (query: string, preferences?: {
    chartCount?: string;
    chartTypes?: string[];
    showTrends?: boolean;
    showCorrelations?: boolean;
  }) => {
    if (!dataset) return;

    setIsProcessing(true);
    try {
      const response = await api.sendChatQuery(dataset.id, query, preferences);
      setChatMessages(prev => [
        ...prev,
        normalizeChatMessage(response.userMessage),
        normalizeChatMessage(response.assistantMessage),
      ]);
      setApiError(null);
    } catch (error) {
      setApiError(getErrorMessage(error));
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [dataset, setIsProcessing]);

  const updateDatasetCell = useCallback(async (rowId: number, column: string, value: unknown) => {
    if (!dataset) {
      const errorMsg = 'Dataset not available';
      setApiError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const response = await api.updateRow(dataset.id, rowId, column, value);
      setDataset(normalizeDataset(response.dataset));
      setApiError(null);
    } catch (error) {
      setApiError(getErrorMessage(error));
      throw error;
    }
  }, [dataset]);

  const replaceDatasetLocally = useCallback((nextDataset: Dataset) => {
    setDataset(normalizeDataset(nextDataset));
    setApiError(null);
  }, []);

  const deleteDataset = useCallback(async () => {
    if (!dataset) {
      const errorMsg = 'No dataset to delete';
      setApiError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      await api.deleteDataset(dataset.id);
      setDataset(null);
      setChatMessages([]);
      setAnalysis(null);
      setApiError(null);
    } catch (error) {
      setApiError(getErrorMessage(error));
      throw error;
    }
  }, [dataset]);

  const contextValue = useMemo(() => ({
    dataset,
    chatMessages,
    analysis,
    isProcessing,
    isHydrating,
    apiError,
    uploadFile,
    uploadFiles,
    importPdfFile,
    loadDemo,
    sendChatQuery,
    updateDatasetCell,
    replaceDatasetLocally,
    deleteDataset,
    resetAppState,
    retryHydrate: hydrateState,
  }), [
    dataset,
    chatMessages,
    analysis,
    isProcessing,
    isHydrating,
    apiError,
    uploadFile,
    uploadFiles,
    importPdfFile,
    loadDemo,
    sendChatQuery,
    updateDatasetCell,
    replaceDatasetLocally,
    deleteDataset,
    resetAppState,
    hydrateState,
  ]);

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};
