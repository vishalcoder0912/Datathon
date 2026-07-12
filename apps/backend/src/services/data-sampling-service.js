/**
 * Data Sampling Service
 * Efficient sampling for large datasets
 */

export function stratifiedSample(rows, sampleSize = 1000) {
  if (rows.length <= sampleSize) return rows;

  const sampled = [];
  const step = Math.floor(rows.length / sampleSize);

  for (let i = 0; i < rows.length; i += step) {
    if (sampled.length < sampleSize) {
      sampled.push(rows[i]);
    }
  }

  return sampled;
}

export function randomSample(rows, sampleSize = 1000) {
  if (rows.length <= sampleSize) return rows;

  const sampled = [];
  const indices = new Set();

  while (sampled.length < sampleSize) {
    const idx = Math.floor(Math.random() * rows.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      sampled.push(rows[idx]);
    }
  }

  return sampled;
}

export function clusteredSample(rows, columns, sampleSize = 1000) {
  if (rows.length <= sampleSize) return rows;

  const groups = {};
  const catCol = columns.find(c => c.type === "string");

  if (!catCol) return randomSample(rows, sampleSize);

  rows.forEach((row, idx) => {
    const key = row[catCol.name];
    if (!groups[key]) groups[key] = [];
    groups[key].push(idx);
  });

  const groupSize = Math.floor(sampleSize / Object.keys(groups).length);
  const sampled = [];

  for (const groupIndices of Object.values(groups)) {
    for (let i = 0; i < Math.min(groupSize, groupIndices.length); i++) {
      sampled.push(rows[groupIndices[i]]);
    }
  }

  return sampled.slice(0, sampleSize);
}