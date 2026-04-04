"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useCsrfFetch } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import type { FontFamily, ReadingTheme, RegistrationPolicy } from "@/types";

// ─── Constants shared with the regular settings page ─────────────────────────

const FONT_SIZE_OPTIONS = [14, 16, 18, 20, 24, 28, 32];
const LINE_SPACING_OPTIONS = [1.5, 1.8, 2.0, 2.5];
const THEMES: { value: ReadingTheme; icon: string; label: string }[] = [
  { value: "flashlight", icon: "🔦", label: "Flashlight" },
  { value: "magnifier", icon: "🔍", label: "Magnifier" },
  { value: "magic-wand", icon: "✨", label: "Magic Wand" },
];
const FONT_FAMILY_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: "opendyslexic", label: "OpenDyslexic" },
  { value: "system", label: "System" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type GlobalDefaults = Pick<
  {
    fontFamily: FontFamily;
    fontSize: number;
    lineSpacing: number;
    maskOpacity: number;
    ttsSpeed: number;
    ttsPitch: number;
    theme: ReadingTheme;
  },
  "fontFamily" | "fontSize" | "lineSpacing" | "maskOpacity" | "ttsSpeed" | "ttsPitch" | "theme"
>;

const DEFAULT_GLOBAL_DEFAULTS: GlobalDefaults = {
  fontFamily: "opendyslexic",
  fontSize: 20,
  lineSpacing: 1.8,
  maskOpacity: 0.7,
  ttsSpeed: 0.8,
  ttsPitch: 1.05,
  theme: "flashlight",
};

type SmtpSettings = {
  host: string;
  port: string;
  user: string;
  hasPass: boolean;
  from: string;
};

// ─── Helper normalizers ───────────────────────────────────────────────────────

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
function normalizeFontFamily(value: unknown): FontFamily {
  return value === "system" ? "system" : "opendyslexic";
}
function normalizeTheme(value: unknown): ReadingTheme {
  if (value === "magnifier" || value === "magic-wand") return value;
  return "flashlight";
}
function normalizeGlobalDefaults(raw?: Partial<GlobalDefaults> | null): GlobalDefaults {
  return {
    fontFamily: normalizeFontFamily(raw?.fontFamily),
    fontSize: clampNumber(raw?.fontSize, DEFAULT_GLOBAL_DEFAULTS.fontSize, 14, 32),
    lineSpacing: clampNumber(raw?.lineSpacing, DEFAULT_GLOBAL_DEFAULTS.lineSpacing, 1.5, 2.5),
    maskOpacity: clampNumber(raw?.maskOpacity, DEFAULT_GLOBAL_DEFAULTS.maskOpacity, 0, 0.9),
    ttsSpeed: clampNumber(raw?.ttsSpeed, DEFAULT_GLOBAL_DEFAULTS.ttsSpeed, 0.5, 2),
    ttsPitch: clampNumber(raw?.ttsPitch, DEFAULT_GLOBAL_DEFAULTS.ttsPitch, 0.5, 2),
    theme: normalizeTheme(raw?.theme),
  };
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-2 border-gray-100 bg-white p-5">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

// ─── Global Defaults section ──────────────────────────────────────────────────

function GlobalDefaultsSection() {
  const csrfFetch = useCsrfFetch();
  const [settings, setSettings] = useState<GlobalDefaults | null>(null);
  const [registrationPolicy, setRegistrationPolicy] = useState<RegistrationPolicy>("invite-only");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/settings");
        if (!res.ok) throw new Error("Failed to load admin settings");
        const data = await res.json();
        if (!cancelled) {
          setSettings(normalizeGlobalDefaults(data.settings));
          setRegistrationPolicy(data.registrationPolicy === "open" ? "open" : "invite-only");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load admin settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const updateGlobalSetting = useCallback(
    async <K extends keyof GlobalDefaults>(key: K, value: GlobalDefaults[K]) => {
      if (!settings) return;
      const prev = settings;
      const next = normalizeGlobalDefaults({ ...settings, [key]: value });
      setSettings(next);
      setSaving(true);
      setError(null);
      try {
        const res = await csrfFetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: value }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Failed to save");
        }
        const d = await res.json();
        setSettings(normalizeGlobalDefaults(d.settings));
        setRegistrationPolicy(d.registrationPolicy === "open" ? "open" : "invite-only");
      } catch (e) {
        setSettings(prev);
        setError(e instanceof Error ? e.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [csrfFetch, settings]
  );

  const updateRegistrationPolicy = useCallback(
    async (nextPolicy: RegistrationPolicy) => {
      if (nextPolicy === registrationPolicy) return;
      const label = nextPolicy === "open" ? "Open Registration" : "Invite Only";
      if (!window.confirm(`Switch registration policy to ${label}?`)) return;
      setSaving(true);
      setError(null);
      try {
        const res = await csrfFetch("/api/admin/registration-policy", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ policy: nextPolicy }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Failed to update policy");
        }
        const d = await res.json();
        setRegistrationPolicy(d.policy === "open" ? "open" : "invite-only");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update policy");
      } finally {
        setSaving(false);
      }
    },
    [csrfFetch, registrationPolicy]
  );

  if (loading || !settings) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-gray-600">
        These defaults apply to guests and new users. Existing personal overrides are preserved.
      </p>

      <div>
        <label className="mb-2 block text-sm font-medium">Default Font Family</label>
        <div className="flex gap-2 flex-wrap">
          {FONT_FAMILY_OPTIONS.map((opt) => (
            <button key={opt.value}
              className={`btn-kid rounded-xl px-4 py-2 text-sm ${settings.fontFamily === opt.value ? "border-2 border-amber-300 bg-amber-100 text-amber-800" : "border-2 border-gray-200 bg-gray-50 text-gray-600"}`}
              onClick={() => void updateGlobalSetting("fontFamily", opt.value)}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Default Font Size</label>
        <div className="flex gap-2 flex-wrap">
          {FONT_SIZE_OPTIONS.map((size) => (
            <button key={size}
              className={`btn-kid rounded-xl px-3 py-2 text-sm ${settings.fontSize === size ? "border-2 border-amber-300 bg-amber-100 text-amber-800" : "border-2 border-gray-200 bg-gray-50 text-gray-600"}`}
              onClick={() => void updateGlobalSetting("fontSize", size)}
            >{size}px</button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Default Line Spacing</label>
        <div className="flex gap-2 flex-wrap">
          {LINE_SPACING_OPTIONS.map((spacing) => (
            <button key={spacing}
              className={`btn-kid rounded-xl px-4 py-2 text-sm ${settings.lineSpacing === spacing ? "border-2 border-amber-300 bg-amber-100 text-amber-800" : "border-2 border-gray-200 bg-gray-50 text-gray-600"}`}
              onClick={() => void updateGlobalSetting("lineSpacing", spacing)}
            >{spacing.toFixed(1)}x</button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Default Mask Opacity: {Math.round(settings.maskOpacity * 100)}%
        </label>
        <input type="range" min={0} max={0.9} step={0.1} value={settings.maskOpacity}
          onChange={(e) => void updateGlobalSetting("maskOpacity", Number(e.target.value))}
          className="w-full max-w-xs" aria-label="Default Mask Opacity" />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Default TTS Speed: {settings.ttsSpeed.toFixed(1)}x
        </label>
        <input type="range" min={0.5} max={2} step={0.1} value={settings.ttsSpeed}
          onChange={(e) => void updateGlobalSetting("ttsSpeed", Number(e.target.value))}
          className="w-full max-w-xs" aria-label="Default TTS Speed" />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Default TTS Pitch: {settings.ttsPitch.toFixed(2)}
        </label>
        <input type="range" min={0.5} max={2} step={0.05} value={settings.ttsPitch}
          onChange={(e) => void updateGlobalSetting("ttsPitch", Number(e.target.value))}
          className="w-full max-w-xs" aria-label="Default TTS Pitch" />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Default Reading Theme</label>
        <div className="flex gap-2 flex-wrap">
          {THEMES.map((theme) => (
            <button key={theme.value}
              className={`btn-kid rounded-xl px-4 py-3 text-sm ${settings.theme === theme.value ? "border-2 border-amber-300 bg-amber-100 text-amber-800" : "border-2 border-gray-200 bg-gray-50 text-gray-600"}`}
              onClick={() => void updateGlobalSetting("theme", theme.value)}
            >{theme.icon} {theme.label}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Registration Policy</label>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: "invite-only" as RegistrationPolicy, label: "Invite Only" },
            { value: "open" as RegistrationPolicy, label: "Open Registration" },
          ].map((opt) => (
            <button key={opt.value}
              className={`btn-kid rounded-xl px-4 py-2 text-sm ${registrationPolicy === opt.value ? "border-2 border-amber-300 bg-amber-100 text-amber-800" : "border-2 border-gray-200 bg-gray-50 text-gray-600"}`}
              onClick={() => void updateRegistrationPolicy(opt.value)}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      {saving && <p className="text-xs text-amber-700">Saving...</p>}
      {error && <p className="text-sm text-orange-600">{error}</p>}
    </div>
  );
}

// ─── SMTP Settings section ────────────────────────────────────────────────────

function SmtpSettingsSection() {
  const csrfFetch = useCsrfFetch();
  const [form, setForm] = useState<SmtpSettings>({ host: "", port: "587", user: "", hasPass: false, from: "" });
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/smtp");
        if (!res.ok) throw new Error("Failed to load SMTP settings");
        const data = await res.json();
        if (!cancelled) {
          setForm({
            host: data.host ?? "",
            port: data.port ?? "587",
            user: data.user ?? "",
            hasPass: data.hasPass ?? false,
            from: data.from ?? "",
          });
        }
      } catch {
        // ignore — form stays empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const body: Record<string, string> = {
        host: form.host,
        port: form.port,
        user: form.user,
        from: form.from,
      };
      if (pass) body.pass = pass;

      const res = await csrfFetch("/api/admin/smtp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save SMTP settings");
      }
      const data = await res.json();
      setForm({ host: data.host ?? "", port: data.port ?? "587", user: data.user ?? "", hasPass: data.hasPass ?? false, from: data.from ?? "" });
      setPass("");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      setTestResult({ ok: false, msg: "Enter a recipient email address first." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await csrfFetch("/api/admin/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestResult({ ok: false, msg: d.error || "Failed to send test email" });
      } else {
        setTestResult({ ok: true, msg: `Test email sent to ${testEmail}. Check your inbox.` });
      }
    } catch (err) {
      setTestResult({ ok: false, msg: err instanceof Error ? err.message : "Failed to send" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Configure outgoing mail for access-request notifications.
        SMTP username and password are stored encrypted in the database.
        <br /><br />
        <strong>Note:</strong> If you use Gmail SMTP, Google always delivers the message
        from the authenticated Gmail account. Set <em>From (display)</em> to e.g.{" "}
        <code className="bg-gray-100 px-1 rounded">ReadingStar &lt;your-address@gmail.com&gt;</code>.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">SMTP Host</label>
          <input
            type="text"
            className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm"
            placeholder="smtp.gmail.com"
            value={form.host}
            onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Port</label>
          <input
            type="number"
            className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm"
            placeholder="587"
            min={1} max={65535}
            value={form.port}
            onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">SMTP Username</label>
        <input
          type="text"
          autoComplete="off"
          className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm"
          placeholder="your-email@gmail.com"
          value={form.user}
          onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          SMTP Password{form.hasPass ? " (stored — leave blank to keep)" : ""}
        </label>
        <input
          type="password"
          autoComplete="new-password"
          className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm"
          placeholder={form.hasPass ? "••••••••  (unchanged)" : "Enter password"}
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">From (display)</label>
        <input
          type="text"
          className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm"
          placeholder='ReadingStar <noreply@example.com>'
          value={form.from}
          onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
        />
        <p className="mt-1 text-xs text-gray-400">
          Format: DisplayName &lt;address&gt; — Gmail always uses your authenticated address.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving…" : "Save SMTP Settings"}
        </Button>
        {saveSuccess && <span className="text-sm text-green-600">✓ Saved</span>}
        {saveError && <span className="text-sm text-orange-600">{saveError}</span>}
      </div>

      {/* Test email */}
      <div className="mt-2 border-t border-gray-100 pt-4">
        <h3 className="mb-2 text-sm font-semibold">Send Test Email</h3>
        <div className="flex gap-2 flex-wrap items-start">
          <input
            type="email"
            className="flex-1 min-w-48 rounded-lg border-2 border-gray-200 px-3 py-2 text-sm"
            placeholder="recipient@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={testing}
            onClick={() => void handleTest()}
          >
            {testing ? "Sending…" : "📨 Send Test"}
          </Button>
        </div>
        {testResult && (
          <p className={`mt-2 text-sm ${testResult.ok ? "text-green-600" : "text-orange-600"}`}>
            {testResult.ok ? "✓ " : "✗ "}{testResult.msg}
          </p>
        )}
      </div>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const router = useRouter();
  const { isAdmin, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace("/library");
    }
  }, [isAdmin, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-4xl animate-bounce">🦉</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-warm-orange)" }}>
          🛡️ Admin Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500">Visible to admins only.</p>
      </div>

      <SettingsSection title="🌐 App Default Settings">
        <GlobalDefaultsSection />
      </SettingsSection>

      <SettingsSection title="📧 SMTP Email Settings">
        <SmtpSettingsSection />
      </SettingsSection>
    </div>
  );
}
