const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const isProduction = process.env.NODE_ENV === "production";

class Logger {
  constructor() {
    this.minLevel = isProduction ? "error" : "debug";
  }

  shouldLog(level) {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.minLevel];
  }

  formatEntry(level, message, context = {}) {
    const entry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      ...context,
    };
    return JSON.stringify(entry);
  }

  log(level, message, context = {}) {
    if (!this.shouldLog(level)) return;

    const formatted = this.formatEntry(level, message, context);

    if (level === "error" || level === "warn") {
      console.error(formatted);
    } else {
      console.log(formatted);
    }
  }

  error(message, context = {}) {
    this.log("error", message, context);
  }

  warn(message, context = {}) {
    this.log("warn", message, context);
  }

  info(message, context = {}) {
    this.log("info", message, context);
  }

  debug(message, context = {}) {
    this.log("debug", message, context);
  }

  logRequest(method, pathname, statusCode, duration, error = null) {
    const context = {
      request: { method, pathname },
      response: { statusCode, duration },
    };

    if (error) {
      this.error(`Request failed: ${method} ${pathname}`, {
        ...context,
        error: { message: error.message, stack: error.stack },
      });
    } else if (statusCode >= 400) {
      this.warn(`Request error: ${method} ${pathname}`, context);
    } else {
      this.info(`Request: ${method} ${pathname}`, context);
    }
  }
}

const logger = new Logger();
export default logger;
export { Logger };