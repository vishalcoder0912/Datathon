/**
 * ⚡ Native Node.js Zero-Cost Load & Stress Testing Tool
 * Emulates k6/Artillery load runs by hitting local endpoints concurrently.
 */
import { request } from 'node:http';

const CONFIG = {
  targetUrl: 'http://localhost:3001/api/health',
  concurrencies: [10, 50, 100], // Stages of users
  requestsPerUser: 5,           // Total requests per simulated user session
};

async function hitEndpoint(url) {
  const start = Date.now();
  return new Promise((resolve) => {
    const req = request(url, { method: 'GET', timeout: 2000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          latency: Date.now() - start,
          success: res.statusCode === 200
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 500,
        latency: Date.now() - start,
        success: false,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        statusCode: 408,
        latency: Date.now() - start,
        success: false,
        error: 'Timeout'
      });
    });

    req.end();
  });
}

async function runStage(concurrency) {
  console.log(`\n🚀 Starting load stage: ${concurrency} concurrent users...`);
  const promises = [];
  
  // Create concurrent virtual user operations
  for (let u = 0; u < concurrency; u++) {
    promises.push((async () => {
      const userResults = [];
      for (let r = 0; r < CONFIG.requestsPerUser; r++) {
        const res = await hitEndpoint(CONFIG.targetUrl);
        userResults.push(res);
      }
      return userResults;
    })());
  }

  const startTime = Date.now();
  const rawResults = await Promise.all(promises);
  const totalDuration = Date.now() - startTime;
  
  const results = rawResults.flat();
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  const latencies = results.map(r => r.latency).sort((a, b) => a - b);
  const minLatency = latencies[0] || 0;
  const maxLatency = latencies[latencies.length - 1] || 0;
  const avgLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length || 0;
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || 0;
  
  console.log(`📊 Stage Completed in ${totalDuration}ms`);
  console.log(`   - Total Requests Sent: ${results.length}`);
  console.log(`   - Success Rate: ${((successful.length / results.length) * 100).toFixed(2)}% (${successful.length}/${results.length})`);
  console.log(`   - Throughput: ${(results.length / (totalDuration / 1000)).toFixed(2)} req/sec`);
  console.log(`   - Latency Stats:`);
  console.log(`     Min:  ${minLatency.toFixed(1)}ms`);
  console.log(`     Avg:  ${avgLatency.toFixed(1)}ms`);
  console.log(`     p95:  ${p95Latency.toFixed(1)}ms`);
  console.log(`     Max:  ${maxLatency.toFixed(1)}ms`);

  if (failed.length > 0) {
    console.warn(`   ⚠️ Failures encountered: ${failed.length} requests failed. Sample error: "${failed[0].error || 'HTTP ' + failed[0].statusCode}"`);
  }

  return {
    concurrency,
    successRate: successful.length / results.length,
    p95Latency,
    reqPerSec: results.length / (totalDuration / 1000)
  };
}

async function main() {
  console.log('⚡ Starting InsightFlow Local Load and Stress Simulator');
  console.log(`🔗 Target URL: ${CONFIG.targetUrl}`);
  
  const reports = [];
  for (const c of CONFIG.concurrencies) {
    const report = await runStage(c);
    reports.push(report);
  }
  
  console.log('\n======================================================');
  console.log('🏁 LOAD TESTING REPORT SUMMARY');
  console.log('======================================================');
  console.table(reports);
  
  const hasFailures = reports.some(r => r.successRate < 0.98);
  if (hasFailures) {
    console.error('❌ Load testing failed: success rate dropped below 98% under load.');
    process.exit(1);
  } else {
    console.log('✅ Load testing completed successfully. Server is stable!');
    process.exit(0);
  }
}

// Auto-run if executed directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith('local-load-tester.js')) {
  main().catch(err => {
    console.error('Fatal load tester error:', err);
    process.exit(1);
  });
}
