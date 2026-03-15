"use client";

const transactions = [
  { name: "Tata Payments Limited Mumbai", date: "28/12/2025", category: "Shopping", catColor: "#4A90D9", card: "HDFC \u20227408", amount: "-\u20B93,957.72", isCredit: false },
  { name: "WWW BigBasket Com Gurgaon", date: "26/12/2025", category: "Groceries", catColor: "#2ECC71", card: "HDFC \u20227408", amount: "-\u20B9454.10", isCredit: false },
  { name: "Tata Payments Limited Mumbai", date: "26/12/2025", category: "Shopping", catColor: "#4A90D9", card: "HDFC \u20227408", amount: "-\u20B922,516.90", isCredit: false },
  { name: "Tata Payments Limited Mumbai", date: "23/12/2025", category: "Shopping", catColor: "#4A90D9", card: "HDFC \u20227408", amount: "-\u20B91,359.00", isCredit: false },
  { name: "Tata Payments Limited Mumbai", date: "23/12/2025", category: "Shopping", catColor: "#4A90D9", card: "HDFC \u20227408", amount: "-\u20B97,228.00", isCredit: false },
  { name: "UPI-PVR INOX Limited", date: "19/12/2025", category: "Entertainment", catColor: "#9B59B6", card: "HDFC \u20227408", amount: "-\u20B9750.00", isCredit: false },
  { name: "PVR INOX Limited", date: "13/12/2025", category: "Entertainment", catColor: "#9B59B6", card: "HDFC \u20227408", amount: "-\u20B9750.00", isCredit: false },
  { name: "Tata Payments Mumbai", date: "13/12/2025", category: "Shopping", catColor: "#4A90D9", card: "HDFC \u20227408", amount: "-\u20B91,282.00", isCredit: false },
  { name: "Tata Payments Limited Mumbai", date: "11/12/2025", category: "Shopping", catColor: "#4A90D9", card: "HDFC \u20227408", amount: "-\u20B9846.00", isCredit: false },
  { name: "BPPY CC Payment", date: "11/12/2025", category: "Transfers", catColor: "#555566", card: "HDFC \u20227408", amount: "+\u20B925,832.00", isCredit: true },
  { name: "Tata Payments Mumbai", date: "10/12/2025", category: "Shopping", catColor: "#4A90D9", card: "HDFC \u20227408", amount: "-\u20B910,000.01", isCredit: false },
];

const filters = [
  { label: "All", active: true },
  { label: "Entertainment", color: "#9B59B6" },
  { label: "Groceries", color: "#2ECC71" },
  { label: "Shopping", color: "#4A90D9" },
  { label: "Tran", color: "#555566" },
];

export function TransactionsScreenPreview() {
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
      <div style={{ display: "flex", marginBottom: 10, borderBottom: "1px solid #1a1e2e" }}>
        {["Overview", "Transactions", "Categories"].map((tab, i) => (
          <div
            key={tab}
            style={{
              flex: 1,
              textAlign: "center",
              paddingBottom: 8,
              fontSize: 10,
              color: i === 1 ? "#00E5A0" : "#666",
              fontWeight: i === 1 ? 600 : 400,
              borderBottom: i === 1 ? "2px solid #00E5A0" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Search bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#111827", borderRadius: 8, padding: "7px 10px", marginBottom: 8, border: "1px solid #1a2030" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span style={{ fontSize: 10, color: "#555" }}>Search transactions...</span>
      </div>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 4, marginBottom: 8, overflowX: "hidden" }}>
        {filters.map((f, i) => (
          <div
            key={i}
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              borderRadius: 12,
              fontSize: 9,
              fontWeight: 500,
              border: f.active ? "1.5px solid #00E5A0" : "1px solid #1a2030",
              background: f.active ? "rgba(0,229,160,0.08)" : "#111827",
              color: f.active ? "#00E5A0" : "#aaa",
            }}
          >
            {f.color && <div style={{ width: 5, height: 5, borderRadius: "50%", background: f.color }} />}
            {f.label}
          </div>
        ))}
      </div>

      {/* Count + sort */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 9, color: "#666" }}>11 transactions</span>
        <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: "#888" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1,4 1,10 7,10" />
            <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
          </svg>
          By Date
        </div>
      </div>

      {/* Transaction list */}
      {transactions.map((txn, i) => (
        <div key={i}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "7px 0" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: txn.catColor, marginTop: 4, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 500, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{txn.name}</div>
              <div style={{ fontSize: 8, color: "#555", display: "flex", alignItems: "center", gap: 3 }}>
                {txn.date}
                <span style={{ color: "#333" }}>{"\u00B7"}</span>
                {txn.category}
                <span style={{ color: "#333" }}>{"\u00B7"}</span>
                {txn.card}
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: txn.isCredit ? "#2ECC71" : "#E74C3C", flexShrink: 0 }}>
              {txn.amount}
            </span>
          </div>
          {i < transactions.length - 1 && <div style={{ height: 1, background: "#111827" }} />}
        </div>
      ))}
    </div>
  );
}
