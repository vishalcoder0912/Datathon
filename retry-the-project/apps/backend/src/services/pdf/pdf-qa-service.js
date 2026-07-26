import { serviceUrls } from "../../config/serviceUrls.js";

function tokenize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9₹$%.\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function scoreChunk(queryTokens, chunk) {
  const text = String(chunk.content || "").toLowerCase();
  let score = 0;

  for (const token of queryTokens) {
    if (text.includes(token)) score += 1;
  }

  return score;
}

export function searchPdfChunks({ query, knowledgeBase, limit = 5 }) {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [];

  return (knowledgeBase?.chunks || [])
    .map((chunk) => ({ ...chunk, score: scoreChunk(queryTokens, chunk) }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function answerPdfQuestion({ query, knowledgeBase }) {
  const matches = searchPdfChunks({ query, knowledgeBase, limit: 5 });

  if (!matches.length) {
    return {
      answer: "I could not find enough relevant PDF context for that question.",
      sources: [],
    };
  }

  const context = matches
    .map((chunk, index) => `SOURCE ${index + 1}:\n${chunk.content}`)
    .join("\n\n");

  const baseUrl = serviceUrls.ollama;
  const model = process.env.OLLAMA_MODEL || "llama3.2:latest";

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "You answer questions only from the provided PDF context. If the answer is not in the context, say you do not know. Keep answers short and cite source numbers.",
          },
          {
            role: "user",
            content: `Question: ${query}\n\nPDF Context:\n${context}`,
          },
        ],
        options: { temperature: 0 },
      }),
    });

    if (!response.ok) throw new Error("Local LLM request failed");

    const data = await response.json();

    return {
      answer: data.message?.content || "No answer generated.",
      sources: matches.map((chunk, index) => ({
        source: index + 1,
        id: chunk.id,
        preview: chunk.content.slice(0, 240),
      })),
    };
  } catch {
    return {
      answer:
        "I found relevant PDF context, but local LLM is not available. Showing the best source snippets instead.",
      sources: matches.map((chunk, index) => ({
        source: index + 1,
        id: chunk.id,
        preview: chunk.content.slice(0, 240),
      })),
    };
  }
}
