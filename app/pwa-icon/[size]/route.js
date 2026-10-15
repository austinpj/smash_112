import { ImageResponse } from "next/og";

// Draws the Smash app icon (lime-to-aqua square with a lightning bolt) at any size.
export async function GET(request, { params }) {
  const { size: raw } = await params;
  const size = Math.min(1024, Math.max(16, parseInt(raw, 10) || 512));
  const bolt = Math.round(size * 0.56);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(135deg, #c6ff3d 0%, #2ef2c4 100%)",
        }}
      >
        <svg width={bolt} height={bolt} viewBox="0 0 24 24">
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="#07080c" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=31536000, immutable" } }
  );
}
