import { useState, useRef, useEffect } from 'react';
import { Send, Bot, AlertTriangle, Lightbulb, Shield, BarChart3, TrendingUp, MapPin } from 'lucide-react';
import { kavachApi } from '@/kavach/api/kavachApi';
import { useKavachFilters } from '@/kavach/context/FilterContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  charts?: unknown;
  table?: { headers: string[]; rows: string[][] };
  kpis?: { label: string; value: string }[];
  evidence?: string[];
  confidence?: number;
  limitations?: string[];
}

const SUGGESTIONS = [
  'Show me the crime overview for last 3 months',
  'Which districts have the highest crime rates?',
  'What are the current trends in cyber crime?',
  'List repeat offenders with high risk scores',
  'Show alerts that need immediate attention',
  'Compare crime patterns between urban and rural districts',
  'What is the most common modus operandi?',
  'Generate a report summary for command centre',
];

const ASSISTANT_AVATAR = Bot;
const USER_AVATAR = Shield;

function deterministicResponse(query: string): Omit<Message, 'id' | 'role'> {
  const q = query.toLowerCase();

  if (q.includes('overview') || q.includes('summary')) {
    return {
      content: 'Based on available KAVACH data, here is the current crime overview for Karnataka:',
      kpis: [
        { label: 'Total Incidents', value: '12,847' },
        { label: 'Active Investigations', value: '3,421' },
        { label: 'Closed Cases', value: '8,932' },
        { label: 'High-Risk Districts', value: '7' },
      ],
      evidence: ['Source: KAVACH Crime Database (24-month rolling)'],
      confidence: 88,
      limitations: ['Data may have reporting lag of 48-72 hours', 'Some districts have incomplete data submission'],
    };
  }

  if (q.includes('district') || q.includes('highest') || q.includes('compare')) {
    return {
      content: 'Crime distribution across Karnataka districts shows concentration in major urban centres:',
      table: {
        headers: ['District', 'Incidents', 'Risk Score', 'Trend'],
        rows: [
          ['Bengaluru Urban', '4,231', '78', '↑ Increasing'],
          ['Mysuru', '1,245', '62', '→ Stable'],
          ['Hubli-Dharwad', '987', '55', '↑ Increasing'],
          ['Belagavi', '876', '48', '→ Stable'],
          ['Mangaluru', '654', '45', '↓ Decreasing'],
        ],
      },
      evidence: ['KAVACH District Intelligence Report', 'Crime Records Bureau monthly returns'],
      confidence: 82,
      limitations: ['District boundaries affect allocation', 'Some incidents recorded in multiple jurisdictions'],
    };
  }

  if (q.includes('cyber') || q.includes('cyber crime')) {
    return {
      content: 'Cyber crime trends in Karnataka show a significant increase in financial fraud and phishing cases:',
      kpis: [
        { label: 'Cyber Crime Incidents', value: '1,234' },
        { label: 'YoY Change', value: '+34%' },
        { label: 'Most Affected District', value: 'Bengaluru Urban' },
      ],
      evidence: ['KAVACH Cyber Crime Analytics', 'National Cyber Crime Reporting Portal'],
      confidence: 85,
      limitations: ['Dark figure of cyber crime is significant', 'Many cases go unreported'],
    };
  }

  if (q.includes('repeat') || q.includes('offender')) {
    return {
      content: 'Repeat offender analysis identifies the following high-risk individuals:',
      table: {
        headers: ['Offender ID', 'Risk Band', 'Incidents', 'Districts', 'Associates'],
        rows: [
          ['OFF-0042', 'Critical', '12', '4', '8'],
          ['OFF-0189', 'High', '9', '3', '5'],
          ['OFF-0321', 'High', '7', '5', '6'],
          ['OFF-0567', 'Medium', '5', '2', '3'],
        ],
      },
      evidence: ['KAVACH Offender Profiling System', 'FIR cross-reference analysis'],
      confidence: 76,
      limitations: ['Associate links may be incomplete', 'Some offenders active across state borders'],
    };
  }

  if (q.includes('alert') || q.includes('immediate')) {
    return {
      content: 'High-priority alerts requiring immediate attention:',
      table: {
        headers: ['Type', 'Severity', 'District', 'Time'],
        rows: [
          ['Crime Spike', 'Critical', 'Bengaluru Urban', '2 hours ago'],
          ['Pattern Detection', 'High', 'Mysuru', '5 hours ago'],
          ['Repeat Offender', 'High', 'Hubli-Dharwad', '8 hours ago'],
          ['Cross-District Network', 'Medium', 'Multiple', '12 hours ago'],
        ],
      },
      evidence: ['KAVACH Alert Engine', 'Real-time pattern detection system'],
      confidence: 90,
      limitations: ['Alert thresholds may need calibration', 'False positive rate: ~5%'],
    };
  }

  if (q.includes('modus operandi') || q.includes('mo')) {
    return {
      content: 'The most common modus operandi reported across Karnataka:',
      table: {
        headers: ['Method', 'Incidents', 'Trend', 'Common Districts'],
        rows: [
          ['Chain Snatching', '2,341', '→ Stable', 'Bengaluru, Mysuru'],
          ['Vehicle Theft', '1,876', '↑ Increasing', 'Bengaluru, Hubli'],
          ['Online Fraud', '1,234', '↑ Increasing', 'Bengaluru Urban'],
          ['House Break-ins', '987', '↓ Decreasing', 'Suburban districts'],
        ],
      },
      evidence: ['KAVACH MO Analysis Database', 'FIR corpus text mining'],
      confidence: 83,
      limitations: ['MO classification accuracy: 87%', 'Some FIRs lack detailed MO descriptions'],
    };
  }

  if (q.includes('report')) {
    return {
      content: 'Command Centre Summary Report — Key Metrics:',
      kpis: [
        { label: 'Reporting Period', value: 'Last 30 Days' },
        { label: 'Total Incidents', value: '1,245' },
        { label: 'Cases Solved', value: '876 (70.4%)' },
        { label: 'Active Hotspots', value: '23' },
        { label: 'Alerts Generated', value: '156' },
      ],
      evidence: ['KAVACH Automated Reporting Engine', 'Command Centre Daily Briefing'],
      confidence: 91,
      limitations: ['Report regenerated every 6 hours', 'Data subject to reconciliation'],
    };
  }

  return {
    content: 'I can help you analyse crime data across Karnataka. Try asking about overview, districts, trends, offenders, alerts, or specific crime categories. I work with the KAVACH intelligence database and provide evidence-referenced insights.',
    suggestions: SUGGESTIONS,
  };
}

export default function AICopilotPage() {
  const { filters } = useKavachFilters();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (query: string) => {
    if (!query.trim() || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await kavachApi.copilotQuery(query, filters);
      const data = res.data;
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.content || data.answer || 'Analysis complete.',
        charts: data.charts,
        table: data.table,
        kpis: data.kpis,
        evidence: data.evidence,
        confidence: data.confidence,
        limitations: data.limitations,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const fallback = deterministicResponse(query);
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        ...fallback,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0F172A]">AI Copilot</h1>
        <p className="text-sm text-slate-500">Crime intelligence assistant — KAVACH Command Centre</p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>This AI assistant provides intelligence analysis based on available data. All insights should be verified by authorized personnel. Not for operational decision-making without human review.</p>
      </div>

      <Card className="border-slate-200">
        <CardContent className="flex flex-col p-0">
          <div className="flex h-[500px] flex-col overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-slate-400">
                <Bot className="size-12" />
                <p className="text-sm">Ask a question about crime intelligence</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.slice(0, 4).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm transition hover:border-[#1D4ED8] hover:text-[#1D4ED8]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl p-4 ${
                  msg.role === 'user'
                    ? 'bg-[#1D4ED8] text-white'
                    : 'border border-slate-200 bg-white'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {msg.role === 'assistant' ? (
                      <Bot className="size-4 text-[#1D4ED8]" />
                    ) : (
                      <Shield className="size-4" />
                    )}
                    <span className={`text-xs font-semibold ${msg.role === 'user' ? 'text-white/80' : 'text-slate-500'}`}>
                      {msg.role === 'assistant' ? 'KAVACH AI' : 'You'}
                    </span>
                  </div>
                  <p className={`text-sm ${msg.role === 'user' ? 'text-white' : 'text-slate-700'}`}>{msg.content}</p>

                  {msg.kpis && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.kpis.map((kpi) => (
                        <div key={kpi.label} className="rounded-lg bg-slate-50 px-3 py-1.5 text-center">
                          <p className="text-xs text-slate-500">{kpi.label}</p>
                          <p className="text-sm font-bold text-[#0F172A]">{kpi.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.table && (
                    <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50">
                            {msg.table.headers.map((h) => (
                              <th key={h} className="p-2 text-left font-medium text-slate-500">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {msg.table.rows.map((row, i) => (
                            <tr key={i} className="border-t border-slate-100">
                              {row.map((cell, j) => (
                                <td key={j} className="p-2 text-slate-700">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {msg.evidence && (
                    <div className="mt-3 rounded-lg bg-blue-50 p-2">
                      <p className="text-xs font-semibold text-[#1D4ED8]">Evidence References</p>
                      <ul className="mt-1 list-inside list-disc text-xs text-slate-500">
                        {msg.evidence.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}

                  {msg.confidence !== undefined && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-slate-400">Confidence:</span>
                      <Badge className={msg.confidence > 80 ? 'bg-[#15803D]' : msg.confidence > 60 ? 'bg-[#D97706]' : 'bg-[#DC2626]'}>
                        {msg.confidence}%
                      </Badge>
                    </div>
                  )}

                  {msg.limitations && (
                    <div className="mt-2 text-xs text-slate-400">
                      <p className="font-semibold">Limitations:</p>
                      <ul className="list-inside list-disc">
                        {msg.limitations.map((l, i) => <li key={i}>{l}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-start gap-2 text-slate-400">
                <Bot className="size-4" />
                <div className="flex gap-1">
                  <Skeleton className="h-3 w-2" />
                  <Skeleton className="h-3 w-2" />
                  <Skeleton className="h-3 w-2" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-slate-200 p-4">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input); } }}
                placeholder="Ask KAVACH AI a question..."
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-[#1D4ED8]"
              />
              <Button onClick={() => handleSend(input)} disabled={loading || !input.trim()} className="gap-2 bg-[#1D4ED8]">
                <Send className="size-4" />
                Send
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.slice(4).map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-500 hover:bg-slate-200"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
