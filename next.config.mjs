/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Permite o src/instrumentation.ts (scheduler in-process) rodar no boot do servidor.
    instrumentationHook: true,
    // Não empacotar libs Node-only; deixá-las como require nativo no servidor.
    serverComponentsExternalPackages: ["google-auth-library", "stripe"],
  },
};

export default nextConfig;
