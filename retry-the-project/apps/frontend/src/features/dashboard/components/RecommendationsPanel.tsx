import { useState, useEffect } from 'react';
import { useData } from '@/features/data/context/useData';
import { Lightbulb, AlertTriangle, TrendingUp, BarChart3, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { toast } from 'sonner';

export function RecommendationsPanel() {
  const { dataset: activeDataset } = useData();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const fetchRecommendations = async () => {
    if (!activeDataset?.rows?.length) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/automation/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activeDataset.name,
          rows: activeDataset.rows,
          columns: activeDataset.columns
        })
      });

      if (!response.ok) throw new Error('Analysis failed');
      
      const data = await response.json();
      setRecommendations(data.recommendations || []);
    } catch (error) {
      console.error('Recommendations error:', error);
      toast.error('Failed to generate recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeDataset?.rows?.length) {
      fetchRecommendations();
    }
  }, [activeDataset?.id]);

  const getIcon = (type) => {
    switch (type) {
      case 'outlier': return <AlertTriangle className="size-4 text-amber-500" />;
      case 'distribution': return <BarChart3 className="size-4 text-blue-500" />;
      case 'data_quality': return <AlertTriangle className="size-4 text-red-500" />;
      case 'correlation': return <TrendingUp className="size-4 text-green-500" />;
      case 'missing_data': return <AlertTriangle className="size-4 text-orange-500" />;
      default: return <Lightbulb className="size-4 text-yellow-500" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'medium': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  if (!activeDataset) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="size-5" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Upload a dataset to get AI-powered recommendations.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="size-5" />
          AI Recommendations
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={fetchRecommendations} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : recommendations.length === 0 ? (
          <p className="text-muted-foreground text-sm">No recommendations available.</p>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {recommendations.slice(0, 10).map((rec, index) => (
                <div
                  key={index}
                  className="rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpanded(expanded === index ? null : index)}
                >
                  <div className="flex items-start gap-2">
                    {getIcon(rec.type)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{rec.title}</p>
                      <p className="text-muted-foreground text-xs mt-1">{rec.message}</p>
                      {rec.action && expanded === index && (
                        <p className="text-muted-foreground text-xs mt-2 italic">{rec.action}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={getPriorityColor(rec.priority)}>
                      {rec.priority}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default RecommendationsPanel;