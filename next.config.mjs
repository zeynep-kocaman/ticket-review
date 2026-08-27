/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ticket text can contain PII. Never cache review pages at the edge.
  headers: async () => [
    {
      source: "/review/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store, max-age=0" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "Referrer-Policy", value: "no-referrer" },
      ],
    },
  ],
};

export default nextConfig;
