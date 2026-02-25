import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function originFromUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) {
    return null;
  }

  try {
    return new URL(rawUrl).origin;
  } catch {
    return null;
  }
}

function websocketOriginFromHttpOrigin(httpOrigin: string): string {
  if (httpOrigin.startsWith("https://")) {
    return `wss://${httpOrigin.slice("https://".length)}`;
  }

  if (httpOrigin.startsWith("http://")) {
    return `ws://${httpOrigin.slice("http://".length)}`;
  }

  return httpOrigin;
}

function buildContentSecurityPolicy(): string {
  const supabaseOrigin = originFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const clerkSources = [
    "https://*.clerk.accounts.dev",
    "https://*.clerk.dev",
    "https://*.clerk.services",
    "https://api.clerk.com",
  ];
  const turnstileSources = [
    "https://challenges.cloudflare.com",
  ];
  const scriptSources = [...clerkSources, ...turnstileSources];
  const frameSources = [...clerkSources, ...turnstileSources];
  const scriptSourceBase = process.env.NODE_ENV === "production"
    ? ["'self'", "'unsafe-inline'"]
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'"];
  const scriptSource = [...scriptSourceBase, ...scriptSources].join(" ");

  const connectSources = new Set(["'self'"]);
  for (const clerkSource of clerkSources) {
    connectSources.add(clerkSource);
  }
  for (const turnstileSource of turnstileSources) {
    connectSources.add(turnstileSource);
  }
  if (supabaseOrigin) {
    connectSources.add(supabaseOrigin);
    connectSources.add(websocketOriginFromHttpOrigin(supabaseOrigin));
  } else {
    connectSources.add("https://*.supabase.co");
    connectSources.add("wss://*.supabase.co");
  }

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSource}`,
    `script-src-elem ${scriptSource}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `frame-src 'self' ${frameSources.join(" ")}`,
    `connect-src ${Array.from(connectSources).join(" ")}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ];
  if (process.env.NODE_ENV === "production") {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: buildContentSecurityPolicy() },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
] as const;

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [...SECURITY_HEADERS],
      },
    ];
  },
};

export default nextConfig;
