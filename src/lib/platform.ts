/**
 * Client-side platform detection helpers.
 * Always returns false on the server (SSR / build-time).
 */

/**
 * Returns true when the browser is running on Windows.
 *
 * Uses the modern NavigatorUAData API when available, with a fallback to
 * the legacy navigator.platform string.  The result is determined at call
 * time, not persisted, so it is safe to use in React render functions and
 * effects inside "use client" components.
 */
export function isWindowsBrowser(): boolean {
  if (typeof navigator === "undefined") return false;

  // Modern User-Agent Client Hints API (Chrome 90+, Edge 90+)
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData;
  if (uaData?.platform) {
    return uaData.platform === "Windows";
  }

  // Legacy fallback – navigator.platform is deprecated but widely supported.
  return /Win/i.test(navigator.platform ?? "");
}
