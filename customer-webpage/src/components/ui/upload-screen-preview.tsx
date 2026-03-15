"use client";

export function UploadScreenPreview() {
  return (
    <div
      style={{
        background: "#0A0E1A",
        padding: "14px 14px 0",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#fff",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>Upload Statement</div>
      <div style={{ fontSize: 11, color: "#8888aa", marginBottom: 10 }}>Parse your credit card PDF statement</div>

      {/* Privacy badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          background: "rgba(0, 229, 160, 0.1)",
          border: "1px solid rgba(0, 229, 160, 0.3)",
          borderRadius: 14,
          padding: "4px 10px",
          fontSize: 9,
          color: "#00E5A0",
          fontWeight: 500,
          marginBottom: 12,
          alignSelf: "flex-start",
        }}
      >
        Your PDF is processed in memory and never stored
      </div>

      {/* Select Card */}
      <div style={{ fontSize: 10, color: "#8888aa", marginBottom: 6, fontWeight: 500 }}>Select Card</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <div
          style={{
            padding: "5px 10px",
            borderRadius: 14,
            border: "1.5px solid #00E5A0",
            background: "rgba(0, 229, 160, 0.08)",
            fontSize: 9,
            color: "#00E5A0",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          Other {"\u2022"}4321 (*4321)
        </div>
        <div
          style={{
            padding: "5px 10px",
            borderRadius: 14,
            border: "1px solid #2a2a3a",
            background: "#13151f",
            fontSize: 9,
            color: "#999",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          HDFC Bank {"\u2022"}7408 (*7408)
        </div>
      </div>

      {/* Upload area */}
      <div
        style={{
          border: "2px dashed #2a3040",
          borderRadius: 12,
          padding: "28px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(15, 20, 35, 0.6)",
          marginBottom: 12,
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#555"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginBottom: 10 }}
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>Tap to Upload PDF</div>
        <div style={{ fontSize: 9, color: "#666", textAlign: "center" }}>Select your credit card statement (max 10 MB)</div>
      </div>

      {/* Try Demo button */}
      <div
        style={{
          border: "1.5px solid #00E5A0",
          borderRadius: 10,
          padding: "10px 0",
          textAlign: "center",
          fontSize: 12,
          fontWeight: 600,
          color: "#00E5A0",
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#00E5A0" stroke="none">
          <polygon points="5,3 19,12 5,21" />
        </svg>
        Try Demo
      </div>

      {/* Privacy First card */}
      <div
        style={{
          background: "#111827",
          borderRadius: 10,
          padding: "10px 12px",
          border: "1px solid #1e2536",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00E5A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 600 }}>Privacy First</span>
        </div>
        <div style={{ fontSize: 9, color: "#8888aa", lineHeight: 1.5 }}>
          Your PDF is parsed in-memory on our server and immediately discarded. No financial data is ever stored, logged, or shared.
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Bottom tab bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          padding: "8px 0 4px",
          borderTop: "1px solid #1a1e2e",
          margin: "0 -14px",
          paddingLeft: 14,
          paddingRight: 14,
        }}
      >
        {[
          { icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z", label: "Home" },
          { icon: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01", label: "Transactions" },
          { icon: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12", label: "Upload", active: true },
          { icon: "M1 4v10a2 2 0 002 2h18a2 2 0 002-2V4M1 4l11 7 11-7", label: "Cards" },
          { icon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z", label: "You" },
        ].map((tab, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={tab.active ? "#00E5A0" : "#555"}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={tab.icon} />
            </svg>
            <span style={{ fontSize: 8, color: tab.active ? "#00E5A0" : "#555", fontWeight: tab.active ? 600 : 400 }}>
              {tab.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
