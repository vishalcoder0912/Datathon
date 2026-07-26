import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Bot, BarChart3, Loader2, RefreshCw, Filter, PieChart, LineChart, BarChart3 as BarIcon } from 'lucide-react';
import { ChartConfig, Dataset } from '@/features/data/model/dataStore';
import { api } from '@/features/data/api/dataApi';

interface AnalyticsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: Dataset | null;
  charts: ChartConfig[];
  onAddChart?: (chart: ChartConfig) => void;
  onReplaceLatestChart?: (chart: ChartConfig) => void;
  onRemoveLatestChart?: () => void;
  onFilterChange?: (filters: Record<string, string>) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'chart' | 'insight' | 'action' | 'error';
  chartConfig?: ChartConfig;
  chartAction?: 'generate' | 'modify' | 'delete';
  insightData?: InsightData;
  model?: string;
  provider?: string;
}

interface InsightData {
  metric?: string;
  value?: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  comparisons?: string[];
}

const DEFAULT_ANALYTICS_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    role: 'assistant',
    content: `Hi! I'm your AI analytics assistant with full dashboard control. I use neural-chat:7b when available and can:

Chart Commands:
- "Create a bar chart for salary by country"
- "Change chart to line"
- "Show scatter plot"
- "Delete last chart"

Data Commands:
- "Filter by country = USA"
- "Show only senior roles"
- "Clear all filters"

Analysis Commands:
- "Show top 5 by revenue"
- "Compare metrics"
- "What are the trends?"

What would you like to do?`,
    type: 'text',
  },
];

const AnalyticsSidebar = ({ isOpen, onClose, dataset, charts: _charts, onAddChart, onReplaceLatestChart, onRemoveLatestChart, onFilterChange }: AnalyticsSidebarProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>(DEFAULT_ANALYTICS_MESSAGES);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const applyDashboardCommand = async (query: string) => {
    if (!dataset?.id) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      type: "text",
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      const command = await api.sendDashboardCommand(dataset.id, query);

      let type: ChatMessage["type"] = "text";

      if (command.action === "GENERATE_CHART" && command.chart) {
        onAddChart?.(command.chart);
        type = "chart";
      }

      if (command.action === "MODIFY_CHART" && command.chart) {
        onReplaceLatestChart?.(command.chart);
        type = "chart";
      }

      if (command.action === "DELETE_CHART") {
        onRemoveLatestChart?.();
        type = "action";
      }

      if (command.action === "FILTER" && command.filters) {
        onFilterChange?.(command.filters);
        type = "action";
      }

      if (command.action === "CLEAR_FILTERS") {
        onFilterChange?.({});
        type = "action";
      }

      if (command.action === "GENERATE_KPI") {
        type = "insight";
      }

      const kpiText = command.kpis?.length
        ? "\n\n" + command.kpis.map((k) => `• ${k.title}: ${k.value}`).join("\n")
        : "";

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        type,
        content: [
          command.message,
          kpiText,
          command.schemaOnly ? "\n\nSchema-only mode: raw rows were not sent to AI." : "",
          command.model ? `\nModel: ${command.model}` : "",
          command.aiError ? `\nFallback used: ${command.aiError}` : "",
        ].join(""),
        chartConfig: command.chart,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          type: "text",
          content: "Sorry, I could not control the dashboard for that request.",
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuery = useCallback(async () => {
    if (!input.trim() || !dataset) return;
    const q = input.trim();
    setInput('');
    await applyDashboardCommand(q);
  }, [input, dataset]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed right-4 top-4 h-[calc(100vh-2rem)] w-full max-w-md rounded-2xl border border-border/50 bg-card z-50 flex flex-col shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-border/50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
            <Bot className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">AI Assistant</p>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-green-500 animate-pulse"></span>
              <p className="text-xs text-muted-foreground">Online</p>
            </div>
          </div>
        </div>
        <button type="button"
          onClick={onClose}
          className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 shrink-0">
                <Bot className="size-4 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border/50 bg-muted/30'
              }`}
            >
              <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
              {msg.chartConfig && (
                <div className="mt-2 pt-2 border-t border-border/30">
                  <div className="flex items-center gap-2 text-xs text-primary">
                    <BarChart3 className="size-3" />
                    Chart generated
                  </div>
                </div>
              )}
              {msg.model && (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Model: {msg.model}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="flex size-8 items-center justify-center rounded-full bg-muted shrink-0">
                <span className="text-xs font-medium text-muted-foreground">You</span>
              </div>
            )}
          </motion.div>
        ))}
        
        {isProcessing && (
          <div className="flex gap-3 justify-start">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
              <Bot className="size-4 text-primary" />
            </div>
            <div className="border border-border/50 bg-muted/30 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Processing...
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border/50 p-4">
        <div className="flex gap-3 items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            className="flex-1 bg-muted/50 border border-border/50 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
            disabled={isProcessing}
          />
          <button type="button"
            onClick={handleQuery}
            disabled={!input.trim() || isProcessing || !dataset}
            className="rounded-full size-10 bg-primary flex items-center justify-center text-white hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
        
        {dataset && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button"
              onClick={() => setInput('Create bar chart')}
              className="text-xs text-muted-foreground hover:text-foreground bg-muted/50 px-2 py-1 rounded-full transition-colors flex items-center gap-1"
            >
              <BarIcon className="size-3" /> Bar
            </button>
            <button type="button"
              onClick={() => setInput('Create line chart')}
              className="text-xs text-muted-foreground hover:text-foreground bg-muted/50 px-2 py-1 rounded-full transition-colors flex items-center gap-1"
            >
              <LineChart className="size-3" /> Line
            </button>
            <button type="button"
              onClick={() => setInput('Create pie chart')}
              className="text-xs text-muted-foreground hover:text-foreground bg-muted/50 px-2 py-1 rounded-full transition-colors flex items-center gap-1"
            >
              <PieChart className="size-3" /> Pie
            </button>
            <button type="button"
              onClick={() => setInput('Filter by country = USA')}
              className="text-xs text-muted-foreground hover:text-foreground bg-muted/50 px-2 py-1 rounded-full transition-colors flex items-center gap-1"
            >
              <Filter className="size-3" /> Filter
            </button>
            <button type="button"
              onClick={() => setInput('Clear filters')}
              className="text-xs text-muted-foreground hover:text-foreground bg-muted/50 px-2 py-1 rounded-full transition-colors flex items-center gap-1"
            >
              <RefreshCw className="size-3" /> Clear
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AnalyticsSidebar;
