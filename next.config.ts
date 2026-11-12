import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The AU calculator moved from its prototype URL to "/". Query strings
    // (shared scenario links) are carried over by Next automatically.
    return [{ source: "/prototype/au", destination: "/", permanent: true }];
  },
};

export default nextConfig;
