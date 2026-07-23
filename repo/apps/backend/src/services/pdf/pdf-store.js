import fs from "node:fs";
import path from "node:path";

const PDF_STORE_FILE = path.resolve("data", "pdf-knowledge-store.json");

function ensureStore() {
  fs.mkdirSync(path.dirname(PDF_STORE_FILE), { recursive: true });

  if (!fs.existsSync(PDF_STORE_FILE)) {
    fs.writeFileSync(PDF_STORE_FILE, JSON.stringify({}, null, 2));
  }
}

export function loadPdfStore() {
  ensureStore();

  try {
    return JSON.parse(fs.readFileSync(PDF_STORE_FILE, "utf8"));
  } catch {
    return {};
  }
}

export function savePdfKnowledgeBase(pdfId, payload) {
  const store = loadPdfStore();

  store[pdfId] = {
    ...payload,
    savedAt: new Date().toISOString(),
  };

  fs.writeFileSync(PDF_STORE_FILE, JSON.stringify(store, null, 2));
  return store[pdfId];
}

export function getPdfKnowledgeBase(pdfId) {
  const store = loadPdfStore();
  return store[pdfId] || null;
}
