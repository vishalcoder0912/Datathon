const DICTIONARY_NAMES = /dictionary|schema|metadata|data_dictionary|fields/i;
const TRAIN_NAMES = /(^|[_\-. ])train([_\-. ]|$)/i;
const TEST_NAMES = /(^|[_\-. ])test([_\-. ]|$)/i;

function getColumnNames(file) {
  if (Array.isArray(file.columns) && file.columns.length) {
    return file.columns.map((c) => String(c.name || c).toLowerCase());
  }

  const first = file.rows?.[0] || {};
  return Object.keys(first).map((key) => key.toLowerCase());
}

export function detectDatasetRole(file = {}) {
  const fileName = String(file.fileName || file.name || "");
  const columns = getColumnNames(file);
  const rowCount = file.rows?.length || 0;

  const dictionaryColumns = [
    "column",
    "column_name",
    "field",
    "field_name",
    "description",
    "type",
    "target",
    "meaning",
  ];

  const dictionaryHits = columns.filter((col) =>
    dictionaryColumns.some((d) => col.includes(d))
  ).length;

  if (DICTIONARY_NAMES.test(fileName) || dictionaryHits >= 2) {
    return {
      role: "metadata_dictionary",
      confidence: DICTIONARY_NAMES.test(fileName) ? 0.98 : 0.85,
      reason: "Looks like a schema/data dictionary file.",
    };
  }

  if (TRAIN_NAMES.test(fileName)) {
    return {
      role: "primary_data",
      confidence: 0.95,
      reason: "Filename indicates training/main dataset.",
    };
  }

  if (TEST_NAMES.test(fileName)) {
    return {
      role: "test_data",
      confidence: 0.95,
      reason: "Filename indicates test/prediction dataset.",
    };
  }

  if (rowCount <= 50 && dictionaryHits >= 1) {
    return {
      role: "metadata_dictionary",
      confidence: 0.75,
      reason: "Small file with metadata-like columns.",
    };
  }

  return {
    role: "primary_data",
    confidence: 0.65,
    reason: "Default analyzable dataset.",
  };
}

export function classifyUploadedDatasets(datasets = []) {
  const classified = datasets.map((dataset) => ({
    ...dataset,
    detectedRole: detectDatasetRole(dataset),
  }));

  const metadataFiles = classified.filter(
    (d) => d.detectedRole.role === "metadata_dictionary"
  );

  const testFiles = classified.filter((d) => d.detectedRole.role === "test_data");

  const primaryFiles = classified.filter(
    (d) => d.detectedRole.role === "primary_data"
  );

  const primaryDataset =
    primaryFiles.find((d) => /train/i.test(d.fileName || d.name || "")) ||
    primaryFiles[0] ||
    classified.find((d) => d.detectedRole.role !== "metadata_dictionary");

  return {
    classified,
    primaryDataset,
    metadataFiles,
    testFiles,
    analyzableDatasets: classified.filter(
      (d) => d.detectedRole.role !== "metadata_dictionary"
    ),
  };
}
