import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

/** Pin workspace root when multiple lockfiles exist above this repo (local + CI). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
