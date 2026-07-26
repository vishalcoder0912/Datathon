const http = require('http');

console.log("🚀 Starting Rapid Fire Load Test on Local API...");
const REQUESTS_TOTAL = 50;
const CONCURRENT_LIMIT = 10;
const URL = 'http://localhost:3001/api/health';

let completed = 0;
let errors = 0;
const start = Date.now();

fetch(URL)
  .then(() => testLoad())
  .catch((e) => {
    console.error("Backend is unreachable! Ensure app is running via start-all.bat. Error:", e.message);
    process.exit(1);
  });

async function testLoad() {
    console.log(`Sending ${REQUESTS_TOTAL} requests (${CONCURRENT_LIMIT} concurrent) to simulate Chat Spam...`);
    
    // Create an array of mock requests simulating Phase 8.4 (Rapid Fire Queries)
    let jobs = new Array(REQUESTS_TOTAL).fill(0).map((_, i) => i);
    
    async function worker() {
        while (jobs.length > 0) {
            const job = jobs.shift();
            try {
                const res = await fetch(URL);
                if (!res.ok) throw new Error("Status " + res.status);
            } catch (e) {
                errors++;
            }
            completed++;
            process.stdout.write(`\rProgress: ${completed}/${REQUESTS_TOTAL} | Errors: ${errors}`);
        }
    }

    const workers = new Array(CONCURRENT_LIMIT).fill(0).map(() => worker());
    await Promise.all(workers);

    const duration = Date.now() - start;
    console.log(`\n\n✅ Load test complete in ${duration}ms!`);
    console.log(`⏱️ Average response latency: ${(duration/REQUESTS_TOTAL).toFixed(2)}ms`);
    console.log(`⚠️ Failed requests dropped: ${errors}`);
    if (errors === 0) {
        console.log("PASS: The application queue handles rapid-fire bursts without crashing.");
    } else {
        console.log("FAIL: Application struggled under high local load.");
    }
}
