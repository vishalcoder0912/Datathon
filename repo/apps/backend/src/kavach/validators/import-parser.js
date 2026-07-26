import path from 'node:path';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { readJsonBody } from '../../auth/http.js';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const allowedExtensions = new Set(['.csv', '.xlsx', '.xls']);

function safeFilename(value) {
  const base = path.basename(String(value || 'upload.csv')).replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_');
  return base.slice(0, 255) || 'upload.csv';
}

function parseMapping(value) {
  if (!value) return {};
  try { return typeof value === 'object' ? value : JSON.parse(value); } catch { return {}; }
}

function parseRows(filename, buffer) {
  const extension = path.extname(filename).toLowerCase();
  if (!allowedExtensions.has(extension)) {
    const error = new Error('Only CSV, XLSX, and XLS files are accepted.');
    error.code = 'UNSUPPORTED_IMPORT_FILE';
    throw error;
  }
  if (extension === '.csv') {
    const parsed = Papa.parse(buffer.toString('utf8'), { header: true, skipEmptyLines: true });
    if (parsed.errors?.length) {
      const error = new Error('The CSV file could not be parsed.');
      error.code = 'INVALID_IMPORT_FILE';
      throw error;
    }
    return parsed.data;
  }
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null, raw: false });
}

async function parseMultipart(request) {
  const module = await import('busboy');
  const Busboy = module.default || module;
  return new Promise((resolve, reject) => {
    const fields = {};
    let fileInfo = null;
    let failed = false;
    const fail = (error) => {
      if (failed) return;
      failed = true;
      reject(error);
    };
    let parser;
    try { parser = Busboy({ headers: request.headers, limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 20 } }); } catch (error) { fail(error); return; }
    parser.on('field', (name, value) => { fields[name] = value; });
    parser.on('file', (_fieldName, stream, info) => {
      if (fileInfo) { stream.resume(); return; }
      const chunks = []; let size = 0;
      stream.on('data', (chunk) => { size += chunk.length; if (size > MAX_UPLOAD_BYTES) { const error = new Error('Upload exceeds 10 MB.'); error.code = 'BODY_TOO_LARGE'; fail(error); stream.resume(); return; } chunks.push(chunk); });
      stream.on('limit', () => { const error = new Error('Upload exceeds 10 MB.'); error.code = 'BODY_TOO_LARGE'; fail(error); });
      stream.on('end', () => { fileInfo = { filename: safeFilename(info.filename), buffer: Buffer.concat(chunks) }; });
    });
    parser.on('error', fail);
    parser.on('finish', () => {
      if (failed) return;
      if (!fileInfo) { const error = new Error('A CSV or Excel file is required.'); error.code = 'MISSING_IMPORT_FILE'; fail(error); return; }
      try {
        resolve({ filename: fileInfo.filename, sourceType: fields.sourceType, mapping: parseMapping(fields.mapping), rows: parseRows(fileInfo.filename, fileInfo.buffer) });
      } catch (error) { fail(error); }
    });
    request.pipe(parser);
  });
}

export async function parseKavachImportRequest(request) {
  const contentType = String(request.headers?.['content-type'] || '').toLowerCase();
  if (contentType.includes('multipart/form-data')) return parseMultipart(request);
  return readJsonBody(request, MAX_UPLOAD_BYTES);
}

