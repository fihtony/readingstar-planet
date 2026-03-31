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

    // Seed user for FK constraint
    testDb
      .prepare(
        `INSERT INTO users (id, email, nickname, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`
      )
      .run("default-user", "default@example.com", "Default", "user");
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

  it("inherits admin-configured global defaults when creating settings for a new user (TP-SET-01)", () => {
    // Change global defaults to non-standard values
    testDb
      .prepare(
        `UPDATE app_metadata SET value = ? WHERE key = ?`
      )
      .run("system", "default_font_family");
    testDb.prepare(`UPDATE app_metadata SET value = ? WHERE key = ?`).run("24", "default_font_size");
    testDb.prepare(`UPDATE app_metadata SET value = ? WHERE key = ?`).run("2.2", "default_line_spacing");
    testDb.prepare(`UPDATE app_metadata SET value = ? WHERE key = ?`).run("0.5", "default_mask_opacity");
    testDb.prepare(`UPDATE app_metadata SET value = ? WHERE key = ?`).run("1.2", "default_tts_speed");
    testDb.prepare(`UPDATE app_metadata SET value = ? WHERE key = ?`).run("magnifier", "default_theme");

    // Seed a new user
    testDb
      .prepare(
        `INSERT INTO users (id, email, nickname, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`
      )
      .run("new-user", "new@example.com", "New", "user");

    const settings = getOrCreateUserSettings("new-user");

    expect(settings.fontFamily).toBe("system");
    expect(settings.fontSize).toBe(24);
    expect(settings.lineSpacing).toBe(2.2);
    expect(settings.maskOpacity).toBe(0.5);
    expect(settings.ttsSpeed).toBe(1.2);
    expect(settings.theme).toBe("magnifier");
  });
});