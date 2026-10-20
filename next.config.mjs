// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite gerar a pasta 'out/' 100% estática caso queira embutir os ficheiros dentro do .pkg
  output: process.env.BUILD_PKG === 'true' ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;