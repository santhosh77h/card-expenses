"use client";

const categories = [
  { name: "Shopping", amount: "\u20B947,189.63", pct: "62.9%", txns: "7 transactions", color: "#4A90D9", barWidth: "100%" },
  { name: "Transfers", amount: "\u20B925,832.00", pct: "34.5%", txns: "1 transaction", color: "#555566", barWidth: "54.7%" },
  { name: "Entertainment", amount: "\u20B91,500.00", pct: "2.0%", txns: "2 transactions", color: "#9B59B6", barWidth: "3.2%" },
  { name: "Groceries", amount: "\u20B9454.10", pct: "0.6%", txns: "1 transaction", color: "#2ECC71", barWidth: "1%" },
];

const segments = [
  { width: 62.9, color: "#4A90D9" },
  { width: 34.5, color: "#555566" },
  { width: 2.0, color: "#9B59B6" },
  { width: 0.6, color: "#2ECC71" },
];

export function CategoriesScreenPreview() {
  return (
    <div
      style={{
        background: "#0A0E1A",
        padding: "10px 12px 0",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#fff",
        minHeight: "100%",
      }}
    >
      {/* Navigation header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <svg width="8" height="13" viewBox="0 0 10 16" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="8,2 2,8 8,14" />
        </svg>
        <span style={{ fontSize: 10, marginLeft: 3 }}>Tabs</span>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textAlign: "center", marginRight: 30 }}>Statement Analysis</span>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", marginBottom: 2, borderBottom: "1px solid #1a1e2e" }}>
        {["Overview", "Transactions", "Categories"].map((tab, i) => (
          <div
            key={tab}
            style={{
              flex: 1,
              textAlign: "center",
              paddingBottom: 8,
              fontSize: 10,
              color: i === 2 ? "#00E5A0" : "#666",
              fontWeight: i === 2 ? 600 : 400,
              borderBottom: i === 2 ? "2px solid #00E5A0" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Stacked bar chart section */}
      <div style={{ background: "#111827", borderRadius: 10, padding: "10px 10px 8px", marginTop: 10, border: "1px solid #1a2030" }}>
        <div style={{ display: "flex", height: 14, borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
          {segments.map((seg, i) => (
            <div key={i} style={{ width: `${seg.width}%`, background: seg.color, minWidth: seg.width > 1 ? undefined : 3 }} />
          ))}
        </div>
        {categories.map((cat, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: i < categories.length - 1 ? 7 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: cat.color }} />
              <span style={{ fontSize: 10, color: "#aaa" }}>{cat.name}</span>
            </div>
            <span style={{ fontSize: 10, color: "#ccc" }}>{cat.amount} ({cat.pct})</span>
          </div>
        ))}
      </div>

      {/* Top 5 Categories */}
      <div style={{ background: "#111827", borderRadius: 10, padding: "10px 10px 8px", marginTop: 8, border: "1px solid #1a2030" }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 10 }}>Top 5 Categories</div>
        {categories.map((cat, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: i < categories.length - 1 ? 8 : 0 }}>
            <span style={{ fontSize: 9, color: "#aaa", width: 65, flexShrink: 0 }}>{cat.name}</span>
            <div style={{ flex: 1, height: 6, background: "#1a2030", borderRadius: 3 }}>
              <div style={{ height: 6, borderRadius: 3, width: cat.barWidth, background: cat.color, minWidth: 3 }} />
            </div>
            <span style={{ fontSize: 9, color: "#ccc", flexShrink: 0 }}>{cat.amount}</span>
          </div>
        ))}
      </div>

      {/* All Categories */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>All Categories</div>
        {categories.map((cat, i) => (
          <div
            key={i}
            style={{
              background: "#111827",
              borderRadius: 10,
              padding: "8px 10px",
              marginBottom: 6,
              border: "1px solid #1a2030",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color }} />
                <span style={{ fontSize: 11, fontWeight: 600 }}>{cat.name}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600 }}>{cat.amount}</span>
            </div>
            <div style={{ height: 3, background: "#1a2030", borderRadius: 2, marginBottom: 4 }}>
              <div style={{ height: 3, borderRadius: 2, width: cat.barWidth, background: cat.color, minWidth: 3 }} />
            </div>
            <div style={{ fontSize: 9, color: "#666" }}>{cat.txns} / {cat.pct}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
