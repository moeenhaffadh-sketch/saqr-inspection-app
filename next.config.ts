import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow local network access for mobile testing
  allowedDevOrigins: [
    "http://192.168.100.123:3000",
    "http://localhost:3000",
  ],
  // Increase body size limit for video uploads
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
