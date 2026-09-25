import type { NextConfig } from "next";
const nextConfig: NextConfig = { output: "standalone", outputFileTracingExcludes: { "/*": [".rendercv-venv/**/*"] } };
export default nextConfig;
