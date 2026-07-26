import { useState, useEffect } from 'react';
import { Send, Loader2, AlertCircle, BarChart3, Database, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Textarea } from '@/shared/components/ui/textarea';
import { Badge } from '@/shared/components/ui/badge';

export function LlamaQueryBuilder({ dataset, className }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [llamaStatus, setLlamaStatus] = useState(null);

  useEffect(() => {
    checkLlamaStatus();
  }, []);

  const checkLlamaStatus = async () => {
    try {
      const res = await fetch('/api/llama/status');
      const data = await res.json();
      setLlamaStatus(data);
    } catch (err) {
      setLlamaStatus({ ollama_running: false, error: err.message });
    }
  };

  const handleSubmit = async () => {
    if (!query.trim() || !dataset?.rows?.length) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/llama/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          rows: dataset.rows,
          columns: dataset.columns,
          name: dataset.name,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error);
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceLabel = (confidence) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const exampleQueries = [
    'Show top 10 products by revenue',
    'Compare sales by region',
    'Trend of orders over time',
    'Average salary by department',
    'Count customers per country',
  ];

  return (
    <div className={`space-y-4 ${className || ''}`}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="size-5 text-purple-500" />
                Llama 3.2 Query
              </CardTitle>
              <CardDescription>
                Natural language analytics with dual-layer validation
              </CardDescription>
            </div>
            <Badge
              variant={llamaStatus?.ollama_running ? 'default' : 'destructive'}
              className={llamaStatus?.ollama_running ? 'bg-green-500' : ''}
            >
              {llamaStatus?.ollama_running ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!llamaStatus?.ollama_running && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Llama 3.2 not available</AlertTitle>
              <AlertDescription>
                Install Ollama from https://ollama.ai then run: ollama pull llama3.2
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything about your data..."
              className="min-h-[100px]"
              disabled={!llamaStatus?.ollama_running || loading}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={loading || !query.trim() || !dataset?.rows?.length || !llamaStatus?.ollama_running}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 size-4" />
                    Analyze
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setQuery('')}
                disabled={loading}
              >
                Clear
              </Button>
            </div>
          </div>

          {!query && (
            <div className="text-xs text-muted-foreground">
              <p className="mb-2">Try example queries:</p>
              <div className="flex flex-wrap gap-2">
                {exampleQueries.map((ex, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => setQuery(ex)}
                  >
                    {ex}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Confidence:</span>
                  <span className={`font-bold ${getConfidenceColor(result.metadata?.overall_confidence)}`}>
                    {getConfidenceLabel(result.metadata?.overall_confidence)} (
                    {((result.metadata?.overall_confidence || 0) * 100).toFixed(0)}%)
                  </span>
                </div>
                {result.metadata?.errors_corrected > 0 && (
                  <Badge variant="outline">
                    {result.metadata.errors_corrected} corrections
                  </Badge>
                )}
              </div>

              {result.chart && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="size-4" />
                      {result.chart.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {result.chart.data?.slice(0, 8).map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="truncate max-w-[150px]">
                            {item[result.chart.xKey] || item.name || 'Unknown'}
                          </span>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 bg-purple-500 rounded"
                              style={{
                                width: `${Math.min(
                                  100,
                                  ((item.value || item.count) /
                                    (result.chart.data[0]?.value || 1)) *
                                    100
                                )}px`,
                              }}
                            />
                            <span className="font-mono w-20 text-right">
                              {item.value?.toLocaleString() ||
                                item.count?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {result.sql && (
                <div className="p-3 bg-muted rounded-lg text-xs font-mono overflow-x-auto">
                  <pre className="text-green-600">{result.sql}</pre>
                </div>
              )}

              {result.analysis && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">
                    Intent: {result.analysis.intent}
                  </Badge>
                  <Badge variant="outline">
                    Column: {result.analysis.primary_column}
                  </Badge>
                  <Badge variant="outline">
                    Agg: {result.analysis.aggregation}
                  </Badge>
                  <Badge variant="outline">
                    Chart: {result.chart?.type}
                  </Badge>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default LlamaQueryBuilder;