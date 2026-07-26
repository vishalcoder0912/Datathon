import Papa from "papaparse";
import * as XLSX from "xlsx";

function safeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const cleaned = String(value ?? "")
    .replace(/[,$₹%\s]/g, "")
    .trim();

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferType(values = []) {
  const sample = values
    .filter((value) => value !== null && value !== undefined && value !== "")
    .slice(0, 50);

  if (!sample.length) return "string";

  const numeric = sample.filter((value) => safeNumber(value) !== null).length;
  const date = sample.filter((value) =>
    Number.isFinite(Date.parse(String(value)))
  ).length;

  if (numeric / sample.length >= 0.8) return "number";
  if (date / sample.length >= 0.8) return "date";

  return "string";
}

export function inferColumns(rows = []) {
  const names = [...new Set(rows.flatMap((row) => Object.keys(row || {})))];

  return names.map((name) => ({
    name,
    type: inferType(rows.map((row) => row[name])),
    sample: rows
      .map((row) => row[name])
      .filter((value) => value !== null && value !== undefined && value !== "")
      .slice(0, 5),
  }));
}

function parseCsv(buffer) {
  const result = Papa.parse(buffer.toString("utf8"), {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  if (result.errors?.length) {
    throw new Error(`CSV parse error: ${result.errors[0].message}`);
  }

  return result.data.filter((row) =>
    Object.values(row || {}).some(
      (value) => value !== null && value !== undefined && value !== ""
    )
  );
}

function parseJson(buffer) {
  const parsed = JSON.parse(buffer.toString("utf8"));

  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.rows)) return parsed.rows;
  if (Array.isArray(parsed.data)) return parsed.data;
  if (Array.isArray(parsed.records)) return parsed.records;

  throw new Error("JSON must be an array or contain rows/data/records array.");
}

function parseXlsx(buffer) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
  });

  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("XLSX file has no sheets.");
  }

  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
    raw: false,
  });
}

export function parseDatasetFile({ filename, buffer }) {
  const lower = filename.toLowerCase();

  let rows;

  if (lower.endsWith(".csv")) {
    rows = parseCsv(buffer);
  } else if (lower.endsWith(".json")) {
    rows = parseJson(buffer);
  } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    rows = parseXlsx(buffer);
  } else {
    throw new Error(`Unsupported file type: ${filename}`);
  }

  return {
    name: filename,
    fileName: filename,
    rows,
    columns: inferColumns(rows),
    rowCount: rows.length,
    columnCount: rows[0] ? Object.keys(rows[0]).length : 0,
  };
}

export function mergeParsedDatasets(parsedFiles = []) {
  const rows = parsedFiles.flatMap((file) =>
    file.rows.map((row, index) => ({
      ...row,
      __sourceFile: file.fileName,
      __sourceRow: index + 1,
    }))
  );

  const name =
    parsedFiles.length === 1
      ? parsedFiles[0].fileName
      : `combined_${parsedFiles
          .map((file) => file.fileName.replace(/\.[^.]+$/, ""))
          .join("_")}`;

  return {
    name,
    fileName: parsedFiles.map((file) => file.fileName).join(", "),
    sourceType:
      parsedFiles.length === 1 ? "qr-mobile-upload" : "qr-mobile-merged",
    rows,
    columns: inferColumns(rows),
    rowCount: rows.length,
    columnCount: rows[0] ? Object.keys(rows[0]).length : 0,
  };
}
