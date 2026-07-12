#!/bin/bash

echo "🧪 Testing InsightFlow Integration..."
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check Backend Running
echo -e "\n${YELLOW}[Test 1] Checking Backend...${NC}"
if curl -s http://localhost:3001/api/health > /dev/null; then
  echo -e "${GREEN}✅ Backend is running${NC}"
else
  echo -e "${RED}❌ Backend is not running${NC}"
fi

# Test 2: Check ML Service Running
echo -e "\n${YELLOW}[Test 2] Checking ML Service...${NC}"
if curl -s http://localhost:5000/api/ml/health > /dev/null; then
  echo -e "${GREEN}✅ ML Service is running${NC}"
else
  echo -e "${RED}❌ ML Service is not running${NC}"
fi

# Test 3: Check Frontend Running
echo -e "\n${YELLOW}[Test 3] Checking Frontend...${NC}"
if curl -s http://localhost:8080 > /dev/null; then
  echo -e "${GREEN}✅ Frontend is running${NC}"
else
  echo -e "${RED}❌ Frontend is not running${NC}"
fi

# Test 4: Cache Stats
echo -e "\n${YELLOW}[Test 4] Checking Cache...${NC}"
CACHE=$(curl -s http://localhost:3001/api/cache/stats)
echo -e "${GREEN}✅ Cache Stats: ${NC}"
echo "$CACHE" | jq '.' 2>/dev/null || echo "$CACHE"

echo -e "\n${GREEN}✅ Integration test complete!${NC}"
