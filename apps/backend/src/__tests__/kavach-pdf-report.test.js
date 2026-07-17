import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createKavachPdfReport,
  pdfReportFileName,
  pdfReportRelativePath,
  persistKavachPdfReport,
  readKavachPdfReport,
} from '../kavach/report-pdf.js';
import { FileKavachRepository } from '../kavach/repositories/file-kavach-repository.js';
import { KavachServices } from '../kavach/kavach-services.js';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('KAVACH PDF reports', () => {
  it('creates a valid PDF and reads the persisted report through a constrained path', async () => {
    const reportId = '7d3b9f60-42f7-4a8b-9824-6c7f86e07c8d';
    const directory = await mkdtemp(join(tmpdir(), 'kavach-pdf-report-'));
    temporaryDirectories.push(directory);
    const pdfBuffer = await createKavachPdfReport({
      reportId,
      filters: { district: 'Mysuru', dateFrom: '2026-01-01', dateTo: '2026-01-31' },
      overview: { totalIncidents: 12, activeInvestigations: 4, dataPeriod: { start: '2026-01-01', end: '2026-01-31' } },
      verificationHash: 'synthetic-verification-hash',
    });

    expect(pdfBuffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdfBuffer.length).toBeGreaterThan(500);

    const persisted = await persistKavachPdfReport({ reportId, pdfBuffer, directory });
    expect(persisted.fileName).toBe(pdfReportFileName(reportId));
    expect(persisted.relativePath).toBe(pdfReportRelativePath(reportId));

    const restored = await readKavachPdfReport(persisted.relativePath, directory);
    expect(restored?.equals(pdfBuffer)).toBe(true);
    await expect(readKavachPdfReport('../not-a-report.pdf', directory)).resolves.toBeNull();
  });

  it('keeps the HTML preview when the file-demo report path returns a PDF', async () => {
    const repository = new FileKavachRepository();
    repository.loadAll();
    const services = new KavachServices(repository);
    services.setStoredAlerts([]);

    const report = await services.generateReport({ district: 'Mysuru' }, 'pdf');

    expect(report.format).toBe('pdf');
    expect(report.html).toContain('<!DOCTYPE html>');
    expect(report.filename).toMatch(/^kavach-report-[a-f0-9-]{36}\.pdf$/);
    expect(Buffer.from(report.pdfBase64, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
  });
});
