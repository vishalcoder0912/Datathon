import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useData } from '@/features/data/context/useData';
import { api } from '@/features/data/api/dataApi';

type Anomaly = {
  column?: string;
  explanation?: string;
  type?: string;
  severity?: 'high' | 'medium' | 'low';
};

const AnomalyDetectionPage = () => {
  const { dataset } = useData();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dataset) return;
    
    const loadAnomalies = async () => {
      setLoading(true);
      try {
        const response = await api.getAIAnomalies(dataset.id);
        setAnomalies(Array.isArray(response.anomalies) ? response.anomalies as Anomaly[] : []);
      } catch (error) {
        console.error("Failed to load anomalies:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAnomalies();
  }, [dataset]);

  if (loading) return <div className="p-4">Analyzing for anomalies…</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Anomaly Detection</h1>
      
      {anomalies.length === 0 ? (
        <div className="bg-green-50 border border-green-200 p-4 rounded">
          No anomalies detected
        </div>
      ) : (
        <div className="space-y-4">
          {anomalies.map((anomaly, i) => (
            <div 
              key={i} 
              className={`border rounded p-4 ${anomaly.severity === 'high' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 mt-1" />
                <div className="flex-1">
                  <div className="font-semibold">{anomaly.column || 'Dataset'}</div>
                  <div className="text-sm text-gray-600">{anomaly.explanation}</div>
                  <div className="text-xs text-gray-500 mt-2">Type: {anomaly.type || 'unknown'}</div>
                </div>
                <span className={`px-3 py-1 rounded text-sm font-semibold ${anomaly.severity === 'high' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'}`}>
                  {anomaly.severity}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnomalyDetectionPage;
