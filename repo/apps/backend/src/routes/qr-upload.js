import Busboy from "busboy";
import QRCode from "qrcode";
import { serviceUrls } from "../config/serviceUrls.js";
import { randomUUID } from "node:crypto";
import { sendSuccess, sendError, sendRedirect } from "../utils/response-utils.js";
import { HTTP_STATUS, ERROR_CODES } from "../config/constants.js";
import { createDataset } from "../database/dataset-repository.js";
import { updateDataset, updateAnalysis } from "./state.js";
import {
  createQrUploadSession,
  getQrUploadSession,
  updateQrUploadSession,
  verifyQrUploadSession,
} from "../services/qr-upload/qr-upload-store.js";
import {
  mergeParsedDatasets,
  parseDatasetFile,
} from "../services/qr-upload/qr-file-parser.js";

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString();

      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Request body too large."));
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });

    request.on("error", reject);
  });
}

function getRequestUrl(request) {
  return new URL(request.url, `http://${request.headers.host}`);
}

function getPortalBaseUrl(request) {
  const configuredBaseUrl =
    process.env.FRONTEND_PUBLIC_URL ||
    process.env.VITE_PUBLIC_APP_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.CLIENT_ORIGIN ||
    (process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== "*"
      ? process.env.CORS_ORIGIN
      : "");

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  if (request.headers.origin) {
    return request.headers.origin.replace(/\/$/, "");
  }

  const protocol = request.headers["x-forwarded-proto"] || "http";
  const host = request.headers.host || new URL(serviceUrls.api).host;

  if (host === new URL(serviceUrls.api).host) {
    return serviceUrls.frontend;
  }

  if (host === "127.0.0.1:3001") {
    return `${protocol}://127.0.0.1:5173`;
  }

  return `${protocol}://${host}`;
}

function buildMobilePortalUrl(request, sessionId, token) {
  const redirectUrl = new URL(
    `/mobile-upload/${encodeURIComponent(sessionId)}`,
    getPortalBaseUrl(request)
  );

  if (token) {
    redirectUrl.searchParams.set("token", token);
  }

  return redirectUrl.toString();
}

function parseMultipartFiles(request) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: request.headers,
      limits: {
        files: 10,
        fileSize: 80 * 1024 * 1024,
      },
    });

    const fileTasks = [];

    busboy.on("file", (fieldName, file, info) => {
      const chunks = [];
      const filename = String(info.filename || "dataset").replace(/[^\w.-]+/g, "_");

      file.on("data", (chunk) => chunks.push(chunk));
      file.on("limit", () => reject(new Error(`${filename} is too large.`)));

      fileTasks.push(
        new Promise((resolveFile, rejectFile) => {
          file.on("end", () => {
            resolveFile({
              fieldName,
              filename,
              mimeType: info.mimeType,
              buffer: Buffer.concat(chunks),
            });
          });

          file.on("error", rejectFile);
        })
      );
    });

    busboy.on("finish", async () => {
      try {
        const files = await Promise.all(fileTasks);

        if (!files.length) {
          reject(new Error("No files uploaded."));
          return;
        }

        resolve({ files });
      } catch (error) {
        reject(error);
      }
    });

    busboy.on("error", reject);
    request.pipe(busboy);
  });
}

function safeNumber(value) {
  const parsed = Number(String(value ?? "").replace(/[,$₹%]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildBasicAnalysis(dataset) {
  const rows = dataset.rows || [];
  const columns = dataset.columns || [];

  const metric =
    columns.find((column) =>
      ["salary", "salary_usd", "revenue", "sales", "amount", "score", "price"].some((key) =>
        column.name.toLowerCase().includes(key)
      )
    ) || columns.find((column) => column.type === "number");

  const dimension =
    columns.find((column) =>
      ["country", "region", "education", "product", "category", "company"].some((key) =>
        column.name.toLowerCase().includes(key)
      )
    ) || columns.find((column) => column.type !== "number");

  const kpis = [
    {
      id: randomUUID(),
      title: "Total Records",
      value: rows.length.toLocaleString(),
      metric: "*",
      aggregation: "count",
    },
    {
      id: randomUUID(),
      title: "Columns",
      value: columns.length.toLocaleString(),
      metric: "*",
      aggregation: "count",
    },
  ];

  if (metric) {
    const nums = rows
      .map((row) => safeNumber(row[metric.name]))
      .filter((value) => value !== null);

    if (nums.length) {
      kpis.push(
        {
          id: randomUUID(),
          title: `Average ${metric.name}`,
          value: Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)).toLocaleString(),
          metric: metric.name,
          aggregation: "avg",
        },
        {
          id: randomUUID(),
          title: `Highest ${metric.name}`,
          value: Math.max(...nums).toLocaleString(),
          metric: metric.name,
          aggregation: "max",
        }
      );
    }
  }

  const chartRecommendations = [];

  if (dimension) {
    const counts = new Map();

    for (const row of rows) {
      const label = String(row[dimension.name] ?? "Unknown").trim() || "Unknown";
      counts.set(label, (counts.get(label) || 0) + 1);
    }

    chartRecommendations.push({
      id: randomUUID(),
      type: "bar",
      title: `Rows by ${dimension.name}`,
      xKey: dimension.name,
      yKey: "count",
      aggregation: "count",
      data: [...counts.entries()]
        .map(([label, count]) => ({
          [dimension.name]: label,
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    });
  }

  return {
    dataType: "qr_upload_dataset",
    dataTypeLabel: "QR Uploaded Dataset",
    kpis,
    chartRecommendations,
    insights: [
      {
        type: "summary",
        title: "Dataset Uploaded",
        message: `Uploaded ${rows.length.toLocaleString()} rows and ${columns.length.toLocaleString()} columns from QR/mobile upload.`,
      },
    ],
    privacy: {
      schemaOnly: true,
      dashboardValuesCalculatedLocally: true,
    },
  };
}

export async function handleQrUploadRoutes(request, response, pathname) {
  const { method } = request;
  const url = getRequestUrl(request);

  if (pathname === "/api/qr-upload/generate" && method === "POST") {
    try {
      const body = await readJsonBody(request);

      const portalBaseUrl =
        body.portalBaseUrl ||
        process.env.FRONTEND_PUBLIC_URL ||
        request.headers.origin ||
        `http://${request.headers.host}`;

      const session = createQrUploadSession({
        portalBaseUrl,
        workspaceName: body.workspaceName || "InsightFlow Workspace",
      });

      const qrDataUrl = await QRCode.toDataURL(session.uploadUrl, {
        margin: 1,
        width: 320,
        color: {
          dark: "#111827",
          light: "#ffffff",
        },
      });

      sendSuccess(
        response,
        {
          sessionId: session.sessionId,
          uploadToken: session.uploadToken,
          uploadUrl: session.uploadUrl,
          qrDataUrl,
          workspaceName: session.workspaceName,
          status: session.status,
          expiresAt: session.expiresAt,
        },
        "QR upload session generated"
      );

      return true;
    } catch (error) {
      sendError(
        response,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error.message || "Failed to generate QR session",
        ERROR_CODES.INTERNAL_ERROR
      );

      return true;
    }
  }

  const statusMatch = pathname.match(/^\/api\/qr-upload\/([^/]+)\/status$/);

  if (statusMatch && method === "GET") {
    try {
      const [, sessionId] = statusMatch;
      const token = url.searchParams.get("token");
      const session = verifyQrUploadSession(sessionId, token);

      sendSuccess(
        response,
        {
          sessionId: session.sessionId,
          status: session.status,
          workspaceName: session.workspaceName,
          files: session.files,
          dataset: session.dataset,
          analysis: session.analysis,
          error: session.error,
          expiresAt: session.expiresAt,
        },
        "QR session status"
      );

      return true;
    } catch (error) {
      sendError(
        response,
        HTTP_STATUS.BAD_REQUEST,
        error.message || "QR session status failed",
        ERROR_CODES.VALIDATION_ERROR
      );

      return true;
    }
  }

  const uploadMatch = pathname.match(/^\/api\/qr-upload\/([^/]+)\/upload$/);

  if (uploadMatch && method === "GET") {
    const [, sessionId] = uploadMatch;
    const token = url.searchParams.get("token");
    const session = getQrUploadSession(sessionId);

    sendRedirect(
      response,
      session?.uploadUrl || buildMobilePortalUrl(request, sessionId, token),
      302
    );

    return true;
  }

  if (uploadMatch && method === "POST") {
    const [, sessionId] = uploadMatch;
    const token = url.searchParams.get("token");

    try {
      verifyQrUploadSession(sessionId, token);

      updateQrUploadSession(sessionId, {
        status: "uploading",
      });

      const { files } = await parseMultipartFiles(request);

      const parsedFiles = files.map((file) => {
        const parsed = parseDatasetFile({
          filename: file.filename,
          buffer: file.buffer,
        });

        return {
          ...parsed,
          sizeBytes: file.buffer.length,
          status: "uploaded",
        };
      });

      const merged = mergeParsedDatasets(parsedFiles);

      const savedResult = createDataset({
        name: merged.name,
        fileName: merged.fileName,
        sourceType: merged.sourceType,
        columns: merged.columns,
        rows: merged.rows,
      });

      const dataset =
        savedResult?.dataset ||
        savedResult || {
          id: randomUUID(),
          ...merged,
          uploadedAt: new Date().toISOString(),
        };

      const analysis = buildBasicAnalysis(dataset);

      try {
        updateDataset(dataset);
        updateAnalysis(analysis);
      } catch {
        // keep response working
      }

      const updated = updateQrUploadSession(sessionId, {
        status: "completed",
        files: parsedFiles.map((file) => ({
          name: file.fileName,
          rowCount: file.rowCount,
          columnCount: file.columnCount,
          sizeBytes: file.sizeBytes,
          status: "uploaded",
        })),
        dataset,
        analysis,
      });

      sendSuccess(
        response,
        {
          sessionId,
          status: updated.status,
          workspaceName: updated.workspaceName,
          expiresAt: updated.expiresAt,
          files: updated.files,
          dataset,
          analysis,
        },
        "Files uploaded and dataset synced"
      );

      return true;
    } catch (error) {
      updateQrUploadSession(sessionId, {
        status: "error",
        error: error.message,
      });

      sendError(
        response,
        HTTP_STATUS.BAD_REQUEST,
        error.message || "QR upload failed",
        ERROR_CODES.VALIDATION_ERROR
      );

      return true;
    }
  }

  return false;
}

export default {
  handleQrUploadRoutes,
};
