/// <reference types="vite/client" />

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

interface LoggerOptions {
  minLevel?: LogLevel;
  enableConsole?: boolean;
  remoteUrl?: string;
}

class Logger {
  private static instance: Logger;
  private minLevel: LogLevel;
  private enableConsole: boolean;
  private remoteUrl?: string;

  private constructor(options: LoggerOptions = {}) {
    this.minLevel = options.minLevel ?? this.getLogLevel();
    this.enableConsole = options.enableConsole ?? true;
    this.remoteUrl = options.remoteUrl;
  }

  private getLogLevel(): LogLevel {
    const env = import.meta.env as { PROD?: boolean; DEV?: boolean; VITE_LOG_LEVEL?: string };
    
    if (env.VITE_LOG_LEVEL) {
      const level = env.VITE_LOG_LEVEL.toLowerCase() as LogLevel;
      if (level in LOG_LEVELS) {
        return level;
      }
    }
    
    if (env.PROD) {
      return "error";
    }
    if (env.DEV) {
      return "debug";
    }
    return "info";
  }

  private shouldLog(level: LogLevel): boolean {
    const currentLevel = LOG_LEVELS[this.minLevel];
    const targetLevel = LOG_LEVELS[level];
    return targetLevel <= currentLevel;
  }

  private formatEntry(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  private serializeError(error: unknown): LogEntry["error"] | undefined {
    if (!error) return undefined;
    
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    
    if (typeof error === "object" && error !== null) {
      const err = error as Record<string, unknown>;
      return {
        name: String(err.name ?? "Error"),
        message: String(err.message ?? ""),
        stack: err.stack ? String(err.stack) : undefined,
      };
    }
    
    return {
      name: "Error",
      message: String(error),
    };
  }

  private async sendToRemote(entry: LogEntry): Promise<void> {
    if (!this.remoteUrl) return;
    
    try {
      await fetch(this.remoteUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: this.formatEntry(entry),
      });
    } catch {
      console.warn("[Logger] Failed to send logs to remote");
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: unknown) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: context && Object.keys(context).length > 0 ? context : undefined,
      error: this.serializeError(error),
    };

    const formatted = this.formatEntry(entry);

    if (this.enableConsole) {
      if (level === "error" || level === "warn") {
        console.error(formatted);
      } else {
        console.log(formatted);
      }
    }

    if (this.remoteUrl) {
      this.sendToRemote(entry).catch(() => {});
    }
  }

  error(message: string, context?: Record<string, unknown>, error?: unknown) {
    this.log("error", message, context, error);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log("warn", message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log("info", message, context);
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log("debug", message, context);
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  setRemoteUrl(url: string): void {
    this.remoteUrl = url;
  }

  enable(enabled: boolean): void {
    this.enableConsole = enabled;
  }

  static getInstance(options?: LoggerOptions): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(options);
    }
    return Logger.instance;
  }

  static resetInstance(): void {
    Logger.instance = undefined as unknown as Logger;
  }
}

const logger = Logger.getInstance();

export { logger, Logger, LOG_LEVELS, type LogLevel, type LogEntry, type LoggerOptions };
export default logger;