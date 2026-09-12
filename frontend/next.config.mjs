/** @type {import('next').NextConfig} */
const backend = process.env.NEBULA_BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig = {
  reactStrictMode: true,
  // The custom dev/prod server (server.js) proxies /api and /ws to the backend,
  // so these rewrites only matter when running `next dev`/`next start` directly.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
    ];
  },
  eslint: { ignoreDuringBuilds: true },
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

export default nextConfig;
