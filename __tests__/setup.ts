import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import enMessages from "@/messages/en.json";

function getMessageValue(path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (value && typeof value === "object" && key in value) {
      return (value as Record<string, unknown>)[key];
    }

    return undefined;
  }, enMessages as unknown);
}

function formatMessage(
  template: string,
  values?: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const replacement = values?.[key];
    return replacement === undefined ? `{${key}}` : String(replacement);
  });
}

vi.mock("next-intl", () => ({
  NextIntlClientProvider: ({ children }: { children: unknown }) => children,
  useLocale: () => "en",
  useTranslations: (namespace?: string) => {
    return (key: string, values?: Record<string, string | number>) => {
      const messageKey = namespace ? `${namespace}.${key}` : key;
      const message = getMessageValue(messageKey);

      if (typeof message === "string") {
        return formatMessage(message, values);
      }

      return key;
    };
  },
}));

// Auto cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Web Speech API
const mockSpeechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn(() => []),
  speaking: false,
  paused: false,
  pending: false,
  onvoiceschanged: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(() => true),
};

vi.stubGlobal("speechSynthesis", mockSpeechSynthesis);
class MockSpeechSynthesisUtterance {
  text: string;
  lang: string = "en-US";
  rate: number = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onboundary: (() => void) | null = null;
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  constructor(text?: string) {
    this.text = text ?? "";
  }
}
vi.stubGlobal("SpeechSynthesisUtterance", MockSpeechSynthesisUtterance);

// Mock IntersectionObserver
vi.stubGlobal(
  "IntersectionObserver",
  vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
);
