import type { NextConfig } from "next";

/* STATIC_EXPORT=1 builds plain files for GitHub Pages (see .github/workflows/pages.yml and scripts/prepare-static.mjs).
   Without it, the site runs as usual: password gate, forms, nightly refresh, and the zine editor saving locally. */
const staticExport = process.env.STATIC_EXPORT === "1";
const nextConfig: NextConfig = staticExport
  ? { reactStrictMode: true, output: "export", trailingSlash: true, images: { unoptimized: true }, distDir: ".next-static", basePath: process.env.BASE_PATH || undefined }
  : { reactStrictMode: true };
export default nextConfig;
