/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  distDir: 'out',
  // In dev, proxy API requests to backend (docker-compose or local)
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    return [
      { source: '/api/:path*', destination: `${api}/api/:path*` },
      { source: '/hls/:path*', destination: `${api}/hls/:path*` },
      { source: '/thumbnails/:path*', destination: `${api}/thumbnails/:path*` },
      { source: '/ws:path*', destination: `${api}/ws:path*` },
    ];
  },
};

module.exports = nextConfig;
