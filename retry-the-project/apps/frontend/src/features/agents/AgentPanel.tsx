import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Agent {
  id: string;
  name: string;
  description: string;
}

interface AgentThought {
  timestamp: number;
  action: string;
  reasoning: string;
  result?: any;
}

export const AgentPanel: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('data-analyst');
  const [input, setInput] = useState<string>('');
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [thoughts, setThoughts] = useState<AgentThought[]>([]);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/agents/list');
      const data = await response.json();
      if (data.success && data.data) {
        setAgents(data.data.agents);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  };

  const executeAgent = async () => {
    if (!input.trim()) return;

    setExecuting(true);
    try {
      const response = await fetch('/api/agents/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgent,
          input,
        }),
      });

      const data = await response.json();
      if (data.success && data.data) {
        setResult(data.data.result);

        // Fetch thoughts
        const thoughtsResponse = await fetch(
          `/api/agents/thoughts/${selectedAgent}`
        );
        const thoughtsData = await thoughtsResponse.json();
        if (thoughtsData.success && thoughtsData.data) {
          setThoughts(thoughtsData.data.thoughts);
        }
      }
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Agent Control Panel</CardTitle>
          <CardDescription>
            Interact with AI agents to analyze your data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Agent</label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Query</label>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter your analysis request..."
              className="h-24"
            />
          </div>

          <Button
            onClick={executeAgent}
            disabled={executing || !input.trim()}
            className="w-full"
          >
            {executing ? 'Executing...' : 'Execute Agent'}
          </Button>
        </CardContent>
      </Card>

      {thoughts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Thoughts</CardTitle>
            <CardDescription>
              View the agent's reasoning process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {thoughts.map((thought, idx) => (
                  <div key={idx} className="bg-muted p-3 rounded-lg text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{thought.action}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(thought.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p>{thought.reasoning}</p>
                    {thought.result && (
                      <pre className="mt-2 text-xs bg-background p-2 rounded overflow-x-auto">
                        {JSON.stringify(thought.result, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Result</CardTitle>
            <CardDescription>
              Output from the agent execution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
};