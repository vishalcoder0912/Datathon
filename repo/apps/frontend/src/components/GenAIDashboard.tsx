import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/config/apiConfig";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

interface Dashboard {
  title: string;
  domain: string;
  kpis: Array<{
    name: string;
    description: string;
    business_value: string;
  }>;
  charts: Array<{
    type: string;
    title: string;
    dimensions: string[];
    measures: string[];
    insight: string;
  }>;
  insights: string[];
  recommendations: string[];
}

export default function GenAIDashboard() {
  const [dataset, setDataset] = useState<{
    columns: string[];
    data: Record<string, unknown>[];
  } | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const lines = content.split("\n");
        const headers = lines[0].split(",").map((h) => h.trim());

        const data = lines.slice(1).map((line) => {
          const values = line.split(",").map((v) => v.trim());
          const row: Record<string, unknown> = {};

          headers.forEach((header, index) => {
            const value = values[index];
            row[header] = isNaN(Number(value)) ? value : Number(value);
          });

          return row;
        });

        setDataset({ columns: headers, data: data.filter((d) => Object.values(d).some((v) => v)) });
        toast.success("Dataset loaded successfully");
      } catch (error) {
        toast.error("Failed to parse CSV");
      }
    };

    reader.readAsText(file);
  };

  const generateDashboard = async () => {
    if (!dataset) {
      toast.error("Please upload a dataset first");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/genai/dashboard/create`, {
        dataset,
      });

      setDashboard(response.data.dashboard);
      toast.success("Dashboard generated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate dashboard"
      );
    } finally {
      setLoading(false);
    }
  };

  const submitQuery = async () => {
    if (!query || !dashboard) {
      toast.error("Please enter a query and generate a dashboard first");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/genai/query`, {
        query,
        dataset,
      });

      toast.success("Query processed successfully");
      console.log("Query response:", response.data);
    } catch (error) {
      toast.error("Failed to process query");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <h1 className="text-4xl font-bold mb-8">InsightFlow - GenAI Analytics</h1>

      {/* Upload Section */}
      <Card className="p-6 mb-8">
        <h2 className="text-2xl font-semibold mb-4">Step 1: Upload Dataset</h2>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="mb-4"
        />
        {dataset && (
          <p className="text-sm text-gray-600">
            Loaded: {dataset.data.length} rows, {dataset.columns.length} columns
          </p>
        )}
      </Card>

      {/* Generate Dashboard */}
      <Card className="p-6 mb-8">
        <h2 className="text-2xl font-semibold mb-4">Step 2: Generate Dashboard</h2>
        <Button
          onClick={generateDashboard}
          disabled={!dataset || loading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {loading ? "Generating..." : "Generate AI Dashboard"}
        </Button>
      </Card>

      {/* Query Section */}
      {dashboard && (
        <Card className="p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Conversational Analytics</h2>
          <div className="flex gap-2">
            <input aria-label="Ask a question about your data..."
              type="text"
              placeholder="Ask a question about your data..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 px-4 py-2 border rounded-lg"
            />
            <Button
              onClick={submitQuery}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              Submit Query
            </Button>
          </div>
        </Card>
      )}

      {/* Dashboard Display */}
      {dashboard && (
        <div className="space-y-8">
          <Card className="p-6">
            <h2 className="text-3xl font-bold mb-4">{dashboard.title}</h2>
            <p className="text-gray-600 mb-4">Domain: {dashboard.domain}</p>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {dashboard.kpis.slice(0, 4).map((kpi, idx) => (
                <Card key={idx} className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
                  <h3 className="font-semibold text-lg mb-2">{kpi.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{kpi.description}</p>
                  <p className="text-xs text-gray-500">{kpi.business_value}</p>
                </Card>
              ))}
            </div>

            {/* Charts Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {dashboard.charts.slice(0, 4).map((chart, idx) => (
                <Card key={idx} className="p-4">
                  <h3 className="font-semibold mb-4">{chart.title}</h3>
                  <div className="text-sm text-gray-600">
                    <p>Type: {chart.type}</p>
                    <p>Insight: {chart.insight}</p>
                  </div>
                </Card>
              ))}
            </div>

            {/* Insights */}
            {dashboard.insights.length > 0 && (
              <Card className="p-6 mt-8 bg-amber-50 border-amber-200">
                <h3 className="font-semibold text-lg mb-4">AI Insights</h3>
                <ul className="space-y-2">
                  {dashboard.insights.slice(0, 5).map((insight, idx) => (
                    <li key={idx} className="text-sm">
                      • {insight}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Recommendations */}
            {dashboard.recommendations.length > 0 && (
              <Card className="p-6 mt-4 bg-green-50 border-green-200">
                <h3 className="font-semibold text-lg mb-4">Recommendations</h3>
                <ul className="space-y-2">
                  {dashboard.recommendations.slice(0, 5).map((rec, idx) => (
                    <li key={idx} className="text-sm">
                      • {rec}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
