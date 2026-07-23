export const salaryDataset = {
  id: "test-local",
  name: "Salary Small",
  columns: ["country", "salary_usd", "experience"],
  rows: [
    { country: "India", salary_usd: 50000, experience: 2 },
    { country: "USA", salary_usd: 90000, experience: 5 },
    { country: "India", salary_usd: 65000, experience: 3 },
  ],
};

export const sentinelDataset = {
  id: "test-sentinel",
  name: "Sentinel Salary",
  columns: ["country", "salary_usd", "experience", "secret_note"],
  rows: [
    {
      country: "India",
      salary_usd: 50000,
      experience: 2,
      secret_note: "SECRET_RAW_ROW_SHOULD_NEVER_REACH_LLM",
    },
    { country: "USA", salary_usd: 90000, experience: 5, secret_note: "safe" },
  ],
};

export function makeReq(method, body = {}) {
  const jsonString = JSON.stringify(body);
  return {
    method,
    body,
    readable: false,
    headers: { "content-type": "application/json" },
    on(event, callback) {
      if (event === "data") {
        setTimeout(() => callback(Buffer.from(jsonString)), 0);
      } else if (event === "end") {
        setTimeout(() => callback(), 1);
      }
    },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(jsonString);
    }
  };
}

export function makeRes() {
  const response = {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      for (const [key, value] of Object.entries(headers)) this.setHeader(key, value);
    },
    end(chunk = "") {
      this.body += String(chunk);
    },
    json() {
      return JSON.parse(this.body || "{}");
    },
  };
  return response;
}
