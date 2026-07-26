import { EventEmitter } from 'events';

export class BaseAgent extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.thoughts = [];
    this.memory = new Map();
  }

  addThought(thought) {
    this.thoughts.push({
      ...thought,
      timestamp: Date.now(),
    });
    this.emit('thought', thought);
  }

  setMemory(key, value) {
    this.memory.set(key, value);
  }

  getMemory(key) {
    return this.memory.get(key);
  }

  getThoughts() {
    return this.thoughts;
  }

  async execute(input) {
    throw new Error('execute method must be implemented by subclass');
  }
}