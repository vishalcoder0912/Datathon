import { request, type FullConfig } from "@playwright/test";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

async function globalTeardown(config: FullConfig) {
  console.log("[global-teardown] Cleaning up test data...");

  const token = process.env.E2E_TEST_TOKEN;
  const datasetId = process.env.E2E_TEST_DATASET_ID;

  if (!token) {
    console.log("[global-teardown] No test token to clean up");
    return;
  }

  const apiContext = await request.newContext({
    baseURL: BACKEND_URL,
    extraHTTPHeaders: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  // 1. Delete test dataset if it exists
  if (datasetId && datasetId !== "e2e-mock-dataset") {
    try {
      const delRes = await apiContext.delete(`/api/datasets/${datasetId}`);
      if (delRes.ok()) {
        console.log(`[global-teardown] Deleted test dataset: ${datasetId}`);
      } else {
        console.warn(`[global-teardown] Failed to delete dataset ${datasetId}: ${delRes.status()}`);
      }
    } catch (err) {
      console.warn("[global-teardown] Error deleting dataset:", (err as Error).message);
    }
  }

  // 2. Logout to invalidate refresh token
  try {
    await apiContext.post("/api/auth/logout");
    console.log("[global-teardown] Test user logged out");
  } catch {
    // non-critical
  }

  // 3. Clean up temporary test data
  process.env.E2E_TEST_TOKEN = "";
  process.env.E2E_TEST_EMAIL = "";
  process.env.E2E_TEST_DATASET_ID = "";

  console.log("[global-teardown] Cleanup complete");
}

export default globalTeardown;
