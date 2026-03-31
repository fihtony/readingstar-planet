const READ_COUNT_PREFIX = "document-read-counted-at:";

export const SHORT_ARTICLE_MAX_RECOMMENDED_MINUTES = 3;
export const MIN_READ_COUNT_COOLDOWN_MS = 30 * 60 * 1000;
export const MAX_READ_COUNT_COOLDOWN_MS = 60 * 60 * 1000;
const WORDS_PER_MINUTE = 200;

function getStorageKey(documentId: string): string {
  return `${READ_COUNT_PREFIX}${documentId}`;
}

export function getWordCount(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function getRecommendedReadMinutes(content: string): number {
  return Math.max(1, Math.round(getWordCount(content) / WORDS_PER_MINUTE));
}

export function getReadCountCooldownMs(recommendedReadMinutes: number): number {
  return recommendedReadMinutes <= SHORT_ARTICLE_MAX_RECOMMENDED_MINUTES
    ? MIN_READ_COUNT_COOLDOWN_MS
    : MAX_READ_COUNT_COOLDOWN_MS;
}

export function getReadCountCooldownMsForContent(content: string): number {
  return getReadCountCooldownMs(getRecommendedReadMinutes(content));
}

export function getLastReadCountAt(documentId: string): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(getStorageKey(documentId));
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function markReadCounted(documentId: string, timestamp = Date.now()): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getStorageKey(documentId), String(timestamp));
}

export function shouldCountReadOnRefresh(
  documentId: string,
  cooldownMs: number,
  now = Date.now()
): boolean {
  const lastReadAt = getLastReadCountAt(documentId);
  if (lastReadAt === null) {
    return false;
  }

  return now - lastReadAt >= cooldownMs;
}