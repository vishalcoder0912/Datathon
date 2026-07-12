import { Daypart } from './enums.js';

export function classifyDaypart(hour) {
  if (hour === undefined || hour === null) return null;
  const h = Number(hour);
  if (h >= 0 && h < 5) return Daypart.LATE_NIGHT;
  if (h >= 5 && h < 7) return Daypart.DAWN;
  if (h >= 7 && h < 12) return Daypart.MORNING;
  if (h >= 12 && h < 17) return Daypart.AFTERNOON;
  if (h >= 17 && h < 21) return Daypart.EVENING;
  return Daypart.NIGHT;
}

export function parseDateSafe(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateISO(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

export function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeArray(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

export function roundTo(value, decimals = 2) {
  return Number(value.toFixed(decimals));
}

export function isSufficientData(count, threshold = 5) {
  return count >= threshold;
}

export function getPeriodDates(fromDate, toDate) {
  const end = toDate ? new Date(toDate) : new Date();
  const start = fromDate ? new Date(fromDate) : new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
  return { start, end };
}

export function zScore(values, value) {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const std = Math.sqrt(variance);
  return std === 0 ? 0 : (value - mean) / std;
}

export function iqr(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  return { q1, q3, iqr: q3 - q1 };
}
