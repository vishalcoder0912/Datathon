/**
 * QR Code Generation and File Upload Service
 * Allows users to scan QR code and upload files from mobile
 */

import { randomUUID } from "node:crypto";

const activeUploads = new Map();

export function generateUploadQRSession() {
  const sessionId = randomUUID().substring(0, 8).toUpperCase();
  const uploadToken = randomUUID();
  
  const session = {
    sessionId,
    uploadToken,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    status: "waiting",
    fileInfo: null,
  };

  activeUploads.set(sessionId, session);

  setTimeout(() => {
    if (activeUploads.has(sessionId)) {
      activeUploads.delete(sessionId);
    }
  }, 15 * 60 * 1000);

  return {
    sessionId,
    uploadToken,
    expiresAt: session.expiresAt,
    uploadUrl: `/api/qr-upload/${sessionId}/${uploadToken}`,
  };
}

export function getUploadSessionStatus(sessionId, uploadToken) {
  const session = activeUploads.get(sessionId);

  if (!session) {
    return { error: "Session not found or expired", status: "expired" };
  }

  if (session.uploadToken !== uploadToken) {
    return { error: "Invalid upload token", status: "unauthorized" };
  }

  return {
    sessionId,
    status: session.status,
    fileInfo: session.fileInfo,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}

export function handleQRFileUpload(sessionId, uploadToken, fileData, fileName) {
  const session = activeUploads.get(sessionId);

  if (!session) {
    throw new Error("Session not found or expired");
  }

  if (session.uploadToken !== uploadToken) {
    throw new Error("Invalid upload token");
  }

  if (new Date() > new Date(session.expiresAt)) {
    activeUploads.delete(sessionId);
    throw new Error("Session expired");
  }

  session.status = "completed";
  session.fileInfo = {
    name: fileName,
    size: fileData.length,
    uploadedAt: new Date().toISOString(),
  };

  return {
    success: true,
    sessionId,
    fileName,
    uploadedAt: new Date().toISOString(),
  };
}

export function cleanupExpiredSessions() {
  const now = new Date();
  let cleaned = 0;

  for (const [sessionId, session] of activeUploads.entries()) {
    if (new Date(session.expiresAt) < now) {
      activeUploads.delete(sessionId);
      cleaned++;
    }
  }

  return cleaned;
}

export function getActiveSessionsCount() {
  return activeUploads.size;
}