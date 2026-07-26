// Compatibility entrypoint.
// The canonical server implementation is src/index.js -> src/core/server.js.
// Keeping this shim prevents accidental startup of the old inline route stack.
import "./index.js";
