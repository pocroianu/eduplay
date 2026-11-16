import type { NextConfig } from "next";
import path from "node:path";

// EU region pinning: all serverless functions deploy to fra1 (Frankfurt).
// See PRIVACY.md §2 and vercel.json "regions". Do not add non-EU preferredRegion exports.
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  reactCompiler: true,
  experimental: {
    serverActions: {
      // Two artifact-recording Server Actions need a body limit well above
      // the Next.js 1MB default:
      //   - `recordGameArtifact` / drawing-kind `recordChildArtifact` send a
      //     base64 PNG dataURL. `MAX_SCREENSHOT_BYTES` caps the decoded
      //     binary at 5MB; base64 + dataURL prefix lands around ~6.7MB.
      //   - audio-kind `recordChildArtifact` sends a `Uint8Array` blob. The
      //     `MAX_AUDIO_BYTES` cap is 10MB and Server Actions serialize
      //     binary roughly 1:1, so the wire payload is ~10MB.
      // 12MB gives the audio ceiling comfortable headroom for action
      // arguments + framing without admitting payloads the schema would
      // reject. Keep this in sync with `MAX_AUDIO_BYTES` and
      // `MAX_SCREENSHOT_BYTES` if either cap moves.
      bodySizeLimit: '12mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'http', hostname: 'localhost', port: '54421' },
      { protocol: 'http', hostname: '127.0.0.1', port: '54421' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

export default nextConfig;
