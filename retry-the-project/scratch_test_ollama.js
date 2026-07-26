const OLLAMA_URL = "http://127.0.0.1:11434/api/generate";

async function test() {
  console.log("Starting fetch...");
  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",
        prompt: "Say hello",
        stream: false,
        format: "json",
      }),
    });
    const text = await response.text();
    console.log("Response:", text);
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
