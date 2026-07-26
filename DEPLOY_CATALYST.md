# KAVACH AI - Zoho Catalyst Deployment Guide

> **For beginners**: This guide will help you put your app live on the internet step by step. No technical background needed — just follow the instructions in order.

---

## 📋 What We're Building

| Part | What it does | Technology |
|------|-------------|------------|
| **Frontend** | The website you see in browser | React (HTML/CSS/JavaScript) |
| **Backend** | The brain that processes data | Node.js |
| **ML Service** | AI and analytics engine | Python |
| **Database** | Stores all information | PostgreSQL + PostGIS |

---

## 🧰 What You Need Before Starting

1. **A Zoho Catalyst account** → Go to https://catalyst.zoho.com and sign up (free trial available)
2. **Node.js** installed on your computer → Download from https://nodejs.org (get version 20 or 22)
3. **Python** installed → Download from https://www.python.org (get version 3.10 or 3.11)
4. **Git** installed → Download from https://git-scm.com
5. **Docker Desktop** installed → Download from https://www.docker.com/products/docker-desktop
6. **Your project code** (this repository)

---

## 📁 Step 1: Prepare Your Project Folder

1. Open the folder where your project is saved (the one with `package.json`, `apps/`, etc.)
2. We'll call this your **project folder** throughout this guide

---

## 🌐 Step 2: Create a Zoho Catalyst Project

1. Go to https://console.catalyst.zoho.com
2. Login with your Zoho account
3. Click **"Create Project"**
4. Enter project name: `KAVACH AI` (or anything you like)
5. Select region closest to you (e.g., US East, Europe)
6. Click **Create**

---

## 📦 Step 3: Install Zoho Catalyst CLI (Command Line Tool)

Open **Command Prompt** (Windows) or **Terminal** (Mac):

1. Press `Windows Key + R`, type `cmd`, press Enter
2. Type this command and press Enter:
   ```
   npm install -g zcatalyst-cli
   ```
3. Wait for installation to finish (may take 1-2 minutes)
4. Login to Catalyst:
   ```
   zcatalyst login
   ```
5. A browser window will open — login with your Zoho account
6. Go back to Command Prompt — it should say "Logged in successfully"

---

## 🖼️ Step 4: Deploy the Frontend (Website)

The frontend is the website your users will see. We need to build it and upload it.

### 4.1 Build the website

1. In Command Prompt, navigate to the frontend folder:
   ```
   cd apps/frontend
   ```
2. Install required packages:
   ```
   npm install
   ```
3. Build the website:
   ```
   npm run build
   ```

This creates a `dist` folder inside `apps/frontend/` — this is your ready-to-upload website.

### 4.2 Upload to Catalyst

1. Go back to your project folder:
   ```
   cd ../..
   ```
2. Go to Catalyst Console in your browser (https://console.catalyst.zoho.com)
3. Click on your **KAVACH AI** project
4. In the left menu, click **"Hosting"**
5. Click **"Static App"**
6. Click **"Create Static App"**
7. Give it a name: `kavach-frontend`
8. Upload the `apps/frontend/dist` folder:
   - Click "Upload Files"
   - Select all files inside the `dist` folder
   - Or drag-and-drop the entire `dist` folder
9. Click **Deploy**
10. Wait for deployment to complete (30-60 seconds)
11. **Copy the URL shown** (looks like `https://kavach-frontend-NNN.hosting.catalyst.app`)
    - Save this URL — you'll need it later!

> ✅ **Done!** Your website is now live on the internet.

---

## 🗄️ Step 5: Set Up the Database

We need a database to store all the crime data.

### 5.1 Create PostgreSQL database

1. In Catalyst Console, click **"Cloud Database"** in the left menu
2. Click **"PostgreSQL"**
3. Click **"Create PostgreSQL Instance"**
4. Choose:
   - **Name**: `kavach-db`
   - **Type**: `Development` (for testing) or `Production` (for live use)
   - **Region**: Same as your project
5. Click **Create** (takes 2-5 minutes)
6. Once ready, click on your database to see its details
7. **Copy the Connection String** — it looks like:
   ```
   postgresql://username:password@hostname:5432/dbname
   ```

### 5.2 Enable PostGIS (map features)

1. In the database console, click **"SQL Console"**
2. Paste this and click **Run**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. You should see "CREATE EXTENSION" — this means maps will work!

### 5.3 Run database migrations (set up tables)

Open Command Prompt in your project folder and run:

```
npm run db:migrate
```

Wait for it to finish (should say "Migration complete").

Then seed the demo data:

```
npm run db:seed
npm run db:migrate-demo
```

---

## ⚙️ Step 6: Deploy the Backend (Server)

The backend is the server that processes login, data requests, and runs the app logic.

### 6.1 Create the Catalyst function folder

1. In your project folder, create a new folder called `functions`
2. Inside it, create another folder called `backend`
3. Inside `backend`, create a file called `catalyst-config.json`

### 6.2 Create the Dockerfile

Inside your project folder, create a file called `backend.Dockerfile` (no extension).

Ask someone to help you create these files, or use this simple method:

1. Open Notepad
2. Copy-paste this exactly:

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY packages/shared-analytics/ packages/shared-analytics/
COPY packages/kavach-domain/ packages/kavach-domain/
RUN npm install --workspaces --include-workspace-root
COPY apps/backend/src apps/backend/src
COPY apps/backend/data apps/backend/data
ENV PORT=3001
EXPOSE 3001
CMD ["node", "apps/backend/src/index.js"]
```

3. Save as `backend.Dockerfile` in your project folder
   - In Notepad, choose "Save as type: All Files (*.*)"
   - Name it exactly `backend.Dockerfile`

### 6.3 Create the function config

Create another file `catalyst-config.json` inside `functions/backend/`:

```json
{
  "name": "backend",
  "type": "advanced",
  "runtime": "docker",
  "port": 3001,
  "dockerfile": "../../backend.Dockerfile"
}
```

### 6.4 Deploy the backend

In Command Prompt (from your project folder):

```
zcatalyst functions:deploy --function backend
```

This will take 3-5 minutes. Once done, it will show a URL like:
```
https://backend-NNN.catalystfunctions.com
```

**Copy this URL** — you'll need it!

> ✅ **Done!** Your backend server is now running on the internet.

---

## 🤖 Step 7: Deploy the ML Service (AI Engine)

The ML service handles AI analytics and dashboard generation.

### 7.1 Create the function folder

1. Inside `functions/`, create a new folder called `ml-service`
2. Inside it, create `catalyst-config.json`

### 7.2 Create the function config

In `functions/ml-service/catalyst-config.json`, add:

```json
{
  "name": "ml-service",
  "type": "advanced",
  "runtime": "docker",
  "port": 5000,
  "dockerfile": "../../apps/ml-service/Dockerfile"
}
```

### 7.3 Deploy the ML service

```
zcatalyst functions:deploy --function ml-service
```

Wait 3-5 minutes. Copy the URL shown (looks like `https://ml-service-NNN.catalystfunctions.com`).

> ✅ **Done!** Your AI service is live.

---

## 🔗 Step 8: Connect Everything Together

Now we need to tell each part where the others are.

### 8.1 Set environment variables

1. Go to Catalyst Console → Your Project
2. Click **"Environment Variables"** in the left menu
3. Click **"Add Variable"** for each of the following:

| Variable Name | Value |
|--------------|-------|
| NODE_ENV | production |
| DATABASE_URL | *(your PostgreSQL connection string from Step 5)* |
| DATABASE_SSL | true |
| KAVACH_DATA_SOURCE | postgres |
| JWT_ACCESS_SECRET | *(type random letters/numbers: at least 32 characters)* |
| JWT_REFRESH_SECRET | *(type different random letters/numbers: at least 32 characters)* |
| SEED_ADMIN_PASSWORD | *(choose a strong password for admin login)* |
| CORS_ALLOWED_ORIGINS | *(your frontend URL from Step 4)* |
| ML_SERVICE_URL | *(your ML service URL from Step 7)* |

4. Click **Save**

### 8.2 Rebuild frontend with correct API URL

1. Go back to Command Prompt
2. Navigate to frontend:
   ```
   cd apps/frontend
   ```
3. Run:
   ```
   npm install
   ```
4. Build with the correct backend URL (replace the example URL with yours):
   ```
   set VITE_API_BASE_URL=https://backend-NNN.catalystfunctions.com
   npm run build
   ```
   *(On Mac, use `export` instead of `set`)*

5. Upload the new `dist` folder to Catalyst Static App (same as Step 4.2)

---

## ✅ Step 9: Test Your Live App

1. Open your **frontend URL** in a browser (from Step 4)
2. You should see the KAVACH AI login page
3. Login with:
   - **Email**: `admin@kavach.local`
   - **Password**: *(the SEED_ADMIN_PASSWORD you set in Step 8.1)*
4. If login works, everything is connected!

---

## 🔍 Common Problems & Fixes

| Problem | What to do |
|---------|-----------|
| **"Cannot connect to server"** | Make sure `VITE_API_BASE_URL` is set correctly when building frontend |
| **Login fails** | Check that `SEED_ADMIN_PASSWORD` in environment variables matches your migration |
| **Blank white page** | Check browser console (F12 → Console) for errors; likely CORS issue |
| **Maps not loading** | Make sure PostGIS extension was enabled in SQL Console |
| **"ECONNREFUSED" error** | Database connection string might be wrong — check it in Catalyst Console |
| **App is slow** | Upgrade Catalyst resources in Console → Project Settings |

---

## 📱 Quick Reference Card

```
Frontend URL:  https://kavach-frontend-xxx.hosting.catalyst.app
Backend URL:   https://backend-xxx.catalystfunctions.com
ML Service:    https://ml-service-xxx.catalystfunctions.com
Database:      postgresql://user:pass@host:5432/kavach
Admin Login:   admin@kavach.local / <your-password>
```

---

## 📞 Need Help?

- Zoho Catalyst Documentation: https://docs.catalyst.zoho.com
- Zoho Catalyst Support: https://help.zoho.com/portal/catalyst
- For code issues, check the `docs/` folder in your project