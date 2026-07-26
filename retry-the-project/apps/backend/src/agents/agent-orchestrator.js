export class AgentOrchestrator {
  constructor() {
    this.agents = new Map();
    this.taskQueue = [];
    this.isProcessing = false;
  }

  registerAgent(id, agent) {
    this.agents.set(id, agent);
  }

  async execute(taskId, agentId, input) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    this.taskQueue.push({ taskId, agentId, input, status: 'queued' });
    return this.processQueue();
  }

  async processQueue() {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const task = this.taskQueue.shift();

    try {
      task.status = 'processing';
      const agent = this.agents.get(task.agentId);
      const result = await agent.execute(task.input);
      task.status = 'completed';
      task.result = result;
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
    } finally {
      this.isProcessing = false;
      if (this.taskQueue.length > 0) {
        await this.processQueue();
      }
    }

    return task;
  }

  getAgentThoughts(agentId) {
    const agent = this.agents.get(agentId);
    return agent ? agent.getThoughts() : [];
  }
}