import { randomUUID } from "node:crypto";

const sessions = new Map();
const DEFAULT_TTL_MS = 1000 * 60 * 30;

export function createQrUploadSession({
  portalBaseUrl,
  workspaceName = "InsightFlow Workspace",
}) {
  const sessionId = randomUUID();
  const uploadToken = randomUUID();
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS).toISOString();

  const uploadUrl = `${portalBaseUrl.replace(/\/$/, "")}/mobile-upload/${sessionId}?token=${uploadToken}`;

  const session = {
    sessionId,
    uploadToken,
    workspaceName,
    uploadUrl,
    status: "waiting",
    files: [],
    dataset: null,
    analysis: null,
    error: null,
    createdAt: new Date().toISOString(),
    expiresAt,
  };

  sessions.set(sessionId, session);
  return session;
}

export function getQrUploadSession(sessionId) {
  const session = sessions.get(sessionId);

  if (!session) return null;

  if (
    Date.now() > new Date(session.expiresAt).getTime() &&
    session.status !== "completed"
  ) {
    session.status = "expired";
  }

  return session;
}

export function verifyQrUploadSession(sessionId, token) {
  const session = getQrUploadSession(sessionId);

  if (!session) {
    throw new Error("Upload session not found.");
  }

  if (session.status === "expired") {
    throw new Error("Upload session expired. Generate a new QR code.");
  }

  if (session.uploadToken !== token) {
    throw new Error("Invalid upload token.");
  }

  return session;
}

export function updateQrUploadSession(sessionId, patch) {
  const session = getQrUploadSession(sessionId);

  if (!session) return null;

  const updated = {
    ...session,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  sessions.set(sessionId, updated);
  return updated;
}
