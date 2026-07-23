import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { useData } from '@/features/data/context/useData';
import { api } from '@/features/data/api/dataApi';

type Relationship = {
  column1?: string;
  column2?: string;
  correlation?: number | string;
  direction?: string;
  strength?: 'strong' | 'moderate' | 'weak' | string;
};

const getStrengthColor = (strength?: string) => {
  switch (strength) {
    case 'strong':
      return 'bg-green-200 text-green-800';
    case 'moderate':
      return 'bg-yellow-200 text-yellow-800';
    default:
      return 'bg-gray-200 text-gray-800';
  }
};

const RelationshipsPage = () => {
  const { dataset } = useData();
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dataset) return;
    
    const loadRelationships = async () => {
      setLoading(true);
      try {
        const response = await api.getAIRelationships(dataset.id);
        setRelationships(Array.isArray(response.relationships) ? response.relationships as Relationship[] : []);
      } catch (error) {
        console.error("Failed to load relationships:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRelationships();
  }, [dataset]);

  if (loading) return <div className="p-4">Analyzing relationships…</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Column Relationships</h1>
      
      {relationships.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded">
          No significant relationships found
        </div>
      ) : (
        <div className="grid gap-4">
          {relationships.map((rel, i) => (
            <div key={i} className="border rounded p-4 hover:shadow-lg transition">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold">{rel.column1} ↔ {rel.column2}</span>
                </div>
                <span className={`px-3 py-1 rounded text-sm font-semibold ${getStrengthColor(rel.strength)}`}>
                  {rel.strength || 'unknown'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Correlation</div>
                  <div className="text-lg font-bold">{rel.correlation ?? 'n/a'}</div>
                </div>
                <div>
                  <div className="text-gray-600">Direction</div>
                  <div className="text-lg font-bold">{rel.direction || 'n/a'}</div>
                </div>
                <div>
                  <div className="text-gray-600">Strength</div>
                  <div className="text-lg font-bold">{rel.strength || 'unknown'}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RelationshipsPage;
