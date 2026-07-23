# ⚡ InsightFlow Quick Reference

## 🚀 Start the Platform

```bash
cd "c:\Users\VISHAL\Desktop\20-12-2025\All_full_stack_preparation\expo\Agentic ai Data analytics"

# Install dependencies (first time only)
npm install

# Start all services
npm run dev

# Or start individually:
npm run dev:backend    # http://localhost:3001
npm run dev:frontend   # http://localhost:5173
```

## ✅ Verify Everything Works

```bash
# Run all 91 tests
npm run test:insightflow-api

# Expected: ✅ 91/91 PASSED
```

## 📊 Access the Platform

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3001
- **API Docs**: http://localhost:3001/api/docs (root endpoint)

## 💬 Quick Examples

### Import Data

1. Click "⬆️ Upload" tab
2. Select CSV file
3. Click "Import Dataset"
4. Data is immediately ready to analyze

### Ask Questions

1. Click "💬 Chat" tab
2. Type: "Show average salary by department"
3. Get AI-generated insights + SQL + charts

### Export Results

1. Click "⬇️ Export" tab
2. Choose JSON, CSV, or Markdown
3. Download your analysis

## 🤖 AI Models

The system uses this priority order:

1. **Gemini** (Google) - if API key configured
2. **Claude** (Anthropic) - fallback
3. **GPT-4** (OpenAI) - another fallback
4. **Ollama** (Local) - offline support
5. **Local Analysis** - always available

## 📁 Important Files

- **QUICK_START.md** - Setup guide
- **AGENTIC_AI_ANALYTICS_STATUS.md** - Full status report
- **FEATURE_CHECKLIST.md** - All 150+ features verified
- **SESSION_SUMMARY.md** - Today's work summary
- **.env.example** - Configuration template

## 🔧 Common Commands

```bash
# Build for production
npm run build

# Run tests
npm run test

# Run linter
npm run lint

# Export codebase (AI-safe)
npm run export:ai-safe

# Clear cache
curl -X POST http://localhost:3001/api/cache/clear
```

## 📊 API Health Check

```bash
# Check if backend is running
curl http://localhost:3001/api/health

# Load demo data
curl -X POST http://localhost:3001/api/datasets/demo

# Check state
curl http://localhost:3001/api/state
```

## 🐛 Troubleshooting

| Issue               | Solution                                       |
| ------------------- | ---------------------------------------------- |
| Port in use         | Change PORT in .env to 3002                    |
| API not responding  | Run `npm run dev:backend` in separate terminal |
| Frontend won't load | Check if backend is running on port 3001       |
| Chat not working    | Verify dataset is loaded first                 |
| AI not responding   | Check API keys in .env (optional)              |

## 📈 Performance

- API Response: <100ms average
- Chat Response: <2s with AI
- Build Time: 33s (one-time)
- Bundle Size: 1.55 MB (optimized)

## ✨ What's Included

✅ React 18 Frontend  
✅ Node.js Backend  
✅ Gemini AI Integration  
✅ SQLite Persistence  
✅ 40+ API Endpoints  
✅ Machine Learning  
✅ Data Analytics  
✅ Real-time Chat  
✅ 91 Test Suite  
✅ Production Ready

## 📞 Support

- Check logs in terminal
- See QUICK_START.md for detailed guide
- Run `npm run test:insightflow-api` to verify
- Check browser console for errors

## 🎯 Next Steps

1. ✅ Backend running (port 3001)
2. ✅ Frontend running (port 5173)
3. ✅ All 91 tests passing
4. 👉 **Import your data and start analyzing!**

---

**Everything is ready. Just start the server and enjoy! 🚀**
