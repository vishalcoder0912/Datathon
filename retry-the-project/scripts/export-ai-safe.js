import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const OUTPUT_AI_SAFE = path.join(PROJECT_ROOT, 'PROJECT_AI_SAFE.md');
const OUTPUT_ARCHITECTURE = path.join(PROJECT_ROOT, 'PROJECT_ARCHITECTURE.md');

const INCLUDED_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.css',
  '.scss',
  '.html',
  '.md',
]);

const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.firebase',
  'build',
  'coverage',
  'dist',
  'dist-ssr',
  'node_modules',
]);

const IGNORED_FILENAMES = new Set([
  'PROJECT_AI_SAFE.md',
  'PROJECT_ARCHITECTURE.md',
  'firebase-adminsdk.json',
  'package-lock.json',
  'serviceAccountKey.json',
]);

const IGNORED_EXTENSIONS = new Set([
  '.gif',
  '.jpeg',
  '.jpg',
  '.lock',
  '.log',
  '.mp4',
  '.png',
  '.zip',
]);

const MAX_FILE_BYTES = 1_000_000;

const toPosixPath = (filePath) => filePath.split(path.sep).join('/');

const isIgnoredFile = (relativePath) => {
  const fileName = path.basename(relativePath);
  const extension = path.extname(fileName).toLowerCase();

  if (fileName === '.env' || fileName.startsWith('.env.')) {
    return true;
  }

  if (fileName.startsWith('firebase-adminsdk') && extension === '.json') {
    return true;
  }

  return IGNORED_FILENAMES.has(fileName) || IGNORED_EXTENSIONS.has(extension);
};

const isIncludedFile = (relativePath) => {
  const extension = path.extname(relativePath).toLowerCase();
  return INCLUDED_EXTENSIONS.has(extension) && !isIgnoredFile(relativePath);
};

const redactSecrets = (content) =>
  content
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_FIREBASE_API_KEY]')
    .replace(/sk_(?:live|test)_[0-9A-Za-z]+/g, '[REDACTED_STRIPE_SECRET_KEY]')
    .replace(/pk_(?:live|test)_[0-9A-Za-z]+/g, '[REDACTED_STRIPE_PUBLIC_KEY]')
    .replace(/gh[pousr]_[0-9A-Za-z_]{36,255}/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
    .replace(
      /\b((?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\/[^:\s/@]+:)[^@\s]+(@[^\s"'`<>)]+)/gi,
      '$1[REDACTED_PASSWORD]$2',
    )
    .replace(
      /^(\s*["']?[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|ACCESS_KEY|REFRESH_TOKEN)[A-Z0-9_]*["']?\s*[:=]\s*)["']?[^"',\n}]+["']?/gim,
      '$1[REDACTED_SECRET]',
    );

const collectFiles = async (directory = PROJECT_ROOT, files = [], skipped = []) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(PROJECT_ROOT, absolutePath);
    const safeRelativePath = toPosixPath(relativePath);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        await collectFiles(absolutePath, files, skipped);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!isIncludedFile(relativePath)) {
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

const buildArchitecture = (files, skipped) => {
  let architecture = '# Project Architecture\n\n';
  architecture += `Generated: ${new Date().toISOString()}\n\n`;
  architecture += '## Included Files\n\n';

  for (const { file, size } of files) {
    architecture += `- ${file} (${size} bytes)\n`;
  }

  if (skipped.length > 0) {
    architecture += '\n## Skipped Files\n\n';

    for (const { file, reason } of skipped) {
      architecture += `- ${file}: ${reason}\n`;
    }
  }

  architecture += '\n## Safety Rules\n\n';
  architecture += '- Secret-bearing files such as `.env*`, Firebase admin SDK JSON, and service account keys are excluded.\n';
  architecture += '- Build output, dependency folders, logs, lockfiles, and common media archives are excluded.\n';
  architecture += '- Known API keys, tokens, private keys, and database URL passwords are redacted before export.\n';

  return architecture;
};

const exportCodebase = async () => {
  const { files, skipped } = await collectFiles();
  const sortedFiles = files.sort((a, b) => a.file.localeCompare(b.file));

  let output = '# AI Safe Codebase Export\n\n';
  output += `Generated: ${new Date().toISOString()}\n\n`;
  output += 'This export excludes common secret files and applies best-effort redaction. Review before uploading externally.\n\n';

  for (const { absolutePath, file } of sortedFiles) {
    const rawContent = await fs.readFile(absolutePath, 'utf8');
    const content = redactSecrets(rawContent);
    const extension = path.extname(file).replace('.', '');

    output += '---\n\n';
    output += `# FILE: ${file}\n\n`;
    output += `\`\`\`${extension}\n`;
    output += content;
    output += '\n```\n\n';
  }

  await fs.writeFile(OUTPUT_AI_SAFE, output, 'utf8');
  await fs.writeFile(OUTPUT_ARCHITECTURE, buildArchitecture(sortedFiles, skipped), 'utf8');

  console.log('PROJECT_AI_SAFE.md generated');
  console.log('PROJECT_ARCHITECTURE.md generated');

  if (skipped.length > 0) {
    console.log(`${skipped.length} oversized file(s) skipped; see PROJECT_ARCHITECTURE.md.`);
  }
};

exportCodebase().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
