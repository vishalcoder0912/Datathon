import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'CODEBASE_EXPORT.md');
const IGNORE_FILE = path.join(PROJECT_ROOT, '.gitignore');

const INCLUDED_EXTENSIONS = new Set([
  '.bat', '.cjs', '.css', '.env.example', '.html', '.js', '.json',
  '.jsx', '.mjs', '.md', '.ps1', '.py', '.scss', '.sh', '.sql',
  '.ts', '.tsx', '.txt', '.yaml', '.yml',
]);

const EXTENSIONLESS_ALLOWLIST = new Set([
  '.gitignore', 'Dockerfile', 'Modelfile',
]);

const ALWAYS_IGNORE_DIRS = new Set([
  '.git', 'node_modules', '.next', '.expo', 'dist', 'build',
  'coverage', 'logs', 'reports', 'exports', '.tmp_schema_trained_patch',
  '.vscode', '.idea', '.claude', '.windsurf', '.agents',
]);

const ALWAYS_IGNORE_FILES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
  'CODEBASE_EXPORT.md', 'PROJECT_FULL_CODEBASE_ONE_FILE.md',
  'PROJECT_AI_SAFE.md', 'PROJECT_ARCHITECTURE.md',
  'CODEBASE_DEEP.md', 'CODEBASE_ARCHITECTURE.md', 'CODEBASE_MANIFEST.json',
  'firebase-adminsdk.json', 'serviceAccountKey.json', '.env',
]);

const ALWAYS_IGNORE_EXTS = new Set([
  '.7z', '.avif', '.bmp', '.db', '.docx', '.exe', '.gif', '.ico',
  '.jpeg', '.jpg', '.lock', '.log', '.mp3', '.mp4', '.pdf',
  '.png', '.sqlite', '.svg', '.webm', '.webp', '.woff', '.woff2', '.zip',
]);

const MAX_FILE_BYTES = 1_000_000;
const LANG_MAP = new Map([
  ['bat', 'bat'], ['cjs', 'js'], ['mjs', 'js'],
  ['ps1', 'powershell'], ['py', 'python'], ['sh', 'bash'],
  ['yaml', 'yaml'], ['yml', 'yaml'],
  ['Dockerfile', 'dockerfile'], ['Modelfile', 'text'],
]);

const SECRET_PATTERNS = [
  [/(AIza[0-9A-Za-z-_]{35})/g, '[REDACTED_FIREBASE_API_KEY]'],
  [/(sk-(?:proj-)?[0-9A-Za-z_-]{20,})/g, '[REDACTED_API_KEY]'],
  [/(sk_(?:live|test)_[0-9A-Za-z]+)/g, '[REDACTED_STRIPE_SECRET_KEY]'],
  [/(pk_(?:live|test)_[0-9A-Za-z]+)/g, '[REDACTED_STRIPE_PUBLIC_KEY]'],
  [/(gh[pousr]_[0-9A-Za-z_]{36,255})/g, '[REDACTED_GITHUB_TOKEN]'],
  [/(xox[baprs]-[0-9A-Za-z-]{20,})/g, '[REDACTED_SLACK_TOKEN]'],
  [/(-----BEGIN [A-Z ]*PRIVATE KEY-----)[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----)/g, '$1 [REDACTED_PRIVATE_KEY] $2'],
  [/((?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/[^:\s/@]+:)([^@\s]+)(@[^\s"'`<>)]+)/gi, '$1[REDACTED_PASSWORD]$3'],
];

const ENV_SECRET_PATTERN = /^(\s*["']?[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|ACCESS_KEY|REFRESH_TOKEN|AUTH_KEY|CLIENT_SECRET|SERVICE_KEY)[A-Z0-9_]*["']?\s*[:=]\s*)["']?[^"',\n}]+["']?/gim;

async function parseGitignore() {
  const patterns = [];
  try {
    const content = await fs.readFile(IGNORE_FILE, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      patterns.push(trimmed);
    }
  } catch {}
  return patterns;
}

function matchesGitignore(relativePath, gitignorePatterns) {
  const posix = relativePath.split(path.sep).join('/');
  for (const pattern of gitignorePatterns) {
    if (pattern.startsWith('!')) continue;
    const p = pattern.replace(/\\/g, '/');
    if (posix === p || posix.startsWith(p + '/') || posix.endsWith('/' + p)) return true;
  }
  return false;
}

function isSecretLikeFile(fileName) {
  if (fileName === '.env.example') return false;
  const lower = fileName.toLowerCase();
  return (
    lower === '.env' || lower.startsWith('.env.') ||
    lower.includes('service-account') || lower.includes('service_account') ||
    lower.includes('private-key') || lower.includes('private_key') ||
    lower.includes('credential') || lower.includes('secret')
  );
}

function redactSecrets(content) {
  let result = content;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  result = result.replace(ENV_SECRET_PATTERN, '$1[REDACTED_SECRET]');
  return result;
}

async function collectFiles(directory, gitignorePatterns, files = [], skipped = []) {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const absolutePath = path.join(directory, entry.name);
    let relativePath = path.relative(PROJECT_ROOT, absolutePath);
    const posixPath = relativePath.split(path.sep).join('/');

    if (entry.name === 'node_modules') continue;
    if (ALWAYS_IGNORE_DIRS.has(entry.name)) {
      skipped.push({ file: posixPath + '/', reason: 'ignored directory' });
      continue;
    }

    if (entry.isDirectory()) {
      await collectFiles(absolutePath, gitignorePatterns, files, skipped);
      continue;
    }

    if (!entry.isFile()) continue;

    const fileName = path.basename(relativePath);
    const ext = path.extname(fileName).toLowerCase();

    if (isSecretLikeFile(fileName)) {
      skipped.push({ file: posixPath, reason: 'secret-like filename excluded' });
      continue;
    }
    if (ALWAYS_IGNORE_FILES.has(fileName)) {
      skipped.push({ file: posixPath, reason: 'always ignored file' });
      continue;
    }
    if (ALWAYS_IGNORE_EXTS.has(ext)) {
      skipped.push({ file: posixPath, reason: 'ignored extension' });
      continue;
    }
    if (matchesGitignore(relativePath, gitignorePatterns)) {
      skipped.push({ file: posixPath, reason: 'matched .gitignore' });
      continue;
    }

    const isAllowedExt = INCLUDED_EXTENSIONS.has(ext);
    const isExtensionlessAllowlisted = EXTENSIONLESS_ALLOWLIST.has(fileName);
    if (!isAllowedExt && !isExtensionlessAllowlisted) {
      skipped.push({ file: posixPath, reason: 'extension not included' });
      continue;
    }

    const stats = await fs.stat(absolutePath);
    if (stats.size > MAX_FILE_BYTES) {
      skipped.push({ file: posixPath, reason: `file > ${MAX_FILE_BYTES} bytes` });
      continue;
    }

    files.push({ absolutePath, file: posixPath, size: stats.size, ext });
  }
  return { files, skipped };
}

function buildDirectoryTree(files) {
  const tree = new Map();
  for (const { file } of files) {
    const parts = file.split('/');
    let current = tree;
    for (const part of parts) {
      if (!current.has(part)) current.set(part, new Map());
      current = current.get(part);
    }
  }

  const render = (node, depth = 0) => {
    const entries = [...node.entries()].sort(([a], [b]) => a.localeCompare(b));
    const lines = [];
    for (const [name, children] of entries) {
      lines.push('  '.repeat(depth) + '- ' + name);
      if (children.size > 0) lines.push(...render(children, depth + 1));
    }
    return lines;
  };
  return render(tree).join('\n');
}

function detectPackageInfo(files) {
  const packages = files.filter(f => f.file.endsWith('package.json'));
  const results = [];
  for (const pkg of packages) {
      try {
        const content = JSON.parse(fsSync.readFileSync(pkg.absolutePath, 'utf8'));
        results.push({
        file: pkg.file,
        name: content.name || '(unnamed)',
        version: content.version || '',
        scripts: content.scripts ? Object.keys(content.scripts) : [],
        deps: content.dependencies ? Object.keys(content.dependencies).length : 0,
        devDeps: content.devDependencies ? Object.keys(content.devDependencies).length : 0,
      });
    } catch {}
  }
  return results;
}

function detectEntrypoints(files) {
  const hints = ['main.tsx', 'main.ts', 'index.tsx', 'index.ts', 'App.tsx', 'App.tsx',
    'server.js', 'server.ts', 'app.py', 'vite.config.ts', 'vite.config.js'];
  return files.filter(f => hints.some(h => f.file.endsWith(h))).map(f => f.file).sort();
}

function detectEnvVars(files) {
  const pattern = /\b(?:process\.env|import\.meta\.env)\.([A-Z0-9_]+)/g;
  const vars = new Map();
  for (const file of files) {
    try {
      const content = fsSync.readFileSync(file.absolutePath, 'utf8');
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (!vars.has(match[1])) vars.set(match[1], []);
        vars.get(match[1]).push(file.file);
      }
    } catch {}
  }
  return [...vars.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function detectApiEndpoints(files) {
  const pattern = /["'`](\/api\/[^"'`\s,)]+)["'`]/g;
  const endpoints = new Map();
  for (const file of files) {
    try {
      const content = fsSync.readFileSync(file.absolutePath, 'utf8');
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (!endpoints.has(match[1])) endpoints.set(match[1], []);
        endpoints.get(match[1]).push(file.file);
      }
    } catch {}
  }
  return [...endpoints.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function detectRoutes(files) {
  const pattern = /<Route\b[^>]*\bpath=["']([^"']+)["'][^>]*>/g;
  const routes = [];
  for (const file of files) {
    try {
      const content = fsSync.readFileSync(file.absolutePath, 'utf8');
      let match;
      while ((match = pattern.exec(content)) !== null) {
        routes.push({ route: match[1], file: file.file });
      }
    } catch {}
  }
  return routes;
}

function languageFor(file) {
  const fileName = path.basename(file);
  const ext = path.extname(file).replace('.', '');
  return LANG_MAP.get(ext) || LANG_MAP.get(fileName) || ext || 'text';
}

function mdTable(headers, rows) {
  if (!rows.length) return '*None detected.*\n';
  const h = '| ' + headers.join(' | ') + ' |';
  const d = '| ' + headers.map(() => '---').join(' | ') + ' |';
  const b = rows.map(r => '| ' + r.map(c => String(c).replace(/\|/g, '\\|')).join(' | ') + ' |');
  return [h, d, ...b].join('\n');
}

async function writeExportFile(content) {
  const tempFile = path.join(
    PROJECT_ROOT,
    `.CODEBASE_EXPORT.${process.pid}.${Date.now()}.tmp`
  );

  await fs.writeFile(tempFile, content, 'utf8');

  try {
    await fs.rename(tempFile, OUTPUT_FILE);
    return OUTPUT_FILE;
  } catch (error) {
    if (!['EACCES', 'EPERM', 'EBUSY', 'UNKNOWN'].includes(error.code)) {
      try {
        await fs.unlink(tempFile);
      } catch {}
      throw error;
    }

    const fallbackFile = path.join(
      PROJECT_ROOT,
      `CODEBASE_EXPORT_${new Date().toISOString().replace(/[:.]/g, '-')}.md`
    );

    await fs.rename(tempFile, fallbackFile);
    console.warn(`Warning: could not replace CODEBASE_EXPORT.md (${error.code}).`);
    console.warn(`Generated fallback export instead: ${path.basename(fallbackFile)}`);
    return fallbackFile;
  }
}

async function generate() {
  console.log('Scanning project...');
  const gitignorePatterns = await parseGitignore();
  const { files: rawFiles, skipped } = await collectFiles(PROJECT_ROOT, gitignorePatterns);
  const files = rawFiles.sort((a, b) => a.file.localeCompare(b.file));

  console.log(`Found ${files.length} files to include, ${skipped.length} skipped.`);

  const packages = detectPackageInfo(files);
  const entrypoints = detectEntrypoints(files);
  const envVars = detectEnvVars(files);
  const apiEndpoints = detectApiEndpoints(files);
  const routes = detectRoutes(files);
  const totalLines = files.reduce((sum, f) => sum + f.size, 0);

  let output = '';
  output += `# Project Codebase Export\n\n`;
  output += `Generated: ${new Date().toISOString()}\n\n`;
  output += `> This file contains the full project architecture and source code. Sensitive information (API keys, tokens, passwords, private keys) has been redacted automatically.\n\n`;

  // ── Architecture Section ──
  output += `---\n\n`;
  output += `# Part 1: Architecture Overview\n\n`;

  output += `## Executive Summary\n\n`;
  output += `- Total files included: ${files.length}\n`;
  output += `- Total skipped: ${skipped.length}\n`;
  output += `- Total bytes: ${totalLines.toLocaleString()}\n`;
  output += `- Secret redaction: enabled\n\n`;

  output += `## Directory Tree\n\n`;
  output += '```text\n';
  output += buildDirectoryTree(files);
  output += '\n```\n\n';

  if (packages.length) {
    output += `## Packages / Workspaces\n\n`;
    output += mdTable(
      ['Name', 'File', 'Version', 'Scripts', 'Deps', 'DevDeps'],
      packages.map(p => [p.name, p.file, p.version, p.scripts.join(', '), p.deps, p.devDeps])
    );
    output += '\n';
  }

  if (entrypoints.length) {
    output += `## Entry Points\n\n`;
    for (const ep of entrypoints) output += `- ${ep}\n`;
    output += '\n';
  }

  if (routes.length) {
    output += `## Frontend Routes\n\n`;
    output += mdTable(['Route', 'File'], routes.map(r => [r.route, r.file]));
    output += '\n';
  }

  if (apiEndpoints.length) {
    output += `## API Endpoints\n\n`;
    output += mdTable(['Endpoint', 'Files'], apiEndpoints.map(([ep, files]) => [ep, files.join(', ')]));
    output += '\n';
  }

  if (envVars.length) {
    output += `## Environment Variables Referenced\n\n`;
    output += mdTable(['Variable', 'Files'], envVars.map(([v, f]) => [v, f.join(', ')]));
    output += '\n';
  }

  output += `## Skipped Paths\n\n`;
  output += mdTable(['Path', 'Reason'], skipped.map(s => [s.file, s.reason]));
  output += '\n';

  // ── Code Section ──
  output += `---\n\n`;
  output += `# Part 2: Full Source Code\n\n`;

  for (const file of files) {
    try {
      const rawContent = await fs.readFile(file.absolutePath, 'utf8');
      const content = redactSecrets(rawContent);
      output += `---\n\n## ${file.file}\n\n`;
      output += `\`\`\`${languageFor(file.file)}\n`;
      output += content;
      if (!content.endsWith('\n')) output += '\n';
      output += '```\n\n';
    } catch {
      output += `---\n\n## ${file.file}\n\n*Could not read file.*\n\n`;
    }
  }

  output += `---\n\n*Export complete. ${files.length} files, ${skipped.length} skipped.*\n`;

  const writtenFile = await writeExportFile(output);
  console.log(`\nDone! Generated ${path.relative(PROJECT_ROOT, writtenFile)}`);
  console.log(`  Included: ${files.length} files`);
  console.log(`  Skipped: ${skipped.length} paths`);
}

generate().catch(err => { console.error(err); process.exitCode = 1; });
