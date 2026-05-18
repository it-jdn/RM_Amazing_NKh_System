import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: "/intake",
        destination: "/receiving",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
