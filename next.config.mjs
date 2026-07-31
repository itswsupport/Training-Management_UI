/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure for /etms subdirectory deployment (payroll deploys under /payroll).
  basePath: "/etms",
  assetPrefix: "/etms",

  // basePath is inlined at build time, so it has to be mirrored here for the
  // client-side code that builds URLs by hand (post-login hard redirect).
  env: {
    NEXT_PUBLIC_BASE_PATH: "/etms",
  },

  experimental: {
    // Lecture videos reach the backend through the rewrite below, and Next
    // buffers a proxied body in memory with a 10MB default ceiling. Past that
    // it truncates rather than failing — the backend then gets a half-written
    // multipart body and answers 500, so uploading any real training video
    // died with no usable message. Matched to the backend's own
    // spring.servlet.multipart.max-request-size (1024MB) so there is no band
    // where Spring would accept an upload that this silently cut in half.
    proxyClientMaxBodySize: "1gb",
  },

  // Proxy API requests to the Spring backend (avoids CORS in development).
  // Services call `/api/...`, which is rewritten to the trainingmodule backend.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${
          process.env.ETMS_BACKEND_ORIGIN || "http://localhost:8096/trainingmodule"
        }/:path*`,
      },
    ];
  },

  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  compress: true,
  reactStrictMode: true,
  // Enable standalone output for Docker
  output: "standalone",
};

export default nextConfig;
