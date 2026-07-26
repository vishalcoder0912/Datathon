#!/bin/bash

echo "🚀 Starting InsightFlow Stack..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Terminal 1: Backend
echo -e "${YELLOW}[1/3] Starting Backend...${NC}"
osascript -e 'tell app "Terminal" to do script "cd '$PWD'/apps/backend && npm run dev"' 2>/dev/null || \
  gnome-terminal -- bash -c "cd '$PWD'/apps/backend && npm run dev" 2>/dev/null || \
  echo "Please manually run: cd apps/backend && npm run dev"

sleep 2

# Terminal 2: Frontend
echo -e "${YELLOW}[2/3] Starting Frontend...${NC}"
osascript -e 'tell app "Terminal" to do script "cd '$PWD'/apps/frontend && npm run dev"' 2>/dev/null || \
  gnome-terminal -- bash -c "cd '$PWD'/apps/frontend && npm run dev" 2>/dev/null || \
  echo "Please manually run: cd apps/frontend && npm run dev"

sleep 2

# Terminal 3: ML Service
echo -e "${YELLOW}[3/3] Starting ML Service...${NC}"
osascript -e 'tell app "Terminal" to do script "cd '$PWD'/apps/ml-service && python app.py"' 2>/dev/null || \
  gnome-terminal -- bash -c "cd '$PWD'/apps/ml-service && python app.py" 2>/dev/null || \
  echo "Please manually run: cd apps/ml-service && python app.py"

echo -e "\n${GREEN}✅ All services starting...${NC}"
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:8080"
echo "ML Service: http://localhost:5000"
echo ""
echo "Run './test-integration.sh' to verify everything is working"
