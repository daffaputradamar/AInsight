/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Required for Docker deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: process.cwd(),
  },
  webpack: (config, { isServer }) => {
    // Ensure backend folder is excluded from Next.js compilation
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/backend/**'],
    }
    return config
  },
}

export default nextConfig
