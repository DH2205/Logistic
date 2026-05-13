import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        // Prevent page being embedded in iframes (clickjacking)
        { key: "X-Frame-Options", value: "DENY" },
        // Stop browser guessing content types (MIME sniffing)
        { key: "X-Content-Type-Options", value: "nosniff" },
        // Limit referrer info sent on navigation
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // Disable browser features not needed by this app
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        // Force HTTPS — prevents MitM downgrade attacks (active after deployment)
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        // Restrict which sources can run scripts — core XSS browser defense
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "connect-src 'self' https://*.supabase.co https://onlinetools.ups.com",
            "font-src 'self'",
            "frame-ancestors 'none'",
          ].join("; "),
        },
      ],
    },
  ],
};

export default nextConfig;
