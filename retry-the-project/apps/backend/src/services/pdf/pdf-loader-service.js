import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { convert } from "@opendataloader/pdf";

const PDF_OUTPUT_DIR = path.resolve("data", "pdf-output");

async function findOutputFile(outputDir, extensions) {
  const files = await fs.readdir(outputDir);
  const fileName = files.find((file) =>
    extensions.some((extension) => file.toLowerCase().endsWith(extension))
  );

  return fileName ? path.join(outputDir, fileName) : null;
}

export async function parsePdfWithOpenDataLoader(filePath, options = {}) {
  const jobId = randomUUID();
  const outputDir = path.join(PDF_OUTPUT_DIR, jobId);

  await fs.mkdir(outputDir, { recursive: true });

  await convert([filePath], {
    outputDir,
    format: "json,markdown",
    readingOrder: "xycut",
    tableMethod: "cluster",
    sanitize: true,
    imageOutput: "external",
    quiet: true,
    ...options,
  });

  const jsonPath = await findOutputFile(outputDir, [".json"]);
  const markdownPath = await findOutputFile(outputDir, [".md", ".markdown"]);

  if (!jsonPath) {
    throw new Error("PDF parsing failed: JSON output not found.");
  }

  const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  const markdown = markdownPath ? await fs.readFile(markdownPath, "utf8") : "";

  return {
    jobId,
    outputDir,
    jsonPath,
    markdownPath,
    json,
    markdown,
    privacy: {
      parsedLocally: true,
      rawPdfSentToLLM: false,
    },
  };
}
