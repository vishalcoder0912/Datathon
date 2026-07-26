import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, "code-audit-report.json");

const IGNORE_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  "logs",
  ".pytest_cache",
  "__pycache__",
  ".venv",
  "venv",
  ".DS_Store",
  ".vscode",
  ".idea",
  "tmp",
  "temp"
];

const VALID_EXT = [".js", ".jsx", ".ts", ".tsx"];

const rules = [
  {
    id: "console-log",
    severity: "low",
    test: line => line.includes("console.log"),
    message: "Remove console.log before production."
  },
  {
    id: "todo-found",
    severity: "low",
    test: line => /TODO|FIXME/i.test(line),
    message: "TODO/FIXME found. Complete or document it."
  },
  {
    id: "hardcoded-localhost",
    severity: "medium",
    test: line => line.includes("localhost"),
    message: "Hardcoded localhost found. Use environment variables."
  },
  {
    id: "dangerous-inner-html", // audit-ignore: dangerous-inner-html
    severity: "high", // audit-ignore: dangerous-inner-html
    test: line => line.includes("dangerouslySetInnerHTML"), // audit-ignore: dangerous-inner-html
    message: "dangerouslySetInnerHTML can cause XSS. Sanitize input." // audit-ignore: dangerous-inner-html
  },
  {
    id: "empty-catch",
    severity: "high",
    test: line => /catch\s*\([^)]*\)\s*{\s*}/.test(line),
    message: "Empty catch block hides errors."
  },
  {
    id: "any-type",
    severity: "medium",
    test: line => /:\s*any\b/.test(line),
    message: "Avoid TypeScript any. Use proper types."
  },
  {
    id: "missing-error-handling",
    severity: "medium",
    test: line => line.includes("fetch(") && !line.includes("await"),
    message: "Fetch call may need await and error handling."
  },
  {
    id: "secret-leak",
    severity: "critical",
    test: line =>
      /(api_key|apikey|secret|password|token)\s*[:=]\s*["'][^"']+["']/i.test(line),
    message: "Possible secret/token hardcoded in source code."
  }
];

function walk(dir, files = []) {
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (IGNORE_DIRS.includes(item)) continue;
      const fullPath = path.join(dir, item);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath, files);
        } else if (VALID_EXT.includes(path.extname(fullPath))) {
          files.push(fullPath);
        }
      } catch {
        // skip unreadable files/dirs
      }
    }
  } catch {
    // skip unreadable directories
  }
  return files;
}

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const issues = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const ignoreMatch = trimmed.match(/\/\/\s*audit-ignore:\s*(.+)/);
    const ignoredRules = ignoreMatch ? ignoreMatch[1].split(",").map(s => s.trim()) : [];
    for (const rule of rules) {
      if (ignoredRules.includes(rule.id)) continue;
      if (rule.test(line)) {
        issues.push({
          file: path.relative(ROOT, filePath),
          line: index + 1,
          rule: rule.id,
          severity: rule.severity,
          message: rule.message,
          code: line.trim()
        });
      }
    }
  });

  return issues;
}

const files = walk(ROOT);
const issues = files.flatMap(auditFile);

const report = {
  scanned_files: files.length,
  total_issues: issues.length,
  critical: issues.filter(i => i.severity === "critical").length,
  high: issues.filter(i => i.severity === "high").length,
  medium: issues.filter(i => i.severity === "medium").length,
  low: issues.filter(i => i.severity === "low").length,
  issues
};

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

console.log(`Audit complete. Report saved to ${REPORT_PATH}`);
console.table(report);
