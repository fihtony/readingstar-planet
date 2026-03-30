import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";

let testDb: InstanceType<typeof Database>;

vi.mock("@/lib/db", () => ({
  getDatabase: () => testDb,
}));

import { initializeSchema } from "@/lib/schema";
import {
  getOrCreateUserSettings,
  updateUserSettings,
} from "@/lib/repositories/settings-repository";

describe("settings-repository", () => {
  beforeEach(() => {
    testDb = new Database(":memory:");
    testDb.pragma("journal_mode = WAL");
    testDb.pragma("foreign_keys = ON");
    initializeSchema(testDb);
  });

  afterEach(() => {
    testDb.close();
  });

  it("creates default settings when none exist", () => {
    const settings = getOrCreateUserSettings("default-user");

    expect(settings.fontFamily).toBe("opendyslexic");
    expect(settings.fontSize).toBe(20);
    expect(settings.lineSpacing).toBe(1.8);
    expect(settings.maskOpacity).toBe(0.7);
    expect(settings.ttsSpeed).toBe(0.8);
    expect(settings.theme).toBe("flashlight");
  });

  it("updates and persists settings", () => {
    const updated = updateUserSettings("default-user", {
      fontFamily: "system",
      fontSize: 28,
      lineSpacing: 2,
      maskOpacity: 0.4,
      ttsSpeed: 1.2,
      theme: "magnifier",
    });

    const fetched = getOrCreateUserSettings("default-user");
    expect(updated.fontFamily).toBe("system");
    expect(fetched.fontSize).toBe(28);
    expect(fetched.lineSpacing).toBe(2);
    expect(fetched.maskOpacity).toBe(0.4);
    expect(fetched.ttsSpeed).toBe(1.2);
    expect(fetched.theme).toBe("magnifier");
  });
});