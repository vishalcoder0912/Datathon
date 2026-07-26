import { parentPort, workerData } from "node:worker_threads";
import { toNumber, isMeaningfulValue } from "@insightflow/shared-analytics";

function extractNumericStats(values) {
  const numbers = [];
  let nullCount = 0;
  let invalidCount = 0;

  for (const val of values) {
    if (!isMeaningfulValue(val)) {
      nullCount += 1;
      continue;
    }

    const num = toNumber(val);
    if (num === null) {
      invalidCount += 1;
    } else {
      numbers.push(num);
    }
  }

  if (numbers.length < 10) {
    return {
      type: "numeric",
      isValid: false,
      reason: `Only ${numbers.length} valid values`,
      nullCount,
      invalidCount,
      validCount: numbers.length,
    };
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = numbers.reduce((a, b) => a + b, 0);
  const mean = sum / numbers.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  const variance = numbers.reduce((sumValue, num) => sumValue + ((num - mean) ** 2), 0) / numbers.length;
  const stdDev = Math.sqrt(variance);

  return {
    type: "numeric",
    isValid: true,
    min: Math.min(...numbers),
    max: Math.max(...numbers),
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    nullCount,
    invalidCount,
    validCount: numbers.length,
    uniqueCount: new Set(numbers).size,
  };
}

function extractCategoricalStats(values) {
  const valueCounts = new Map();
  let nullCount = 0;

  for (const val of values) {
    if (!isMeaningfulValue(val)) {
      nullCount += 1;
      continue;
    }

    const strVal = String(val).trim().substring(0, 100);
    if (valueCounts.size >= 100 && !valueCounts.has(strVal)) {
      continue;
    }

    valueCounts.set(strVal, (valueCounts.get(strVal) || 0) + 1);
  }

  const sorted = [...valueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    type: "categorical",
    isValid: true,
    nullCount,
    uniqueCount: valueCounts.size,
    topValues: Object.fromEntries(sorted),
    topValuesCount: sorted.length,
  };
}

function analyzeColumn(column, sampledRows) {
  const columnValues = sampledRows.map((row) => row[column.name]);

  if (column.type === "number") {
    return {
      name: column.name,
      ...extractNumericStats(columnValues),
    };
  }

  return {
    name: column.name,
    ...extractCategoricalStats(columnValues),
  };
}

try {
  const columns = Array.isArray(workerData?.columns) ? workerData.columns : [];
  const sampledRows = Array.isArray(workerData?.sampledRows) ? workerData.sampledRows : [];

  const analyzed = columns.map((column) => {
    try {
      return analyzeColumn(column, sampledRows);
    } catch (error) {
      return {
        name: column.name,
        type: column.type,
        isValid: false,
        error: error.message,
      };
    }
  });

  parentPort?.postMessage({ columns: analyzed });
} catch (error) {
  parentPort?.postMessage({ error: error.message });
}
