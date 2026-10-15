import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LAN devices and ngrok tunnels to use dev resources (HMR websocket)
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*", "*.ngrok-free.dev", "*.ngrok-free.app", "*.ngrok.app"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
