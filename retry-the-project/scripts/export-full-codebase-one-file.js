import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'PROJECT_FULL_CODEBASE_ONE_FILE.md');

const INCLUDED_EXTENSIONS = new Set([
  '.bat',
  '.cjs',
  '.css',
  '.env.example',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.ps1',
  '.py',
  '.scss',
  '.sh',
  '.sql',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const IGNORED_DIRECTORIES = new Set([
  '.agents',
  '.claude',
  '.cursor',
  '.firebase',
  '.git',
  '.next',
  '.pytest_cache',
  '.tmp_schema_trained_patch',
  '.vscode',
  '.windsurf',
  'build',
  'coverage',
  'data',
  'dist',
  'dist-ssr',
  'exports',
  'logs',
  'node_modules',
  'playwright-report',
  'reports',
  'uploads',
]);

const IGNORED_FILENAMES = new Set([
  'CODEBASE_ARCHITECTURE.md',
  'CODEBASE_DEEP.md',
  'CODEBASE_MANIFEST.json',
  'firebase-adminsdk.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'PROJECT_AI_SAFE.md',
  'PROJECT_ARCHITECTURE.md',
  'PROJECT_FULL_CODEBASE_ONE_FILE.md',
  'serviceAccountKey.json',
  'yarn.lock',
]);

const IGNORED_EXTENSIONS = new Set([
  '.7z',
  '.avif',
  '.bmp',
  '.db',
  '.docx',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.lock',
  '.log',
  '.mp3',
  '.mp4',
  '.pdf',
  '.png',
  '.sqlite',
  '.svg',
  '.webm',
  '.webp',
  '.woff',
  '.woff2',
  '.zip',
]);

const MAX_FILE_BYTES = 1_000_000;

const toPosixPath = (filePath) => filePath.split(path.sep).join('/');

const isSecretLikeFilename = (fileName) => {
  const lowerName = fileName.toLowerCase();

  if (lowerName === '.env.example') return false;

  return (
    lowerName === '.env' ||
    lowerName.startsWith('.env.') ||
    lowerName.includes('service-account') ||
    lowerName.includes('service_account') ||
    lowerName.includes('private-key') ||
    lowerName.includes('private_key') ||
    lowerName.includes('credential') ||
    lowerName.includes('secret')
  );
};

const isIgnoredFile = (relativePath) => {
  const fileName = path.basename(relativePath);
  const extension = path.extname(fileName).toLowerCase();

  if (isSecretLikeFilename(fileName)) {
    return true;
  }

  if (fileName.startsWith('firebase-adminsdk') && extension === '.json') {
    return true;
  }

  return IGNORED_FILENAMES.has(fileName) || IGNORED_EXTENSIONS.has(extension);
};

const EXTENSIONLESS_ALLOWLIST = new Set([
  '.gitignore',
  'Dockerfile',
  'Modelfile',
]);

const isIncludedFile = (relativePath) => {
  const fileName = path.basename(relativePath);
  const extension = path.extname(relativePath).toLowerCase();

  if (fileName === '.env.example') return true;
  if (EXTENSIONLESS_ALLOWLIST.has(fileName)) return !isIgnoredFile(relativePath);

  return INCLUDED_EXTENSIONS.has(extension) && !isIgnoredFile(relativePath);
};

const redactSecrets = (content) =>
  content
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_FIREBASE_API_KEY]')
    .replace(/sk-(?:proj-)?[0-9A-Za-z_-]{20,}/g, '[REDACTED_OPENAI_SECRET_KEY]')
    .replace(/sk_(?:live|test)_[0-9A-Za-z]+/g, '[REDACTED_STRIPE_SECRET_KEY]')
    .replace(/pk_(?:live|test)_[0-9A-Za-z]+/g, '[REDACTED_STRIPE_PUBLIC_KEY]')
    .replace(/gh[pousr]_[0-9A-Za-z_]{36,255}/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/xox[baprs]-[0-9A-Za-z-]{20,}/g, '[REDACTED_SLACK_TOKEN]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
    .replace(
      /\b((?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/[^:\s/@]+:)[^@\s]+(@[^\s"'`<>)]+)/gi,
      '$1[REDACTED_PASSWORD]$2',
    )
    .replace(
      /^(\s*["']?[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|ACCESS_KEY|REFRESH_TOKEN|AUTH_KEY|CLIENT_SECRET)[A-Z0-9_]*["']?\s*[:=]\s*)["']?[^"',\n}]+["']?/gim,
      '$1[REDACTED_SECRET]',
    );

const withFilePrefixedLines = (content, filePath) => {
  const lines = content.split(/\r?\n/);
  const lineWidth = String(lines.length).length;

  return lines
    .map((line, index) => `${filePath}:${String(index + 1).padStart(lineWidth, ' ')} | ${line}`)
    .join('\n');
};

const collectFiles = async (directory = PROJECT_ROOT, files = [], skipped = []) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(PROJECT_ROOT, absolutePath);
    const safeRelativePath = toPosixPath(relativePath);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        skipped.push({
          file: `${safeRelativePath}/`,
          reason: 'generated, dependency, report, or temporary directory',
        });
        continue;
      }

      await collectFiles(absolutePath, files, skipped);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!isIncludedFile(relativePath)) {
      skipped.push({
        file: safeRelativePath,
        reason: 'not an included source/documentation extension or secret-like filename',
      });
      continue;
    }

    const stats = await fs.stat(absolutePath);

    if (stats.size > MAX_FILE_BYTES) {
      skipped.push({
        file: safeRelativePath,
        reason: `larger than ${MAX_FILE_BYTES} bytes`,
      });
      continue;
    }

    files.push({
      absolutePath,
      file: safeRelativePath,
      size: stats.size,
    });
  }

  return { files, skipped };
};

const buildDirectoryTree = (files) => {
  const tree = new Map();

  for (const { file } of files) {
    const parts = file.split('/');
    let current = tree;

    for (const part of parts) {
      if (!current.has(part)) {
        current.set(part, new Map());
      }

      current = current.get(part);
    }
  }

  const render = (node, depth = 0) => {
    const entries = [...node.entries()].sort(([a], [b]) => a.localeCompare(b));
    const lines = [];

    for (const [name, children] of entries) {
      lines.push(`${'  '.repeat(depth)}- ${name}`);

      if (children.size > 0) {
        lines.push(...render(children, depth + 1));
      }
    }

    return lines;
  };

  return render(tree).join('\n');
};

const buildSummary = (files, skipped) => {
  let summary = '# Project Full Codebase One File\n\n';
  summary += `Generated: ${new Date().toISOString()}\n\n`;
  summary += 'This single-file export contains project architecture plus redacted source/documentation contents.\n';
  summary += 'Secret-bearing files are excluded, and known token/password/private-key patterns are redacted in included files.\n\n';
  summary += '## Architecture\n\n';
  summary += '### Included File Tree\n\n';
  summary += '```text\n';
  summary += buildDirectoryTree(files);
  summary += '\n```\n\n';
  summary += '### Included Files\n\n';

  for (const { file, size } of files) {
    summary += `- ${file} (${size} bytes)\n`;
  }

  if (skipped.length > 0) {
    summary += '\n### Skipped Files And Directories\n\n';

    for (const { file, reason } of skipped) {
      summary += `- ${file}: ${reason}\n`;
    }
  }

  summary += '\n### Safety Rules\n\n';
  summary += '- `.env*`, credential, secret, private-key, Firebase admin SDK, and service-account style files are excluded.\n';
  summary += '- Dependency folders, build output, reports, generated exports, logs, lockfiles, common media, and large files are excluded.\n';
  summary += '- Known API keys, tokens, private keys, and database URL passwords are redacted before writing this export.\n\n';
  summary += '## Code Files\n\n';

  return summary;
};

const LANG_MAP = new Map([
  ['bat', 'bat'],
  ['cjs', 'js'],
  ['Dockerfile', 'dockerfile'],
  ['mjs', 'js'],
  ['ps1', 'powershell'],
  ['py', 'python'],
  ['sh', 'bash'],
  ['yaml', 'yaml'],
  ['yml', 'yaml'],
]);

const languageFor = (file) => {
  const extension = path.extname(file).replace('.', '');
  const fileName = path.basename(file);

  return LANG_MAP.get(extension) || LANG_MAP.get(fileName) || extension || 'text';
};

const exportCodebase = async () => {
  const { files, skipped } = await collectFiles();
  const sortedFiles = files.sort((a, b) => a.file.localeCompare(b.file));
  const sortedSkipped = skipped.sort((a, b) => a.file.localeCompare(b.file));

  let output = buildSummary(sortedFiles, sortedSkipped);

  for (const { absolutePath, file } of sortedFiles) {
    const rawContent = await fs.readFile(absolutePath, 'utf8');
    const content = withFilePrefixedLines(redactSecrets(rawContent), file);

    output += '---\n\n';
    output += `### FILE: ${file}\n\n`;
    output += `Source path: \`${file}\`\n\n`;
    output += `\`\`\`${languageFor(file)}\n`;
    output += content;
    output += '\n```\n\n';
  }

  await fs.writeFile(OUTPUT_FILE, output, 'utf8');

  console.log(`Generated ${path.relative(PROJECT_ROOT, OUTPUT_FILE)}`);
  console.log(`Included ${sortedFiles.length} file(s).`);
  console.log(`Skipped ${sortedSkipped.length} file(s)/director(ies).`);
};

exportCodebase().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
