import type { NextConfig } from "next";

// macOS writes "._*" files next to everything on exFAT drives, which corrupts Turbopack's disk cache.
const onExternalDrive = process.cwd().startsWith("/Volumes/");

const nextConfig: NextConfig = {
  experimental: {
    turbopackFileSystemCacheForDev: !onExternalDrive,
    turbopackFileSystemCacheForBuild: !onExternalDrive,
  },
};

export default nextConfig;
