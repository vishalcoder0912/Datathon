import { createContext } from "react";
import { ChatMessage, Dataset, DatasetAnalysis } from "@/features/data/model/dataStore";
import type { PdfImportResult } from "@/features/data/api/dataApi";

export interface DataContextType {
  dataset: Dataset | null;
  chatMessages: ChatMessage[];
  analysis: DatasetAnalysis | null;
  isProcessing: boolean;
  isHydrating: boolean;
  apiError: string | null;
  uploadFile: (file: File) => Promise<void>;
  uploadFiles: (files: File[]) => Promise<void>;
  importPdfFile: (file: File) => Promise<PdfImportResult>;
  loadDemo: () => Promise<void>;
  sendChatQuery: (query: string) => Promise<void>;
  updateDatasetCell: (rowId: number, column: string, value: unknown) => Promise<void>;
  replaceDatasetLocally: (nextDataset: Dataset) => void;
  deleteDataset: () => Promise<void>;
  resetAppState: () => Promise<void>;
  retryHydrate: () => Promise<void>;
}

export const DataContext = createContext<DataContextType | null>(null);
