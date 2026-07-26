import React, { useCallback, useState } from 'react';
import { api } from '@/features/data/api/dataApi';
import { API_BASE_URL } from '@/config/apiConfig';
import { Dataset, DatasetRow, ChatMessage } from '@/features/data/model/dataStore';

export interface LocalDataset {
  id: string;
  name: string;
  fileName: string | null;
  columns: Dataset['columns'];
  rowCount: number;
  isLocal: true;
  localDatasetId: string;
}

export interface LocalChatResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export interface LocalQueryResult {
  data: Record<string, unknown>[];
  columns: string[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface LocalDataContextValue {
  localDataset: LocalDataset | null;
  chatMessages: ChatMessage[];
  isProcessing: boolean;
  importLocalDataset: (name: string, fileName: string, columns: Dataset['columns'], rows: DatasetRow[]) => Promise<void>;
  sendLocalQuery: (query: string) => Promise<void>;
  getLocalData: (page?: number, limit?: number) => Promise<LocalQueryResult>;
  clearLocalDataset: () => void;
}

const LocalDataContext = React.createContext<LocalDataContextValue | null>(null);

export const LocalDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [localDataset, setLocalDataset] = useState<LocalDataset | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const importLocalDataset = useCallback(async (
    name: string,
    fileName: string,
    columns: Dataset['columns'],
    rows: DatasetRow[]
  ) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || API_BASE_URL}/api/datasets/local-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          fileName,
          columns,
          rows,
          sourceType: 'local',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to import local dataset');
      }

      const result = await response.json();
      setLocalDataset(result.dataset);
      setChatMessages([]);
    } catch (error) {
      console.error('Failed to import local dataset:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const sendLocalQuery = useCallback(async (query: string) => {
    if (!localDataset) {
      throw new Error('No local dataset loaded');
    }

    setIsProcessing(true);
    try {
      // First, get schema for AI
      const schema = {
        datasetName: localDataset.name,
        columns: localDataset.columns,
      };

      // Generate SQL using AI (schema only, no data)
      const aiResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL || API_BASE_URL}/api/datasets/schema-ai-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema, query }),
      });

      if (!aiResponse.ok) {
        const error = await aiResponse.json();
        throw new Error(error.error || 'Failed to generate SQL');
      }

      const aiPayload = await aiResponse.json();
      const { sql, insight, explanation, fallback } = aiPayload;

      if (!sql) {
        throw new Error('AI could not generate a valid SQL query');
      }

      // Execute SQL locally
      const queryResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL || API_BASE_URL}/api/datasets/${localDataset.localDatasetId}/local-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });

      if (!queryResponse.ok) {
        const error = await queryResponse.json();
        throw new Error(error.error || 'Failed to execute query');
      }

      const queryResult = await queryResponse.json();

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: query,
        timestamp: new Date(),
      };

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: [
          insight || explanation || 'Query processed successfully.',
          `Matched rows: ${queryResult.pagination.total}`,
          fallback ? 'Schema fallback was used for this query.' : null,
        ].filter(Boolean).join('\n\n'),
        sql: sql,
        timestamp: new Date(),
      };

      setChatMessages(prev => [...prev, userMessage, assistantMessage]);
    } catch (error) {
      console.error('Failed to send local query:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [localDataset]);

  const getLocalData = useCallback(async (page = 0, limit = 100): Promise<LocalQueryResult> => {
    if (!localDataset) {
      throw new Error('No local dataset loaded');
    }

    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL || API_BASE_URL}/api/datasets/${localDataset.localDatasetId}/local-data?page=${page}&limit=${limit}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get local data');
    }

    return await response.json();
  }, [localDataset]);

  const clearLocalDataset = useCallback(() => {
    setLocalDataset(null);
    setChatMessages([]);
  }, []);

  return (
    <LocalDataContext.Provider value={{
      localDataset,
      chatMessages,
      isProcessing,
      importLocalDataset,
      sendLocalQuery,
      getLocalData,
      clearLocalDataset,
    }}>
      {children}
    </LocalDataContext.Provider>
  );
};

export const useLocalData = () => {
  const context = React.useContext(LocalDataContext);
  if (!context) {
    throw new Error('useLocalData must be used within LocalDataProvider');
  }
  return context;
};
