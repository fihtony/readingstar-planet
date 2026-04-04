/**
 * Minimal structured logger that sanitizes error details in production.
 *
 * In production the full error stack is never printed to stdout/stderr to
 * prevent leaking internal paths or dependency version details to log
 * aggregation services.  Only a safe, generic message is emitted.
 *
 * In development the full error is logged as-is for easy debugging.
 */

const isProd = process.env.NODE_ENV === "production";

function safeMessage(error: unknown): string {
  if (!isProd) return String(error);
  if (error instanceof Error) return error.message.replace(/\/.+\/node_modules\//g, "<dep>/");
  return "Internal error";
}

export const logger = {
  info(context: string, message: string, data?: Record<string, unknown>): void {
    if (isProd) {
      console.log(JSON.stringify({ level: "info", context, message, ...data, ts: new Date().toISOString() }));
    } else {
      console.log(`[${context}] ${message}`, data ?? "");
    }
  },

  warn(context: string, message: string, data?: Record<string, unknown>): void {
    if (isProd) {
      console.warn(JSON.stringify({ level: "warn", context, message, ...data, ts: new Date().toISOString() }));
    } else {
      console.warn(`[${context}] ${message}`, data ?? "");
    }
  },

  error(context: string, message: string, error?: unknown): void {
    if (isProd) {
      console.error(JSON.stringify({ level: "error", context, message, error: safeMessage(error), ts: new Date().toISOString() }));
    } else {
      console.error(`[${context}] ${message}`, error ?? "");
    }
  },
};
