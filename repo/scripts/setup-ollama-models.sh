#!/bin/bash
# InsightFlow Ollama Model Setup
# Pulls required models for Manager AI, Dashboard AI, Chat AI, and Embeddings

echo "=========================================="
echo "  InsightFlow Ollama Model Setup"
echo "=========================================="
echo ""

# Check if Ollama is running
echo "[1/5] Checking Ollama..."
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo "  ❌ Ollama is not running. Start it with: ollama serve"
  exit 1
fi
echo "  ✅ Ollama is running"
echo ""

# Pull Manager/Dashboard model (qwen3:8b)
echo "[2/5] Pulling qwen3:8b (Manager + Dashboard AI)..."
ollama pull qwen3:8b
echo "  ✅ qwen3:8b ready"
echo ""

# Pull Chat model (qwen3:4b)
echo "[3/5] Pulling qwen3:4b (Chat AI)..."
ollama pull qwen3:4b
echo "  ✅ qwen3:4b ready"
echo ""

# Pull Embedding model (nomic-embed-text)
echo "[4/5] Pulling nomic-embed-text (Embeddings)..."
ollama pull nomic-embed-text
echo "  ✅ nomic-embed-text ready"
echo ""

# Verify models
echo "[5/5] Verifying installed models..."
ollama list
echo ""

echo "=========================================="
echo "  ✅ All models installed successfully!"
echo "=========================================="
echo ""
echo "Model assignments:"
echo "  Manager AI    → qwen3:8b"
echo "  Dashboard AI  → qwen3:8b"
echo "  Chat AI       → qwen3:4b"
echo "  Embeddings    → nomic-embed-text"
echo ""
echo "Expected response times:"
echo "  Dashboard plan: 1-2 sec (GPU) / 3-5 sec (CPU)"
echo "  Chart commands: 0.5-1 sec (GPU) / 2-4 sec (CPU)"
echo "  Chat answers:   1-2 sec (GPU) / 3-8 sec (CPU)"
echo ""
echo "Run your backend: npm run dev:backend"
