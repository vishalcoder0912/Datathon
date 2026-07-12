const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log("🧪 Starting Backend Functional Tests...");

  // 1. Upload
  console.log("\n[Test 1] Uploading Sample Dataset...");
  const samplePath = "c:\\Users\\VISHAL\\Desktop\\20-12-2025\\All_full_stack_preparation\\expo\\retry-the-project\\sample.csv";
  // The app either parses from frontend or uses multipart, let's see. If the backend accepts raw json, we can mock it.
  
  // Wait, let's just test basic health first
  try {
    const res = await fetch('http://localhost:3001/api/health');
    const data = await res.json();
    console.log("Health:", data);
  } catch(e) { console.error("Backend health failed", e.message); }

  console.log("\n✅ End tests");
}
runTests();
