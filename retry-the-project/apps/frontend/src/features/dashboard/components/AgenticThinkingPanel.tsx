import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, Workflow, ShieldCheck, Network, TextSelect } from 'lucide-react';

type AgentPlan = {
  goal?: string;
  tasks?: string[];
};

type DashboardSpecSummary = {
  executiveSummary?: string[];
};

interface AgenticThinkingPanelProps {
  agentPlan?: AgentPlan;
  agentTools?: string[];
  critic?: {
    score: number;
    status: string;
    issues: string[];
    improvements: string[];
  };
  ontologyMapping?: {
    inferredDomain: string;
    canonicalTerms: string[];
    mapping: Record<string, string>;
  };
  dashboardSpec?: DashboardSpecSummary;
}

export function AgenticThinkingPanel({ agentPlan, agentTools, critic, ontologyMapping, dashboardSpec }: AgenticThinkingPanelProps) {
  if (!agentPlan && !critic) return null;

  return (
    <Card className="mb-6 bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
      <CardHeader className="border-b border-slate-800 pb-4">
        <CardTitle className="text-lg flex items-center gap-2 text-indigo-400">
          <Brain className="w-5 h-5" /> Agentic AI Thinking Process
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Agent Plan Section */}
        {agentPlan && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Workflow className="w-4 h-4 text-emerald-400" /> Planner Execution
            </h3>
            <div className="text-xs text-slate-400">
              <span className="font-medium text-slate-200">Goal:</span> {agentPlan.goal}
            </div>
            <div className="flex flex-wrap gap-2">
              {agentPlan.tasks?.map((task: string) => (
                <Badge key={task} variant="secondary" className="bg-slate-800 text-emerald-300 border-emerald-900/50">
                  {task}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Tools Section */}
        {agentTools && agentTools.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Workflow className="w-4 h-4 text-blue-400" /> Tools Routed
            </h3>
            <div className="flex flex-wrap gap-2">
              {agentTools.map((tool) => (
                <Badge key={tool} variant="outline" className="text-blue-300 border-blue-900/50">
                  {tool}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Critic Loop Section */}
        {critic && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-400" /> Critic Evaluation
            </h3>
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-white">{critic.score}/100</div>
              {critic.status === 'excellent' ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">Excellent</Badge>
              ) : (
                <Badge className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">Needs Improvement</Badge>
              )}
            </div>

            {critic.issues?.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="text-xs font-semibold text-rose-400">Detected Issues:</div>
                <ul className="text-xs text-slate-400 list-disc pl-4 space-y-1">
                  {critic.issues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              </div>
            )}
            
            {critic.improvements?.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="text-xs font-semibold text-emerald-400">Auto-Fixes Suggested:</div>
                <ul className="text-xs text-slate-400 list-disc pl-4 space-y-1">
                  {critic.improvements.map((improvement) => <li key={improvement}>{improvement}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
        
        {/* Semantic Ontology Section */}
        {ontologyMapping && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Network className="w-4 h-4 text-purple-400" /> Semantic Ontology Map
            </h3>
            <div className="text-xs text-slate-400">
              <span className="font-medium text-slate-200">Inferred Domain:</span>{' '}
              <Badge variant="outline" className="text-purple-300 border-purple-900/50">
                {ontologyMapping.inferredDomain}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {ontologyMapping.canonicalTerms.map((term: string) => (
                <Badge key={term} variant="secondary" className="bg-slate-800 text-purple-300 border-purple-900/50">
                  {term}
                </Badge>
              ))}
            </div>
          </div>
        )}

      </CardContent>

      {/* Storytelling Agent Section */}
      {dashboardSpec?.executiveSummary?.length > 0 && (
        <div className="border-t border-slate-800 p-4 mt-4 bg-slate-900/50 rounded-b-xl">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-3">
            <TextSelect className="w-4 h-4 text-amber-400" /> Executive Summary
          </h3>
          <ul className="space-y-2">
            {dashboardSpec.executiveSummary.map((sentence: string) => (
              <li key={sentence} className="text-sm text-slate-300 flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
                <span>{sentence}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

    </Card>
  );
}
