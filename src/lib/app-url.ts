import type { NextRequest } from "next/server";

function getFirstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function getConfiguredOrigin() {
  const configuredUrl =
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.GOOGLE_REDIRECT_URI ??
    "";

  if (!configuredUrl) {
    return null;
  }

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return null;
  }
}

export function getAppOrigin(request: NextRequest) {
  const configuredOrigin = getConfiguredOrigin();
  if (configuredOrigin) {
    return configuredOrigin;
  }

  const forwardedHost = getFirstHeaderValue(request.headers.get("x-forwarded-host"));
  if (forwardedHost) {
    const forwardedProto =
      getFirstHeaderValue(request.headers.get("x-forwarded-proto")) ??
      (request.nextUrl.protocol.replace(":", "") || "https");

    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = getFirstHeaderValue(request.headers.get("host"));
  if (host) {
    const protocol = request.nextUrl.protocol.replace(":", "") || "http";
    return `${protocol}://${host}`;
  }

  return request.nextUrl.origin;
}

export function getAppUrl(request: NextRequest, pathname: string) {
  return new URL(pathname, `${getAppOrigin(request)}/`);
}