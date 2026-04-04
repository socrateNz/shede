/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Configuration Webpack pour la production (Vercel)
  webpack: (config, { isServer }) => {
    // Alias pour fflate (version navigateur)
    config.resolve.alias = {
      ...config.resolve.alias,
      fflate: 'fflate/browser',
    };

    // Ignorer les modules natifs côté serveur
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
        fs: false,
        path: false,
        http: false,
        https: false,
        zlib: false,
        stream: false,
        crypto: false,
        buffer: false,
        url: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }

    // Empêcher le bundle de modules problématiques
    config.externals = [
      ...(config.externals || []),
      'canvas',
      'fs',
      'path',
    ];

    return config;
  },

  // Configuration Turbopack pour le développement local
  turbopack: {
    resolveAlias: {
      fflate: 'fflate/browser',
    },
  },

  // Exclure les packages du bundle serveur
  serverExternalPackages: ['jspdf', 'jspdf-autotable', 'fflate', 'canvas'],

  output: 'standalone',
};

export default nextConfig;