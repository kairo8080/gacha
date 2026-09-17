import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingExcludes: {
    "/*": ["./.local/**/*", "./.env*"],
  },
};

export default nextConfig;
