function walk(node, visitor) {
  if (!node || typeof node !== "object") return;

  visitor(node);

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) walk(child, visitor);
    } else if (value && typeof value === "object") {
      walk(value, visitor);
    }
  }
}

function getNodeText(node) {
  const parts = [];

  walk(node, (child) => {
    if (typeof child.content === "string") {
      const text = child.content.trim();
      if (text) parts.push(text);
    }

    if (typeof child.text === "string") {
      const text = child.text.trim();
      if (text) parts.push(text);
    }
  });

  return parts.join(" ").trim();
}

function getNodePage(node) {
  return node["page number"] || node.pageNumber || node.page || null;
}

function getNodeBoundingBox(node) {
  return node["bounding box"] || node.boundingBox || node.bbox || null;
}

function normalizeHeader(value, index) {
  const cleaned = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return cleaned || `column_${index + 1}`;
}

function dedupeHeaders(headers) {
  const counts = new Map();

  return headers.map((header) => {
    const count = counts.get(header) || 0;
    counts.set(header, count + 1);
    return count === 0 ? header : `${header}_${count + 1}`;
  });
}

export function extractPlainTextElements(pdfJson) {
  const elements = [];

  walk(pdfJson, (node) => {
    const type = String(node.type || "").toLowerCase();

    if (!["paragraph", "heading", "caption", "list item", "list_item"].includes(type)) {
      return;
    }

    const content = getNodeText(node);
    if (!content) return;

    elements.push({
      id: node.id || `element_${elements.length + 1}`,
      type,
      content,
      pageNumber: getNodePage(node),
      boundingBox: getNodeBoundingBox(node),
    });
  });

  return elements;
}

export function extractTablesFromPdfJson(pdfJson) {
  const tables = [];

  walk(pdfJson, (node) => {
    const type = String(node.type || "").toLowerCase();

    if (type !== "table" || !Array.isArray(node.rows)) return;

    const matrix = node.rows
      .map((row) => {
        const cells = Array.isArray(row.cells) ? row.cells : [];
        return cells.map((cell) => getNodeText(cell));
      })
      .filter((row) => row.some((cell) => String(cell || "").trim()));

    if (!matrix.length) return;

    const headers = dedupeHeaders(matrix[0].map(normalizeHeader));
    const bodyRows = matrix.slice(1);
    const tableId = `table_${tables.length + 1}`;

    const rows = bodyRows
      .filter((row) => row.some((cell) => String(cell || "").trim()))
      .map((row, rowIndex) => {
        const record = {
          __rowId: rowIndex + 1,
          __sourceType: "pdf_table",
          __tableId: tableId,
          __pageNumber: getNodePage(node),
          __boundingBox: getNodeBoundingBox(node),
        };

        headers.forEach((header, index) => {
          record[header] = row[index] ?? "";
        });

        return record;
      });

    tables.push({
      id: tableId,
      pageNumber: getNodePage(node),
      boundingBox: getNodeBoundingBox(node),
      rowCount: rows.length,
      columnCount: headers.length,
      headers,
      rows,
    });
  });

  return tables;
}

export function mergePdfTables(tables = []) {
  return tables.flatMap((table) => table.rows || []);
}
