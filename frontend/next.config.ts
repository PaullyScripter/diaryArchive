import type { NextConfig } from "next";
import MonacoWebpackPlugin from "monaco-editor-webpack-plugin";

// The API/media origins the browser talks to. When the API lives on its own
// origin (NEXT_PUBLIC_API_URL set to an absolute URL), CSP must allow it as an
// image/connect source or the app breaks under a strict policy.
function apiOrigins(): string[] {
  const urls = [
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
  ].filter(Boolean) as string[];
  const origins = new Set<string>();
  for (const url of urls) {
    if (!/^https?:\/\//i.test(url)) continue;
    try {
      origins.add(new URL(url).origin);
    } catch {
      // ignore malformed configured URL
    }
  }
  return [...origins];
}

function buildContentSecurityPolicy(): string {
  const extra = apiOrigins();
  const imgSrc = ["'self'", "data:", "blob:", ...extra].join(" ");
  const connectSrc = ["'self'", ...extra].join(" ");
  // Next.js injects inline scripts/styles for hydration; 'unsafe-inline' is
  // kept for style and (guarded by Next) script, consistent with the nginx edge
  // CSP. External resource loads remain blocked.
  // 'unsafe-eval' is required only in development, where Next.js dev mode uses
  // eval-based source maps and hot-module-reload. Production builds do not emit
  // eval, so it stays locked down there. This keeps local testing functional
  // without weakening the production security policy.
  const scriptSrc =
    process.env.NODE_ENV === "development"
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    `connect-src ${connectSrc}`,
    // Monaco language-service web workers are created as blob: URLs by
    // webpack's `?worker` loader; allow them under the strict self-only policy.
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "font-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        // Apply security headers to every response the frontend serves. These
        // mirror the nginx edge so headers are present even without nginx and
        // remain consistent when both are in play.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: buildContentSecurityPolicy() },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Bundle Monaco's editor + language-service workers locally (no CDN) so
      // the professional HTML/CSS editor stays privacy-first and offline-capable.
      config.plugins.push(
        new MonacoWebpackPlugin({
          languages: ["html", "css"],
          features: [
            "bracketMatching",
            "bracketPairColorization",
            "caretOperations",
            "clipboard",
            "codeAction",
            "codelens",
            "colorPicker",
            "comment",
            "contextmenu",
            "coreCommands",
            "cursorUndo",
            "find",
            "folding",
            "fontZoom",
            "format",
            "gotoError",
            "gotoLine",
            "hover",
            "inPlaceReplace",
            "indentation",
            "inlineCompletions",
            "inlineSuggestions",
            "linesOperations",
            "links",
            "multicursor",
            "parameterHints",
            "quickCommand",
            "quickHelp",
            "quickOutline",
            "referenceSearch",
            "rename",
            "smartSelect",
            "snippet",
            "suggest",
            "toggleHighContrast",
            "toggleTabFocusMode",
            "transpose",
            "wordHighlighter",
            "wordOperations",
            "wordPartOperations",
          ],
        }),
      );
    }
    return config;
  },
};

export default nextConfig;