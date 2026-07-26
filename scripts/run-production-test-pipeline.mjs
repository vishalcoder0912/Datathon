import { execSync, spawn } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT_DIR = resolve('.');
const COLOR = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function printHeader(title) {
  console.log(`\n${COLOR.cyan}${COLOR.bold}======================================================================`);
  console.log(`🚀 ${title}`);
  console.log(`======================================================================${COLOR.reset}`);
}

function runCommand(command, cwd = ROOT_DIR, env = {}) {
  console.log(`${COLOR.blue}Executing: ${command} (in ${cwd})${COLOR.reset}`);
  try {
    execSync(command, { 
      cwd, 
      stdio: 'inherit', 
      env: { ...process.env, ...env } 
    });
    console.log(`${COLOR.green}✓ Success${COLOR.reset}`);
    return true;
  } catch (err) {
    console.error(`${COLOR.red}✗ Command failed: ${err.message}${COLOR.reset}`);
    return false;
  }
}

// 1. Static Analysis (ESLint & TypeScript checking)
function runStaticAnalysis() {
  printHeader("STAGE 1: Static Analysis (ESLint & TypeScript)");
  // Let's run compilation check on frontend workspace
  const tsCheck = runCommand("npx tsc --noEmit", join(ROOT_DIR, "apps/frontend"));
  const lintCheck = runCommand("npm run lint", ROOT_DIR);
  return tsCheck && lintCheck;
}

// 2. Local Custom Secret Scanner (Free replacement for Gitleaks)
function runSecretScanner() {
  printHeader("STAGE 2: Secret & Credential Leakage Scan");
  
  // Custom simple file scanner matching gitleaks rules
  const rules = [
    { name: "AWS Key", regex: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/ },
    { name: "JWT Secret Pattern", regex: /(jwt_secret|jwt-secret|jwtsecret)\s*[:=]\s*['"][a-z0-9_-]{12,}['"]/i },
    { name: "Generic Password In Code", regex: /(api_key|client_secret|client_private_key|db_password)\s*[:=]\s*['"][a-zA-Z0-9_\-\.\@\#\$\%\^\&\*\(\)\+]{16,}['"]/i }
  ];

  const excludeDirs = ['node_modules', '.git', 'dist', 'coverage', 'reports', 'graphify-out', '.tmp_schema_trained_patch', '.agents'];
  let leaksCount = 0;

  function scanDir(dir) {
    const files = readdirSync(dir);
    for (const file of files) {
      const fullPath = join(dir, file);
      const relativePath = join(dir, file).replace(ROOT_DIR, '');
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (excludeDirs.some(ex => file.includes(ex))) continue;
        scanDir(fullPath);
      } else {
        if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.json') || file.endsWith('.env.example')) {
          const content = readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            for (const rule of rules) {
              if (rule.regex.test(lines[i])) {
                // Ignore matching configuration files and environment templates
                if (file === 'gitleaks.toml' || file === 'run-production-test-pipeline.mjs') continue;
                console.error(`${COLOR.red}⚠️ Leak Detected [${rule.name}] in ${relativePath}:${i+1}:${COLOR.reset}`);
                console.error(`   > ${lines[i].trim()}`);
                leaksCount++;
              }
            }
          }
        }
      }
    }
  }

  scanDir(ROOT_DIR);
  if (leaksCount > 0) {
    console.error(`${COLOR.red}✗ Secret scan failed: ${leaksCount} potential credentials found in source files!${COLOR.reset}`);
    return false;
  }
  console.log(`${COLOR.green}✓ No secrets detected in the codebase.${COLOR.reset}`);
  return true;
}

// 3. Security Vulnerability Checks (NPM Audit)
function runVulnerabilityScan() {
  printHeader("STAGE 3: Package Vulnerability Auditing");
  return runCommand("npm audit --audit-level=high", ROOT_DIR);
}

// 4. Backend & Integration Tests (Vitest)
function runBackendTests() {
  printHeader("STAGE 4: Backend & Integration Tests");
  return runCommand("npm run test:backend", ROOT_DIR);
}

// 5. Frontend & Component Tests (Vitest)
function runFrontendTests() {
  printHeader("STAGE 5: Frontend Component Tests");
  return runCommand("npm run test -w apps/frontend", ROOT_DIR);
}

// 6. Playwright End-to-End Tests
async function runPlaywrightE2E() {
  printHeader("STAGE 6: Playwright End-to-End & UI Resiliency");
  // Set headless environment and run playwright
  return runCommand("npx playwright test", ROOT_DIR, { CI: 'true' });
}

// 7. Load & Stress Performance Tests
async function runLoadTests() {
  printHeader("STAGE 7: Local Load & API Stress Simulation");
  
  // We need to temporarily spawn the backend server to load test it
  return new Promise((resolve) => {
    console.log(`${COLOR.blue}Spawning backend server for load tests...${COLOR.reset}`);
    const server = spawn('node', ['apps/backend/src/index.js'], {
      cwd: ROOT_DIR,
      env: { ...process.env, PORT: '3001', NODE_ENV: 'development' }
    });

    let stdoutBuffer = '';
    server.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      if (stdoutBuffer.includes('Server running on') || stdoutBuffer.includes('InsightFlow API started')) {
        console.log(`${COLOR.green}Backend server spun up successfully!${COLOR.reset}`);
        
        // Start the load test runner
        const testStatus = runCommand("node scripts/local-load-tester.js", ROOT_DIR);
        
        // Kill the server
        console.log(`${COLOR.blue}Tearing down load test server...${COLOR.reset}`);
        server.kill('SIGTERM');
        resolve(testStatus);
      }
    });

    server.stderr.on('data', (data) => {
      console.error(`${COLOR.red}Server Error: ${data.toString()}${COLOR.reset}`);
    });

    server.on('close', () => {
      resolve(false);
    });

    // Timeout fallback after 15 seconds if server fails to start
    setTimeout(() => {
      server.kill('SIGTERM');
      resolve(false);
    }, 15000);
  });
}

// Main Orchestrator
async function main() {
  console.log(`${COLOR.cyan}${COLOR.bold}======================================================================`);
  console.log(`🏗️  InsightFlow Production Readiness Testing Pipeline`);
  console.log(`======================================================================${COLOR.reset}`);

  const report = {
    staticAnalysis: runStaticAnalysis(),
    secrets: runSecretScanner(),
    vulnerabilityAudit: runVulnerabilityScan(),
    backendTests: runBackendTests(),
    frontendTests: runFrontendTests(),
    e2eTests: await runPlaywrightE2E(),
    loadTests: await runLoadTests()
  };

  printHeader("PIPELINE EXECUTION SUMMARY");
  
  let pipelineSuccess = true;
  for (const [stage, success] of Object.entries(report)) {
    const statusText = success ? `${COLOR.green}PASSED` : `${COLOR.red}FAILED`;
    console.log(`   - ${stage.padEnd(20)}: ${statusText}${COLOR.reset}`);
    if (!success) pipelineSuccess = false;
  }

  console.log(`\n${COLOR.cyan}======================================================================${COLOR.reset}`);
  if (pipelineSuccess) {
    console.log(`🎉 ${COLOR.green}${COLOR.bold}ALL STAGES PASSED! The application is fully production-hardened and ready for Zoho Catalyst deployment!${COLOR.reset}`);
    process.exit(0);
  } else {
    console.error(`🚨 ${COLOR.red}${COLOR.bold}PIPELINE FAILED: Please fix the errors listed above before deploying.${COLOR.reset}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Pipeline crashed:", err);
  process.exit(1);
});
