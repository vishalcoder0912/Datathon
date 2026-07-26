import { request, type FullConfig } from "@playwright/test";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

async function globalSetup(config: FullConfig) {
  console.log("[global-setup] Starting global setup...");

  const apiContext = await request.newContext({
    baseURL: BACKEND_URL,
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  });

  // 1. Verify backend is healthy
  let healthy = false;
  for (let i = 0; i < 10; i++) {
    try {
      const res = await apiContext.get("/api/health", { timeout: 5000 });
      if (res.ok()) {
        healthy = true;
        console.log("[global-setup] Backend is healthy");
        break;
      }
    } catch {
      console.log(`[global-setup] Waiting for backend... (attempt ${i + 1})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (!healthy) {
    console.warn("[global-setup] Backend not reachable — tests may fail");
  }

  // 2. Seed test data
  const testEmail = `e2e-setup-${Date.now()}@test.com`;
  try {
    const regRes = await apiContext.post("/api/auth/register", {
      data: {
        email: testEmail,
        password: "E2eSetupPass1!",
        name: "E2E Setup User",
      },
    });
    if (regRes.ok()) {
      const regBody = await regRes.json();
      const token = regBody.data?.accessToken;
      process.env.E2E_TEST_TOKEN = token || "";
      process.env.E2E_TEST_EMAIL = testEmail;
      console.log("[global-setup] Test user registered");

      // Create a test dataset
      if (token) {
        const authHeaders = { Authorization: `Bearer ${token}` };
        const dsRes = await apiContext.post("/api/datasets/import", {
          headers: authHeaders,
          multipart: {
            file: {
              name: "e2e-test-data.csv",
              mimeType: "text/csv",
              buffer: Buffer.from("name,age,score\nAlice,30,95\nBob,25,87\nCharlie,35,92"),
            },
          },
        });
        if (dsRes.ok()) {
          const dsBody = await dsRes.json();
          process.env.E2E_TEST_DATASET_ID = dsBody.data?.dataset?.id || "";
          console.log("[global-setup] Test dataset created");
        } else {
          console.warn("[global-setup] Dataset creation failed, using mock data");
          process.env.E2E_TEST_DATASET_ID = "e2e-mock-dataset";
        }
      }
    } else {
      console.warn("[global-setup] Registration failed, using mock data");
      process.env.E2E_TEST_TOKEN = "e2e-mock-token";
      process.env.E2E_TEST_EMAIL = testEmail;
      process.env.E2E_TEST_DATASET_ID = "e2e-mock-dataset";
    }
  } catch (err) {
    console.warn("[global-setup] Error seeding data:", (err as Error).message);
    process.env.E2E_TEST_TOKEN = "e2e-mock-token";
    process.env.E2E_TEST_EMAIL = testEmail;
    process.env.E2E_TEST_DATASET_ID = "e2e-mock-dataset";
  }

  // 3. Configure network mocking pattern
  process.env.E2E_MOCK_MODE = process.env.E2E_MOCK_MODE || "live";

  // Store auth state for reuse
  process.env.E2E_SETUP_COMPLETE = "true";
  console.log("[global-setup] Setup complete");
}

export default globalSetup;
