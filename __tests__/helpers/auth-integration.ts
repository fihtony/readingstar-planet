import Database from "better-sqlite3";
import { initializeSchema } from "@/lib/schema";

type CookieSnapshot = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

type CookieStoreMock = {
  get: (name: string) => { name: string; value: string } | undefined;
  set: (name: string, value: string, options?: Record<string, unknown>) => void;
  delete: (name: string) => void;
  entries: () => Array<[string, string]>;
  getLastSet: () => CookieSnapshot | null;
};

export function createCookieStore(
  initialValues: Record<string, string> = {}
): CookieStoreMock {
  const values = new Map(Object.entries(initialValues));
  let lastSet: CookieSnapshot | null = null;

  return {
    get(name) {
      const value = values.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set(name, value, options) {
      values.set(name, value);
      lastSet = { name, value, options };
    },
    delete(name) {
      values.delete(name);
    },
    entries() {
      return Array.from(values.entries());
    },
    getLastSet() {
      return lastSet;
    },
  };
}

export function createTestDatabase() {
  const testDb = new Database(":memory:");
  testDb.pragma("journal_mode = WAL");
  testDb.pragma("foreign_keys = ON");
  initializeSchema(testDb);
  return testDb;
}

export async function loadIntegrationModules<T>(
  testDb: Database.Database,
  cookieStore: CookieStoreMock,
  load: () => Promise<T>
) {
  const { vi } = await import("vitest");

  vi.resetModules();
  vi.doMock("@/lib/db", () => ({ getDatabase: () => testDb }));
  vi.doMock("next/headers", () => ({
    cookies: async () => cookieStore,
  }));

  return load();
}