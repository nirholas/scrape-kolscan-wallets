import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a0a 0%, #111111 50%, #0a0a0a 100%)",
          position: "relative",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Accent glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            right: "15%",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "rgba(99, 102, 241, 0.12)",
            filter: "blur(80px)",
            transform: "translateY(-50%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            left: "20%",
            width: "300px",
            height: "200px",
            borderRadius: "50%",
            background: "rgba(34, 197, 94, 0.06)",
            filter: "blur(60px)",
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "black",
              fontWeight: 800,
              fontSize: "32px",
            }}
          >
            K
          </div>
          <span
            style={{
              fontSize: "48px",
              fontWeight: 700,
              color: "white",
              letterSpacing: "-1px",
            }}
          >
            Kol
            <span style={{ color: "#818cf8" }}>Quest</span>
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "28px",
            fontWeight: 600,
            color: "white",
            marginBottom: "16px",
          }}
        >
          Smart Wallet Intelligence
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: "18px",
            color: "#a1a1aa",
            textAlign: "center",
            maxWidth: "600px",
            lineHeight: 1.5,
          }}
        >
          Track the smartest crypto wallets — KolScan KOLs, GMGN smart money, Solana &amp; BSC leaderboards
        </div>

        {/* Stats bar */}
        <div
          style={{
            display: "flex",
            gap: "48px",
            marginTop: "48px",
            padding: "20px 40px",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: "24px", fontWeight: 700, color: "white" }}>Solana</span>
            <span style={{ fontSize: "14px", color: "#71717a" }}>Smart Money</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: "24px", fontWeight: 700, color: "white" }}>BSC</span>
            <span style={{ fontSize: "14px", color: "#71717a" }}>Smart Money</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: "24px", fontWeight: 700, color: "white" }}>KOLs</span>
            <span style={{ fontSize: "14px", color: "#71717a" }}>Tracked</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
