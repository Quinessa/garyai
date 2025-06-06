/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // If 'lucide-react' is in this list, remove it or comment it out.
    // If this optimizePackageImports array only contained 'lucide-react',
    // you can make it an empty array [] or remove the optimizePackageImports key.
    optimizePackageImports: [
      // 'lucide-react', // <--- REMOVE OR COMMENT THIS LINE
      // '@radix-ui/react-icons', // Keep other packages if they exist
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // ... any other configurations you have
};

export default nextConfig;
