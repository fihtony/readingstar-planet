import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: [
              "microphone=(self)",
              "browsing-topics=()",
              "join-ad-interest-group=()",
              "run-ad-auction=()",
            ].join(", "),
          },
        ],
      },
    ];
  },
  images: {
    localPatterns: [
      {
        pathname: "/images/**",
      },
    ],
  },
  serverExternalPackages: ["better-sqlite3", "pdfjs-dist"],
};

export default withNextIntl(nextConfig);
