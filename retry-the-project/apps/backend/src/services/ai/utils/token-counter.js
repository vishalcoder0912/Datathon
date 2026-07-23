// Token Counter Utilities for AI providers

/**
 * Estimate token count for text (rough approximation)
 * Different models use different tokenizers, this is a general approximation
 */
export function estimateTokenCount(text, model = 'gpt-4') {
  if (!text || typeof text !== 'string') return 0;

  // Different models have different token ratios
  const ratios = {
    'gpt-4': 0.25,        // ~4 chars per token
    'gpt-3.5-turbo': 0.25,
    'claude': 0.25,
    'gemini': 0.25,
    'llama': 0.33,        // ~3 chars per token
    'llama3.2': 0.33,
    'neural-chat': 0.33,
    'default': 0.25
  };

  const ratio = ratios[model] || ratios.default;
  
  // Count characters and apply ratio
  const charCount = text.length;
  const estimatedTokens = Math.ceil(charCount * ratio);

  // Add overhead for special tokens, formatting, etc.
  const overhead = 10;

  return estimatedTokens + overhead;
}

/**
 * Estimate tokens for messages array (chat format)
 */
export function estimateMessagesTokenCount(messages, model = 'gpt-4') {
  if (!Array.isArray(messages)) return 0;

  let totalTokens = 0;

  // Each message has overhead for role, content structure
  const messageOverhead = 4; // tokens per message

  for (const message of messages) {
    // Count role tokens
    if (message.role) {
      totalTokens += estimateTokenCount(message.role, model);
    }

    // Count content tokens
    if (message.content) {
      totalTokens += estimateTokenCount(message.content, model);
    }

    // Add message overhead
    totalTokens += messageOverhead;
  }

  // Add conversation overhead
  totalTokens += 3; // Every reply is primed with <im_start>assistant

  return totalTokens;
}

/**
 * Check if text fits within token limit
 */
export function fitsWithinLimit(text, maxTokens, model = 'gpt-4') {
  const estimatedTokens = estimateTokenCount(text, model);
  return estimatedTokens <= maxTokens;
}

/**
 * Truncate text to fit within token limit
 */
export function truncateToFit(text, maxTokens, model = 'gpt-4', suffix = '...') {
  if (!text) return text;

  const estimatedTokens = estimateTokenCount(text, model);
  
  if (estimatedTokens <= maxTokens) {
    return text;
  }

  // Calculate approximate character limit
  const ratios = {
    'gpt-4': 4,
    'claude': 4,
    'gemini': 4,
    'llama': 3,
    'default': 4
  };

  const charsPerToken = ratios[model] || ratios.default;
  const targetChars = (maxTokens - 10) * charsPerToken; // Leave room for suffix

  if (text.length <= targetChars) {
    return text;
  }

  // Truncate and add suffix
  return text.substring(0, targetChars - suffix.length) + suffix;
}

/**
 * Split text into chunks that fit within token limit
 */
export function splitIntoChunks(text, maxTokensPerChunk, model = 'gpt-4') {
  if (!text) return [];

  const estimatedTokens = estimateTokenCount(text, model);
  
  if (estimatedTokens <= maxTokensPerChunk) {
    return [text];
  }

  const chunks = [];
  const ratios = {
    'gpt-4': 4,
    'claude': 4,
    'gemini': 4,
    'llama': 3,
    'default': 4
  };

  const charsPerToken = ratios[model] || ratios.default;
  const charsPerChunk = maxTokensPerChunk * charsPerToken;

  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const testChunk = currentChunk + '\n\n' + paragraph;
    
    if (estimateTokenCount(testChunk, model) <= maxTokensPerChunk) {
      currentChunk = testChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      
      // If single paragraph is too large, split it
      if (estimateTokenCount(paragraph, model) > maxTokensPerChunk) {
        const subChunks = splitLargeParagraph(paragraph, charsPerChunk);
        chunks.push(...subChunks);
        currentChunk = '';
      } else {
        currentChunk = paragraph;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Split a large paragraph into smaller chunks
 */
function splitLargeParagraph(paragraph, maxChars) {
  const chunks = [];
  const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
  
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length <= maxChars) {
      currentChunk += sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      
      // If single sentence is too large, just split by characters
      if (sentence.length > maxChars) {
        for (let i = 0; i < sentence.length; i += maxChars) {
          chunks.push(sentence.substring(i, i + maxChars).trim());
        }
        currentChunk = '';
      } else {
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Calculate cost estimate for tokens (approximate)
 */
export function estimateCost(tokenCount, model = 'gpt-4') {
  // Pricing per 1K tokens (as of 2024, approximate)
  const pricing = {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 },
    'gemini-1.5-pro': { input: 0.007, output: 0.021 },
    'llama': { input: 0, output: 0 }, // Local, free
    'default': { input: 0, output: 0 }
  };

  const prices = pricing[model] || pricing.default;
  
  return {
    input: (tokenCount * prices.input) / 1000,
    output: (tokenCount * prices.output) / 1000,
    total: (tokenCount * (prices.input + prices.output)) / 1000,
    currency: 'USD'
  };
}

/**
 * Get token usage statistics
 */
export function getTokenStats(text, model = 'gpt-4') {
  const tokens = estimateTokenCount(text, model);
  const cost = estimateCost(tokens, model);
  
  return {
    text,
    model,
    estimatedTokens: tokens,
    characterCount: text.length,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    estimatedCost: cost,
    fitsInContext: {
      '4k': tokens <= 4096,
      '8k': tokens <= 8192,
      '16k': tokens <= 16384,
      '32k': tokens <= 32768,
      '128k': tokens <= 131072
    }
  };
}

export default {
  estimateTokenCount,
  estimateMessagesTokenCount,
  fitsWithinLimit,
  truncateToFit,
  splitIntoChunks,
  estimateCost,
  getTokenStats
};
