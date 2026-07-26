#!/bin/bash

# 🚀 InsightFlow Backend - Quick Start Script
# Run this to verify the new structure

set -e

echo "=================================="
echo "🚀 InsightFlow Backend Quick Start"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Phase 1: Check Node.js
echo -e "${BLUE}📦 Phase 1: Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js $NODE_VERSION installed${NC}"
else
    echo -e "${RED}❌ Node.js not installed${NC}"
    exit 1
fi
echo ""

# Phase 2: Install dependencies
echo -e "${BLUE}📦 Phase 2: Installing dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi
echo ""

# Phase 3: Check configuration
echo -e "${BLUE}⚙️  Phase 3: Checking configuration...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found, creating from .env.example${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ .env file created${NC}"
else
    echo -e "${GREEN}✅ .env file exists${NC}"
fi
echo ""

# Phase 4: Syntax check
echo -e "${BLUE}🧪 Phase 4: Running syntax checks...${NC}"
node --check src/index.js && echo -e "${GREEN}✅ src/index.js syntax OK${NC}" || echo -e "${RED}❌ src/index.js syntax error${NC}"
node --check src/core/server.js && echo -e "${GREEN}✅ src/core/server.js syntax OK${NC}" || echo -e "${RED}❌ src/core/server.js syntax error${NC}"
node --check src/config/environment.js && echo -e "${GREEN}✅ src/config/environment.js syntax OK${NC}" || echo -e "${RED}❌ src/config/environment.js syntax error${NC}"
node --check src/services/ai/ai-manager.js && echo -e "${GREEN}✅ src/services/ai/ai-manager.js syntax OK${NC}" || echo -e "${RED}❌ src/services/ai/ai-manager.js syntax error${NC}"
echo ""

# Phase 5: Check Ollama
echo -e "${BLUE}🦙 Phase 5: Checking Ollama...${NC}"
if command -v ollama &> /dev/null; then
    echo -e "${GREEN}✅ Ollama is installed${NC}"
    
    # Check if Ollama is running
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Ollama is running${NC}"
        
        # List available models
        echo -e "${BLUE}📦 Available models:${NC}"
        ollama list
    else
        echo -e "${YELLOW}⚠️  Ollama is not running. Start with: ollama serve${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Ollama not installed. Install from: https://ollama.ai${NC}"
fi
echo ""

# Phase 6: Start server
echo -e "${BLUE}🚀 Phase 6: Ready to start server${NC}"
echo ""
echo -e "${GREEN}=================================="
echo "✅ Setup Complete!"
echo "=================================="
echo ""
echo "To start the server:"
echo -e "  ${BLUE}npm run dev${NC}"
echo ""
echo "To test endpoints:"
echo -e "  ${BLUE}curl http://localhost:3001/api/health${NC}"
echo -e "  ${BLUE}curl http://localhost:3001/api/ai/status${NC}"
echo ""
echo "For migration instructions:"
echo -e "  ${BLUE}cat MIGRATION_GUIDE.md${NC}"
echo ""
