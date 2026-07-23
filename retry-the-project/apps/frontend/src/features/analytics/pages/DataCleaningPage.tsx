import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useData } from '@/features/data/context/useData';
import { api } from '@/features/data/api/dataApi';

type CleaningSuggestion = {
  column?: string;
  description?: string;
  impact?: string;
  priority?: 'high' | 'medium' | 'low';
};

const DataCleaningPage = () => {
  const { dataset } = useData();
  const [suggestions, setSuggestions] = useState<CleaningSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dataset) return;
    
    const loadSuggestions = async () => {
      setLoading(true);
      try {
        const response = await api.getAICleaning(dataset.id);
        setSuggestions(Array.isArray(response.suggestions) ? response.suggestions as CleaningSuggestion[] : []);
      } catch (error) {
        console.error("Failed to load suggestions:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSuggestions();
  }, [dataset]);

  if (loading) return <div className="p-4">Generating cleaning suggestions…</div>;

  const priorityColor = {
    high: 'text-red-600 bg-red-50 border-red-200',
    medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    low: 'text-blue-600 bg-blue-50 border-blue-200',
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Data Cleaning Suggestions</h1>
      
      {suggestions.length === 0 ? (
        <div className="bg-green-50 border border-green-200 p-4 rounded flex items-center gap-3">
          <CheckCircle className="size-5 text-green-600" />
          <div>Your dataset looks clean!</div>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((sug, i) => (
            <div key={i} className={`border rounded p-4 ${priorityColor[sug.priority || 'low']}`}>
              <div className="flex items-start gap-3">
                <AlertCircle className="size-5 mt-1" />
                <div className="flex-1">
                  <div className="font-semibold">{sug.column || 'Dataset'}</div>
                  <div className="text-sm mt-1">{sug.description || 'Review this data quality suggestion.'}</div>
                  <div className="text-xs mt-2 opacity-75">Impact: {sug.impact || 'n/a'}</div>
                </div>
                <span className="px-2 py-1 rounded text-xs font-semibold uppercase">
                  {sug.priority || 'low'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DataCleaningPage;
