import { AgentOrchestrator } from '../agents/agent-orchestrator.js';
import { DataAnalystAgent } from '../agents/data-analyst-agent.js';
import { sendError, sendSuccess } from '../utils/response-utils.js';
import { HTTP_STATUS } from '../config/constants.js';

const orchestrator = new AgentOrchestrator();

// Register agents
orchestrator.registerAgent(
  'data-analyst',
  new DataAnalystAgent({
    id: 'data-analyst',
    name: 'Data Analyst Agent',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
  })
);

export async function handleAgentRoutes(request, response, pathname) {
  const { method } = request;

  // POST /api/agents/execute
  if (method === 'POST' && pathname === '/api/agents/execute') {
    try {
      const body = await parseBody(request);
      const { agentId, input } = body;

      if (!agentId || !input) {
        sendError(response, HTTP_STATUS.BAD_REQUEST, 'agentId and input are required', 'MISSING_PARAMS');
        return true;
      }

      const taskId = `task-${Date.now()}-${Math.random()}`;
      const result = await orchestrator.execute(taskId, agentId, input);
      
      sendSuccess(response, { taskId, result });
      return true;
    } catch (error) {
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message, 'AGENT_ERROR');
      return true;
    }
  }

  // GET /api/agents/thoughts/:agentId
  if (method === 'GET' && pathname.startsWith('/api/agents/thoughts/')) {
    try {
      const agentId = pathname.split('/').pop();
      const thoughts = orchestrator.getAgentThoughts(agentId);
      
      sendSuccess(response, { thoughts });
      return true;
    } catch (error) {
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message, 'AGENT_ERROR');
      return true;
    }
  }

  // GET /api/agents/list
  if (method === 'GET' && pathname === '/api/agents/list') {
    try {
      const agents = [
        { id: 'data-analyst', name: 'Data Analyst Agent', description: 'Performs statistical analysis and data insights' }
      ];
      
      sendSuccess(response, { agents });
      return true;
    } catch (error) {
      sendError(response, HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message, 'AGENT_ERROR');
      return true;
    }
  }

  return false;
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk.toString();
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    request.on('error', reject);
  });
}