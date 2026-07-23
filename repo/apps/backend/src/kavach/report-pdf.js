import PDFDocument from 'pdfkit';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
export const defaultReportDirectory = resolve(moduleDirectory, '../../data/kavach-reports');

const allowedFilterKeys = [
  'dateFrom',
  'dateTo',
  'district',
  'districtId',
  'policeStation',
  'stationId',
  'crimeType',
  'crimeHeadId',
  'crimeSubHeadId',
  'severity',
  'status',
  'daypart',
];

const syntheticDataNotice = 'Prototype using synthetic data. All intelligence outputs require human verification and must not be used as the sole basis for law-enforcement action.';

const safeText = (value, fallback = 'Not available') => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value).replaceAll('\u0000', '').slice(0, 1_000);
};

const normaliseReportId = (reportId) => {
  const value = String(reportId || '');
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(value)) {
    throw new Error('A safe report identifier is required for PDF output.');
  }
  return value;
};

export const pdfReportFileName = (reportId) => `kavach-report-${normaliseReportId(reportId)}.pdf`;
export const pdfReportRelativePath = (reportId) => `kavach-reports/${pdfReportFileName(reportId)}`;

const filteredDescription = (filters = {}) => allowedFilterKeys
  .filter((key) => filters[key] !== undefined && filters[key] !== null && filters[key] !== '')
  .map((key) => `${key}: ${safeText(filters[key])}`);

export const createKavachPdfReport = async ({
  title = 'KAVACH Intelligence Report',
  reportId,
  filters = {},
  overview = {},
  verificationHash,
  generatedAt = new Date().toISOString(),
} = {}) => new Promise((resolvePromise, reject) => {
  const chunks = [];
  const document = new PDFDocument({
    size: 'A4',
    margin: 48,
    info: {
      Title: safeText(title),
      Author: 'KAVACH AI',
      Subject: 'Synthetic crime intelligence report',
      Creator: 'KAVACH AI',
    },
  });

  const remainingSpace = () => document.page.height - document.page.margins.bottom - document.y;
  const ensureSpace = (required = 48) => {
    if (remainingSpace() < required) {
      document.addPage();
    }
  };
  const heading = (text) => {
    ensureSpace(42);
    document.moveDown(0.75).font('Helvetica-Bold').fontSize(13).fillColor('#1D4ED8').text(text);
    document.moveDown(0.25);
  };
  const line = (text, options = {}) => {
    ensureSpace(28);
    document.font('Helvetica').fontSize(options.small ? 8 : 10).fillColor(options.muted ? '#64748B' : '#0F172A').text(text, {
      width: document.page.width - document.page.margins.left - document.page.margins.right,
      lineGap: 2,
    });
  };

  document.on('data', (chunk) => chunks.push(chunk));
  document.once('error', reject);
  document.once('end', () => resolvePromise(Buffer.concat(chunks)));

  document.font('Helvetica-Bold').fontSize(22).fillColor('#0F172A').text(safeText(title));
  document.font('Helvetica-Bold').fontSize(10).fillColor('#1D4ED8').text('Karnataka AI Visualization & Analytics for Crime Hotspots');
  document.moveDown(0.8);
  line(`Report ID: ${safeText(reportId)}`, {small: true, muted: true});
  line(`Generated: ${safeText(generatedAt)}`, {small: true, muted: true});

  heading('Executive summary');
  line(`Total incidents in scope: ${safeText(overview.totalIncidents, '0')}`);
  line(`Active investigations: ${safeText(overview.activeInvestigations, '0')}`);
  line(`Most common category: ${safeText(overview.mostCommonCategory, 'Unknown')}`);
  line(`Multiple-case links: ${safeText(overview.repeatOffenders, '0')}`);
  line(`Active alerts: ${safeText(overview.currentAlerts, '0')}`);
  line(`Data period: ${safeText(overview?.dataPeriod?.start)} to ${safeText(overview?.dataPeriod?.end)}`);

  heading('Filters and data sources');
  const filtersApplied = filteredDescription(filters);
  if (filtersApplied.length === 0) {
    line('No additional filters were applied.');
  } else {
    filtersApplied.forEach((filter) => line(`- ${filter}`));
  }
  line('Data source: PostgreSQL/PostGIS synthetic KAVACH dataset.');
  line('Model context: transparent district-risk baseline where applicable.');

  heading('Human review and limitations');
  line(syntheticDataNotice);
  line('Correlation findings, anomaly signals, and risk scores are decision-support indicators only; they do not establish causation or guilt.');

  heading('Verification');
  line(`Verification hash: ${safeText(verificationHash)}`, {small: true, muted: true});
  line('Generated locally with PDFKit; no paid API is required.', {small: true, muted: true});

  document.end();
});

export const persistKavachPdfReport = async ({reportId, pdfBuffer, directory = defaultReportDirectory} = {}) => {
  const fileName = pdfReportFileName(reportId);
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new Error('A non-empty PDF buffer is required for persistence.');
  }
  await mkdir(directory, {recursive: true});
  await writeFile(resolve(directory, fileName), pdfBuffer);
  return {
    fileName,
    relativePath: pdfReportRelativePath(reportId),
  };
};

export const readKavachPdfReport = async (relativePath, directory = defaultReportDirectory) => {
  if (typeof relativePath !== 'string' || !/^kavach-reports\/kavach-report-[a-zA-Z0-9-]{8,128}\.pdf$/.test(relativePath)) {
    return null;
  }
  try {
    return await readFile(resolve(directory, relativePath.slice('kavach-reports/'.length)));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

export {syntheticDataNotice};
