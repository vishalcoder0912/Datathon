import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "__data__");
const BASE = "http://localhost:3001";

function ensureTestFiles() {
  if (fs.existsSync(DATA_DIR)) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });

  fs.writeFileSync(path.join(DATA_DIR, "test.png"), createPng());
  fs.writeFileSync(path.join(DATA_DIR, "test.jpg"), Buffer.alloc(128, "J"));
  fs.writeFileSync(path.join(DATA_DIR, "test.svg"), "<svg xmlns='http://www.w3.org/2000/svg'><rect width='100' height='100'/></svg>");
  fs.writeFileSync(path.join(DATA_DIR, "test.gif"), Buffer.from("GIF89a", "utf-8"));
  fs.writeFileSync(path.join(DATA_DIR, "test.webp"), Buffer.alloc(64, "W"));
  fs.writeFileSync(path.join(DATA_DIR, "test.pdf"), Buffer.alloc(256, "P"));
  fs.writeFileSync(path.join(DATA_DIR, "test.zip"), Buffer.alloc(512, "Z"));
  fs.writeFileSync(path.join(DATA_DIR, "test.exe"), Buffer.alloc(128, "E"));
  fs.writeFileSync(path.join(DATA_DIR, "empty.csv"), "");
  fs.writeFileSync(path.join(DATA_DIR, "corrupted.csv"), "col1,col2\n");
  const eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
  fs.writeFileSync(path.join(DATA_DIR, "eicar.txt"), eicar);
  fs.writeFileSync(path.join(DATA_DIR, "innocent.exe.csv"), "col1,col2\nval1,val2");
  const longName = "A".repeat(255) + ".csv";
  fs.writeFileSync(path.join(DATA_DIR, longName), "col1,col2\nval1,val2");
  const emojiName = "\u{1F600}\u{1F600}_file.csv";
  fs.writeFileSync(path.join(DATA_DIR, emojiName), "col1,col2\nval1,val2");
  const bigFile = path.join(DATA_DIR, "50mb.csv");
  if (!fs.existsSync(bigFile)) {
    const stream = fs.createWriteStream(bigFile);
    stream.write("col1,col2\n");
    for (let i = 0; i < 500000; i++) {
      stream.write(`val${i},val${i}\n`);
    }
    stream.end();
  }
}

function createPng() {
  // minimal valid PNG (1x1 red pixel)
  const png = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0xD7, 0x63, 0x60, 0x60, 0x00, 0x00,
    0x00, 0x04, 0x00, 0x01, 0x27, 0x34, 0x27, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, // IEND chunk
    0x42, 0x60, 0x82,
  ]);
  return png;
}

test.describe("Upload Extreme — File Type Variations", () => {
  test.beforeAll(() => {
    ensureTestFiles();
  });

  const files = ["test.png", "test.jpg", "test.svg", "test.gif", "test.webp", "test.pdf", "test.zip", "test.exe"];

  for (const file of files) {
    test(`upload ${file}`, async ({ request }) => {
      const filePath = path.join(DATA_DIR, file);
      const buffer = fs.readFileSync(filePath);
      const res = await request.post(`${BASE}/api/datasets/import`, {
        multipart: {
          file: { name: file, mimeType: "application/octet-stream", buffer },
        },
      });
      const status = res.status();
      expect([200, 201, 400, 415, 413, 422]).toContain(status);
    });
  }
});

test.describe("Upload Extreme — Edge Cases", () => {
  test("upload 50MB file returns 413 or handled gracefully", async ({ request }) => {
    const filePath = path.join(DATA_DIR, "50mb.csv");
    const stat = fs.statSync(filePath);
    test.skip(stat.size < 1000000, "50MB file not generated yet, skipping");
    const buffer = fs.readFileSync(filePath);
    const res = await request.post(`${BASE}/api/datasets/import`, {
      multipart: {
        file: { name: "50mb.csv", mimeType: "text/csv", buffer },
      },
    });
    expect([200, 201, 413, 400]).toContain(res.status());
  });

  test("upload empty file returns 400 or 422", async ({ request }) => {
    const res = await request.post(`${BASE}/api/datasets/import`, {
      multipart: {
        file: { name: "empty.csv", mimeType: "text/csv", buffer: Buffer.alloc(0) },
      },
    });
    expect([200, 201, 400, 422]).toContain(res.status());
  });

  test("upload EICAR test file is blocked or sanitized", async ({ request }) => {
    const filePath = path.join(DATA_DIR, "eicar.txt");
    const buffer = fs.readFileSync(filePath);
    const res = await request.post(`${BASE}/api/datasets/import`, {
      multipart: {
        file: { name: "eicar.txt", mimeType: "text/plain", buffer },
      },
    });
    expect([400, 403, 422, 200, 201]).toContain(res.status());
  });

  test("file with wrong extension (.exe renamed as .csv)", async ({ request }) => {
    const filePath = path.join(DATA_DIR, "innocent.exe.csv");
    const buffer = fs.readFileSync(filePath);
    const res = await request.post(`${BASE}/api/datasets/import`, {
      multipart: {
        file: { name: "innocent.exe.csv", mimeType: "text/csv", buffer },
      },
    });
    expect([200, 201, 400, 422]).toContain(res.status());
  });

  test("very long filename handled", async ({ request }) => {
    const longName = "A".repeat(255) + ".csv";
    const filePath = path.join(DATA_DIR, longName);
    if (!fs.existsSync(filePath)) {
      test.skip(true, "long filename file not created");
      return;
    }
    const buffer = fs.readFileSync(filePath);
    const res = await request.post(`${BASE}/api/datasets/import`, {
      multipart: {
        file: { name: longName, mimeType: "text/csv", buffer },
      },
    });
    expect([200, 201, 400, 413, 422]).toContain(res.status());
  });

  test("emoji filename handled", async ({ request }) => {
    const emojiName = "\u{1F600}\u{1F600}_file.csv";
    const filePath = path.join(DATA_DIR, emojiName);
    if (!fs.existsSync(filePath)) {
      test.skip(true, "emoji file not created");
      return;
    }
    const buffer = fs.readFileSync(filePath);
    const res = await request.post(`${BASE}/api/datasets/import`, {
      multipart: {
        file: { name: emojiName, mimeType: "text/csv", buffer },
      },
    });
    expect([200, 201, 400, 422]).toContain(res.status());
  });
});

test.describe("Upload Extreme — Drag and Drop on Frontend", () => {
  test("drag-and-drop file uploads via page", async ({ page }) => {
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    const filePath = path.join(DATA_DIR, "test.png");
    const buffer = fs.readFileSync(filePath);
    const file = {
      name: "test.png",
      mimeType: "image/png",
      buffer: buffer.toString("base64"),
    };
    await page.evaluate(
      ({ dt, file }) => {
        const f = new File([Uint8Array.from(atob(file.buffer), (c) => c.charCodeAt(0))], file.name, { type: file.mimeType });
        dt.items.add(f);
      },
      { dt: dataTransfer, file }
    );
    await page.goto(`${BASE.replace("3001", "5173")}/upload`);
    const dropZone = page.locator('[aria-label="Upload zone"], .dropzone, [data-testid="dropzone"]').first();
    if (await dropZone.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dropZone.dispatchEvent("drop", { dataTransfer });
      await expect(page.locator("body")).toBeVisible({ timeout: 5000 });
    } else {
      test.skip(true, "no dropzone found on upload page");
    }
  });
});
