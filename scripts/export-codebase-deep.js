import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_INCLUDE_EXTENSIONS = new Set([
  ".bat",
  ".cjs",
  ".css",
  ".env.example",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".md",
  ".ps1",
  ".py",
  ".scss",
  ".sh",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const DEFAULT_IGNORE_DIRS = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".turbo",
  ".vite",
  ".vscode",
  ".tmp_schema_trained_patch",
  "build",
  "coverage",
  "data/uploads",
  "data/pdf-output",
  "dist",
  "dist-ssr",
  "logs",
  "node_modules",
  "out",
  "target",
]);

const DEFAULT_IGNORE_FILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "PROJECT_AI_SAFE.md",
  "PROJECT_ARCHITECTURE.md",
  "CODEBASE_DEEP.md",
  "CODEBASE_ARCHITECTURE.md",
  "CODEBASE_MANIFEST.json",
  "serviceAccountKey.json",
  "firebase-adminsdk.json",
]);

const DEFAULT_IGNORE_EXTENSIONS = new Set([
  ".7z",
  ".avif",
  ".bmp",
  ".db",
  ".docx",
  ".exe",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".lock",
  ".log",
  ".mp3",
  ".mp4",
  ".pdf",
  ".png",
  ".sqlite",
  ".svg",
  ".webm",
  ".woff",
  ".woff2",
  ".zip",
]);

const LANGUAGE_BY_EXTENSION = new Map([
  [".bat", "bat"],
  [".cjs", "javascript"],
  [".css", "css"],
  [".html", "html"],
  [".js", "javascript"],
  [".json", "json"],
  [".jsx", "jsx"],
  [".mjs", "javascript"],
  [".md", "markdown"],
  [".ps1", "powershell"],
  [".py", "python"],
  [".scss", "scss"],
  [".sh", "bash"],
  [".sql", "sql"],
  [".ts", "typescript"],
  [".tsx", "tsx"],
  [".txt", "text"],
  [".yaml", "yaml"],
  [".yml", "yaml"],
]);

const DEFAULT_MAX_FILE_BYTES = 1_200_000;

function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    outDir: path.join(process.cwd(), "exports"),
    maxFileBytes: DEFAULT_MAX_FILE_BYTES,
    includeExtensions: DEFAULT_INCLUDE_EXTENSIONS,
    redact: true,
    includeLockfiles: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--root" && next) {
      options.root = path.resolve(next);
      index += 1;
    } else if (arg === "--out-dir" && next) {
      options.outDir = path.resolve(next);
      index += 1;
    } else if (arg === "--max-file-bytes" && next) {
      options.maxFileBytes = Number(next);
      index += 1;
    } else if (arg === "--include-ext" && next) {
      options.includeExtensions = new Set(
        next
          .split(",")
          .map((ext) => ext.trim())
          .filter(Boolean)
          .map((ext) => (ext.startsWith(".") ? ext : `.${ext}`)),
      );
      index += 1;
    } else if (arg === "--include-lockfiles") {
      options.includeLockfiles = true;
    } else if (arg === "--no-redact") {
      options.redact = false;
    } else if (arg === "--help" || arg === "-h") {
      printHelpAndExit();
    }
  }

  return options;
}

function printHelpAndExit() {
  console.log(`
Usage:
  node scripts/export-codebase-deep.js [options]

Options:
  --root <path>             Project root to scan. Default: current working directory.
  --out-dir <path>          Output directory. Default: ./exports
  --max-file-bytes <n>      Skip individual files larger than n bytes. Default: ${DEFAULT_MAX_FILE_BYTES}
  --include-ext <list>      Comma-separated extensions, for example: ts,tsx,js,json,md
  --include-lockfiles       Include package lockfiles.
  --no-redact               Disable best-effort secret redaction.
  --help                    Show this help.
`);
  process.exit(0);
}

const toPosix = (value) => value.split(path.sep).join("/");

function isSecretFile(fileName) {
  return (
    fileName === ".env" ||
    fileName.startsWith(".env.") ||
    /^firebase-adminsdk.*\.json$/i.test(fileName) ||
    /^.*service.*account.*\.json$/i.test(fileName)
  );
}

function shouldIgnorePath(relativePath, options) {
  const normalized = toPosix(relativePath);
  const fileName = path.basename(relativePath);
  const extension = path.extname(fileName).toLowerCase();

  if (normalized.startsWith("exports/")) return true;
  if (isSecretFile(fileName)) return true;
  if (DEFAULT_IGNORE_FILES.has(fileName) && !(options.includeLockfiles && fileName.includes("lock"))) return true;
  if (DEFAULT_IGNORE_EXTENSIONS.has(extension) && !(options.includeLockfiles && extension === ".lock")) return true;

  return false;
}

function shouldIgnoreDirectory(relativePath) {
  const normalized = toPosix(relativePath);
  const parts = normalized.split("/");

  return parts.some((part, index) => {
    const candidate = parts.slice(0, index + 1).join("/");
    return DEFAULT_IGNORE_DIRS.has(part) || DEFAULT_IGNORE_DIRS.has(candidate);
  });
}

function isIncludedFile(relativePath, options) {
  const fileName = path.basename(relativePath);
  const extension = path.extname(fileName).toLowerCase();

  if (fileName === ".env.example") return options.includeExtensions.has(".env.example");
  return options.includeExtensions.has(extension);
}

function hashContent(content) {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function redactSecrets(content) {
  return content
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]")
    .replace(/\bgh[pousr]_[0-9A-Za-z_]{36,255}\b/g, "[REDACTED_GITHUB_TOKEN]")
    .replace(/\bsk-[A-Za-z0-9]{20,}\b/g, "[REDACTED_OPENAI_STYLE_KEY]")
    .replace(/\bAIza[0-9A-Za-z-_]{35}\b/g, "[REDACTED_GOOGLE_API_KEY]")
    .replace(/\b(xox[baprs]-[0-9A-Za-z-]{20,})\b/g, "[REDACTED_SLACK_TOKEN]")
    .replace(
      /\b((?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/[^:\s/@]+:)[^@\s"'`<>)]+(@[^\s"'`<>)]+)/gi,
      "$1[REDACTED_PASSWORD]$2",
    )
    .replace(
      /^(\s*["']?[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY|ACCESS_KEY|REFRESH_TOKEN)[A-Z0-9_]*["']?\s*[:=]\s*)["']?[^"',\n}]+["']?/gim,
      "$1[REDACTED_SECRET]",
    );
}

async function collectFiles(options, directory = options.root, files = [], skipped = []) {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(options.root, absolutePath);
    const safePath = toPosix(relativePath);

    if (entry.isDirectory()) {
      if (!shouldIgnoreDirectory(relativePath)) {
        await collectFiles(options, absolutePath, files, skipped);
      } else {
        skipped.push({ file: safePath, reason: "ignored directory" });
      }
      continue;
    }

    if (!entry.isFile()) continue;

    if (shouldIgnorePath(relativePath, options)) {
      skipped.push({ file: safePath, reason: "ignored file or sensitive path" });
      continue;
    }

    if (!isIncludedFile(relativePath, options)) {
      skipped.push({ file: safePath, reason: "extension not included" });
      continue;
    }

    const stats = await fs.stat(absolutePath);

    if (stats.size > options.maxFileBytes) {
      skipped.push({ file: safePath, reason: `larger than ${options.maxFileBytes} bytes` });
      continue;
    }

    files.push({
      absolutePath,
      file: safePath,
      size: stats.size,
      extension: path.extname(entry.name).toLowerCase() || path.basename(entry.name),
      modifiedAt: stats.mtime.toISOString(),
    });
  }

  return { files, skipped };
}

async function readTextFile(file, options) {
  const raw = await fs.readFile(file.absolutePath, "utf8");
  const content = options.redact ? redactSecrets(raw) : raw;

  return {
    ...file,
    content,
    hash: hashContent(content),
    lineCount: content.split(/\r?\n/).length,
  };
}

function groupBy(items, getKey) {
  const map = new Map();
  for (const item of items) {
    const key = getKey(item);
    map.set(key, [...(map.get(key) || []), item]);
  }
  return map;
}

function buildTree(files) {
  const root = {};

  for (const file of files) {
    const parts = file.file.split("/");
    let current = root;
    for (const part of parts) {
      current[part] ||= {};
      current = current[part];
    }
  }

  function render(node, prefix = "", depth = 0) {
    if (depth > 6) return [];
    const entries = Object.keys(node).sort((left, right) => {
      const leftIsDir = Object.keys(node[left]).length > 0;
      const rightIsDir = Object.keys(node[right]).length > 0;
      if (leftIsDir !== rightIsDir) return leftIsDir ? -1 : 1;
      return left.localeCompare(right);
    });

    const lines = [];
    entries.forEach((entry, index) => {
      const isLast = index === entries.length - 1;
      const child = node[entry];
      const isDir = Object.keys(child).length > 0;
      lines.push(`${prefix}${isLast ? "`-- " : "|-- "}${entry}${isDir ? "/" : ""}`);
      if (isDir) {
        lines.push(...render(child, `${prefix}${isLast ? "    " : "|   "}`, depth + 1));
      }
    });
    return lines;
  }

  return render(root).join("\n");
}

function parsePackageJson(file) {
  try {
    return JSON.parse(file.content);
  } catch {
    return null;
  }
}

function detectPackageInfo(files) {
  return files
    .filter((file) => file.file.endsWith("package.json"))
    .map((file) => {
      const parsed = parsePackageJson(file);
      return {
        file: file.file,
        name: parsed?.name || "(unnamed)",
        version: parsed?.version || "",
        scripts: parsed?.scripts || {},
        dependencies: {
          ...parsed?.dependencies,
          ...parsed?.devDependencies,
        },
        workspaces: parsed?.workspaces || [],
      };
    });
}

function detectImports(files) {
  const importPattern = /(?:import\s+(?:[^'"]+\s+from\s+)?|export\s+[^'"]+\s+from\s+|require\()\s*["']([^"']+)["']\)?/g;
  const rows = [];

  for (const file of files) {
    if (!/\.(cjs|js|jsx|mjs|ts|tsx)$/.test(file.extension)) continue;
    const imports = new Set();
    let match;
    while ((match = importPattern.exec(file.content)) !== null) {
      imports.add(match[1]);
    }
    if (imports.size) {
      rows.push({
        file: file.file,
        imports: [...imports].sort(),
      });
    }
  }

  return rows;
}

function detectRoutesAndEndpoints(files) {
  const reactRoutes = [];
  const apiEndpoints = [];

  const routePattern = /<Route\b[^>]*\bpath=["']([^"']+)["'][^>]*>/g;
  const apiPattern = /["'`](\/api\/[^"'`\s,)]+)["'`]/g;
  const pathnamePattern = /pathname\s*(?:===|\.match\()\s*["'`](\/api\/[^"'`]+)["'`]/g;

  for (const file of files) {
    let match;

    while ((match = routePattern.exec(file.content)) !== null) {
      reactRoutes.push({ file: file.file, route: match[1] });
    }

    while ((match = apiPattern.exec(file.content)) !== null) {
      apiEndpoints.push({ file: file.file, endpoint: match[1] });
    }

    while ((match = pathnamePattern.exec(file.content)) !== null) {
      apiEndpoints.push({ file: file.file, endpoint: match[1] });
    }
  }

  return {
    reactRoutes: uniqueObjects(reactRoutes, (item) => `${item.file}:${item.route}`),
    apiEndpoints: uniqueObjects(apiEndpoints, (item) => `${item.file}:${item.endpoint}`),
  };
}

function detectEnvVars(files) {
  const envPattern = /\b(?:process\.env|import\.meta\.env)\.([A-Z0-9_]+)/g;
  const envVars = [];

  for (const file of files) {
    let match;
    while ((match = envPattern.exec(file.content)) !== null) {
      envVars.push({ file: file.file, name: match[1] });
    }
  }

  return uniqueObjects(envVars, (item) => `${item.file}:${item.name}`).sort((a, b) => a.name.localeCompare(b.name));
}

function uniqueObjects(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferModuleNotes(files) {
  const notes = [];
  const topFolders = groupBy(files, (file) => file.file.split("/")[0]);

  for (const [folder, folderFiles] of [...topFolders.entries()].sort()) {
    const extensions = groupBy(folderFiles, (file) => file.extension);
    notes.push({
      folder,
      files: folderFiles.length,
      lines: folderFiles.reduce((total, file) => total + file.lineCount, 0),
      extensions: [...extensions.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 5)
        .map(([extension, items]) => `${extension}: ${items.length}`),
    });
  }

  return notes;
}

function detectEntrypoints(files) {
  const hints = [
    "main.tsx",
    "main.ts",
    "index.tsx",
    "index.ts",
    "server.js",
    "server.ts",
    "app.py",
    "vite.config.ts",
    "AppRouter.tsx",
  ];

  return files
    .filter((file) => hints.some((hint) => file.file.endsWith(hint)))
    .map((file) => file.file)
    .sort();
}

function buildManifest(files, skipped, options) {
  const packages = detectPackageInfo(files);
  const imports = detectImports(files);
  const routeInfo = detectRoutesAndEndpoints(files);
  const envVars = detectEnvVars(files);
  const byExtension = [...groupBy(files, (file) => file.extension).entries()]
    .map(([extension, items]) => ({
      extension,
      files: items.length,
      lines: items.reduce((total, file) => total + file.lineCount, 0),
      bytes: items.reduce((total, file) => total + file.size, 0),
    }))
    .sort((a, b) => b.files - a.files);

  return {
    generatedAt: new Date().toISOString(),
    root: options.root,
    redactionEnabled: options.redact,
    maxFileBytes: options.maxFileBytes,
    totals: {
      files: files.length,
      lines: files.reduce((total, file) => total + file.lineCount, 0),
      bytes: files.reduce((total, file) => total + file.size, 0),
      skipped: skipped.length,
    },
    byExtension,
    packages,
    entrypoints: detectEntrypoints(files),
    routes: routeInfo.reactRoutes,
    apiEndpoints: routeInfo.apiEndpoints,
    envVars,
    moduleNotes: inferModuleNotes(files),
    imports,
    skipped,
    files: files.map(({ content, ...metadata }) => metadata),
  };
}

function mdTable(headers, rows) {
  if (!rows.length) return "_None detected._\n";
  const header = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((cell) => String(cell).replace(/\|/g, "\\|")).join(" | ")} |`);
  return [header, divider, ...body].join("\n");
}

function buildArchitectureReport(manifest) {
  const lines = [];
  lines.push("# Project Architecture Report");
  lines.push("");
  lines.push(`Generated: ${manifest.generatedAt}`);
  lines.push(`Root: ${manifest.root}`);
  lines.push("");
  lines.push("## Executive Summary");
  lines.push("");
  lines.push(`- Files exported: ${manifest.totals.files}`);
  lines.push(`- Total lines exported: ${manifest.totals.lines.toLocaleString()}`);
  lines.push(`- Total source bytes exported: ${manifest.totals.bytes.toLocaleString()}`);
  lines.push(`- Skipped paths: ${manifest.totals.skipped}`);
  lines.push(`- Secret redaction: ${manifest.redactionEnabled ? "enabled" : "disabled"}`);
  lines.push("");
  lines.push("## Project Tree");
  lines.push("");
  lines.push("```text");
  lines.push(buildTree(manifest.files));
  lines.push("```");
  lines.push("");
  lines.push("## Workspaces And Packages");
  lines.push("");
  lines.push(
    mdTable(
      ["Package", "File", "Scripts", "Dependency Count", "Workspaces"],
      manifest.packages.map((pkg) => [
        pkg.name,
        pkg.file,
        Object.keys(pkg.scripts).join(", ") || "-",
        Object.keys(pkg.dependencies).length,
        Array.isArray(pkg.workspaces) ? pkg.workspaces.join(", ") : "-",
      ]),
    ),
  );
  lines.push("");
  lines.push("## Entrypoints");
  lines.push("");
  lines.push(manifest.entrypoints.length ? manifest.entrypoints.map((item) => `- ${item}`).join("\n") : "_None detected._");
  lines.push("");
  lines.push("## Frontend Routes");
  lines.push("");
  lines.push(mdTable(["Route", "File"], manifest.routes.map((route) => [route.route, route.file])));
  lines.push("");
  lines.push("## API Endpoints");
  lines.push("");
  lines.push(mdTable(["Endpoint", "File"], manifest.apiEndpoints.map((endpoint) => [endpoint.endpoint, endpoint.file])));
  lines.push("");
  lines.push("## Environment Variables Referenced");
  lines.push("");
  lines.push(mdTable(["Variable", "File"], manifest.envVars.map((envVar) => [envVar.name, envVar.file])));
  lines.push("");
  lines.push("## Source Composition");
  lines.push("");
  lines.push(mdTable(["Extension", "Files", "Lines", "Bytes"], manifest.byExtension.map((item) => [item.extension, item.files, item.lines, item.bytes])));
  lines.push("");
  lines.push("## Module Breakdown");
  lines.push("");
  lines.push(mdTable(["Folder", "Files", "Lines", "Top Extensions"], manifest.moduleNotes.map((note) => [note.folder, note.files, note.lines, note.extensions.join(", ")])));
  lines.push("");
  lines.push("## Local Import Map");
  lines.push("");
  lines.push(
    mdTable(
      ["File", "Imports"],
      manifest.imports
        .filter((item) => item.imports.some((specifier) => specifier.startsWith(".") || specifier.startsWith("@/") || specifier.startsWith("@insightflow/")))
        .slice(0, 300)
        .map((item) => [item.file, item.imports.join(", ")]),
    ),
  );
  lines.push("");
  lines.push("## Skipped Paths");
  lines.push("");
  lines.push(mdTable(["Path", "Reason"], manifest.skipped.map((item) => [item.file, item.reason]).slice(0, 500)));
  lines.push("");
  lines.push("## Export Notes");
  lines.push("");
  lines.push("- The code bundle is intended for AI review, migration planning, auditing, and debugging.");
  lines.push("- Generated folders, dependencies, binary/media files, logs, PDFs, SQLite databases, and common secret files are skipped.");
  lines.push("- Secret redaction is best effort. Review the generated bundle before sharing it externally.");
  lines.push("- Use `CODEBASE_MANIFEST.json` for automation and `CODEBASE_ARCHITECTURE.md` for human review.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function codeFenceLanguage(file) {
  return LANGUAGE_BY_EXTENSION.get(file.extension) || file.extension.replace(".", "") || "text";
}

function buildCodeBundle(files, manifest) {
  const lines = [];
  lines.push("# Codebase Deep Export");
  lines.push("");
  lines.push(`Generated: ${manifest.generatedAt}`);
  lines.push(`Root: ${manifest.root}`);
  lines.push("");
  lines.push("This file contains the exported source code for the project. Review redactions and skipped paths before sharing externally.");
  lines.push("");
  lines.push("## Export Summary");
  lines.push("");
  lines.push(`- Files: ${manifest.totals.files}`);
  lines.push(`- Lines: ${manifest.totals.lines.toLocaleString()}`);
  lines.push(`- Bytes: ${manifest.totals.bytes.toLocaleString()}`);
  lines.push(`- Redaction: ${manifest.redactionEnabled ? "enabled" : "disabled"}`);
  lines.push("");
  lines.push("## File Index");
  lines.push("");
  for (const file of files) {
    lines.push(`- ${file.file} (${file.lineCount} lines, ${file.size} bytes, sha256:${file.hash})`);
  }
  lines.push("");

  for (const file of files) {
    lines.push("---");
    lines.push("");
    lines.push(`## FILE: ${file.file}`);
    lines.push("");
    lines.push(`- Lines: ${file.lineCount}`);
    lines.push(`- Bytes: ${file.size}`);
    lines.push(`- Modified: ${file.modifiedAt}`);
    lines.push(`- SHA256 short: ${file.hash}`);
    lines.push("");
    lines.push(`\`\`\`${codeFenceLanguage(file)}`);
    lines.push(file.content.replace(/\n```/g, "\n\\`\\`\\`"));
    lines.push("```");
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await fs.mkdir(options.outDir, { recursive: true });

  const { files, skipped } = await collectFiles(options);
  const sortedFiles = files.sort((left, right) => left.file.localeCompare(right.file));
  const enrichedFiles = [];

  for (const file of sortedFiles) {
    try {
      enrichedFiles.push(await readTextFile(file, options));
    } catch (error) {
      skipped.push({ file: file.file, reason: `unreadable as utf8: ${error.message}` });
    }
  }

  const manifest = buildManifest(enrichedFiles, skipped.sort((a, b) => a.file.localeCompare(b.file)), options);
  const codeBundle = buildCodeBundle(enrichedFiles, manifest);
  const architectureReport = buildArchitectureReport(manifest);

  const codePath = path.join(options.outDir, "CODEBASE_DEEP.md");
  const architecturePath = path.join(options.outDir, "CODEBASE_ARCHITECTURE.md");
  const manifestPath = path.join(options.outDir, "CODEBASE_MANIFEST.json");

  await fs.writeFile(codePath, codeBundle, "utf8");
  await fs.writeFile(architecturePath, architectureReport, "utf8");
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  console.log("Deep codebase export complete.");
  console.log(`Code bundle: ${path.relative(process.cwd(), codePath)}`);
  console.log(`Architecture: ${path.relative(process.cwd(), architecturePath)}`);
  console.log(`Manifest: ${path.relative(process.cwd(), manifestPath)}`);
  console.log(`Files exported: ${manifest.totals.files}`);
  console.log(`Skipped paths: ${manifest.totals.skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
