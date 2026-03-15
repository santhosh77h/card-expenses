"use client";

const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const spendData = [41200, 38400, 35100, 42800, 31600, 28900, 36700, 44200, 38900, 40100, 68400, 28623];
const maxSpend = Math.max(...spendData);

const categories = [
  { name: "Shopping", emoji: "\u{1F6D2}", amount: "\u20B91,10,240", pct: "28.7%", width: "72%", color: "#8b87ff", bg: "#1e1e32" },
  { name: "Food & Dining", emoji: "\u{1F37D}\uFE0F", amount: "\u20B982,600", pct: "21.5%", width: "54%", color: "#4ecb8a", bg: "#1e2a1e" },
  { name: "Travel", emoji: "\u2708\uFE0F", amount: "\u20B958,400", pct: "15.2%", width: "38%", color: "#a78bfa", bg: "#1e1e2e" },
  { name: "Fuel", emoji: "\u26FD", amount: "\u20B942,800", pct: "11.1%", width: "28%", color: "#ff6b6b", bg: "#2a1e1e" },
  { name: "Health", emoji: "\u{1F48A}", amount: "\u20B927,200", pct: "7.1%", width: "18%", color: "#4ecfcf", bg: "#1e2a2a" },
  { name: "Others", emoji: "\u{1F4E6}", amount: "\u20B962,970", pct: "16.4%", width: "16%", color: "#888", bg: "#2a2a1e" },
];

const merchants = [
  { initials: "AM", name: "Amazon", txns: "24 transactions", amount: "\u20B938,400", color: "#8b87ff" },
  { initials: "SW", name: "Swiggy", txns: "41 transactions", amount: "\u20B929,100", color: "#4ecb8a" },
  { initials: "BP", name: "BPCL Fuel", txns: "18 transactions", amount: "\u20B926,800", color: "#ff6b6b" },
  { initials: "MK", name: "MakeMyTrip", txns: "6 transactions", amount: "\u20B922,600", color: "#a78bfa" },
  { initials: "FL", name: "Flipkart", txns: "19 transactions", amount: "\u20B919,200", color: "#4ecfcf" },
];

const insights = [
  { label: "\u2191 Unusual spike", text: "February was 113% above", rest: " your monthly average. Shopping and Travel were the biggest drivers." },
  { label: "\u{1F37D} Dining trend", text: "increased 22%", rest: " over the last 3 months compared to the 3 months prior.", prefix: "Food & Dining spend has " },
  { label: "\u2713 Best month", text: "September was your lowest spend month", rest: " at \u20B928,900 \u2014 10% below your yearly average." },
];

// Donut chart angles
const donutAngles = [0.287, 0.215, 0.152, 0.111, 0.071, 0.164];
const donutColors = ["#8b87ff", "#4ecb8a", "#a78bfa", "#ff6b6b", "#4ecfcf", "#555566"];
const donutGradient = (() => {
  let acc = 0;
  return donutAngles
    .map((pct, i) => {
      const start = acc * 360;
      acc += pct;
      const end = acc * 360;
      return `${donutColors[i]} ${start}deg ${end}deg`;
    })
    .join(", ");
})();

export function CardAnalyticsPreview() {
  return (
    <div
      style={{
        background: "#0d0d14",
        padding: "14px 12px 20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#fff",
        minHeight: "100%",
      }}
    >
      {/* Header */}
      <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 2 }}>Cards</div>
      <div style={{ color: "#8888aa", fontSize: 12, marginBottom: 12 }}>12-month overview</div>

      {/* Period selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ color: "#8888aa", fontSize: 16 }}>{"\u2039"}</span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>Apr 2025 – Mar 2026</span>
        <span style={{ color: "#8888aa", fontSize: 16 }}>{"\u203A"}</span>
      </div>

      {/* Card chips */}
      <div style={{ display: "flex", gap: 8, overflowX: "hidden", marginBottom: 14, paddingBottom: 2 }}>
        {/* Active card */}
        <div style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 14, background: "#1a1a2e", border: "1.5px solid #6c63ff" }}>
          <div style={{ fontSize: 10, color: "#8888aa", marginBottom: 1 }}>All cards</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#8b87ff" }}>{"\u20B9"}3,84,210</div>
          <div style={{ fontSize: 10, color: "#ff6b6b", marginTop: 1 }}>{"\u2193"} 12% vs prev year</div>
        </div>
        {/* HDFC card */}
        <div style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 14, background: "#13131f", border: "1px solid #2a2a3a" }}>
          <div style={{ fontSize: 10, color: "#8888aa", marginBottom: 1 }}>HDFC {"\u2022\u2022"}7408</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{"\u20B9"}2,86,420</div>
          <div style={{ fontSize: 10, color: "#ff6b6b", marginTop: 1 }}>{"\u2193"} 64% vs last mo</div>
        </div>
        {/* Other card */}
        <div style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 14, background: "#13131f", border: "1px solid #2a2a3a" }}>
          <div style={{ fontSize: 10, color: "#8888aa", marginBottom: 1 }}>Other {"\u2022\u2022"}4321</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{"\u20B9"}97,790</div>
          <div style={{ fontSize: 10, color: "#4ecb8a", marginTop: 1 }}>{"\u2191"} 8% vs last mo</div>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, background: "#13131f", borderRadius: 10, padding: 10, border: "1px solid #2a2a3a" }}>
          <div style={{ fontSize: 10, color: "#8888aa", marginBottom: 3 }}>Monthly avg</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>{"\u20B9"}32,017</div>
          <div style={{ fontSize: 10, color: "#8888aa", marginTop: 2 }}>across 12 months</div>
        </div>
        <div style={{ flex: 1, background: "#13131f", borderRadius: 10, padding: 10, border: "1px solid #2a2a3a" }}>
          <div style={{ fontSize: 10, color: "#8888aa", marginBottom: 3 }}>Peak month</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Feb</div>
          <div style={{ fontSize: 10, color: "#ff6b6b", marginTop: 2 }}>{"\u20B9"}68,400 spent</div>
        </div>
      </div>

      {/* Monthly spending trend */}
      <div style={{ background: "#13131f", borderRadius: 14, padding: 14, border: "1px solid #2a2a3a", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "#8888aa", marginBottom: 12 }}>Monthly spending trend</div>
        {/* Bar chart */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100, marginBottom: 6 }}>
          {spendData.map((val, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
              <div
                style={{
                  width: "100%",
                  maxWidth: 16,
                  height: `${(val / maxSpend) * 100}%`,
                  background: "linear-gradient(to top, #8b87ff, #8b87ff88)",
                  borderRadius: "2px 2px 0 0",
                  minHeight: 3,
                }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {months.map((m, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 7, color: "#8888aa" }}>{m}</div>
          ))}
        </div>
        {/* Legend */}
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#8888aa" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#8b87ff" }} />
            Total spend
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#8888aa" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ecb8a", opacity: 0.6 }} />
            Monthly avg
          </div>
        </div>
      </div>

      {/* Top spending categories */}
      <div style={{ background: "#13131f", borderRadius: 14, padding: 14, border: "1px solid #2a2a3a", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "#8888aa", marginBottom: 12 }}>Top spending categories</div>
        {/* Donut chart */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: `conic-gradient(${donutGradient})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#13131f", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{"\u20B9"}3.84L</div>
                <div style={{ fontSize: 8, color: "#8888aa" }}>Total</div>
              </div>
            </div>
          </div>
        </div>
        {/* Category rows */}
        {categories.map((cat, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < categories.length - 1 ? 8 : 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: cat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
              {cat.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 500 }}>{cat.name}</div>
              <div style={{ height: 3, background: "#2a2a3a", borderRadius: 2, marginTop: 3 }}>
                <div style={{ height: 3, borderRadius: 2, width: cat.width, background: cat.color }} />
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 500 }}>{cat.amount}</div>
              <div style={{ fontSize: 9, color: "#8888aa" }}>{cat.pct}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Top merchants */}
      <div style={{ background: "#13131f", borderRadius: 14, padding: 14, border: "1px solid #2a2a3a", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "#8888aa", marginBottom: 12 }}>Top merchants by spend</div>
        {merchants.map((m, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < merchants.length - 1 ? 8 : 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#1e1e32", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, color: m.color, flexShrink: 0 }}>
              {m.initials}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11 }}>{m.name}</div>
              <div style={{ fontSize: 9, color: "#8888aa" }}>{m.txns}</div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, textAlign: "right" }}>{m.amount}</div>
          </div>
        ))}
      </div>

      {/* Spending insights */}
      <div style={{ background: "#13131f", borderRadius: 14, padding: 14, border: "1px solid #2a2a3a" }}>
        <div style={{ fontSize: 11, color: "#8888aa", marginBottom: 12 }}>Spending insights</div>
        {insights.map((ins, i) => (
          <div key={i} style={{ background: "#1a1a2e", borderRadius: 10, padding: "10px 12px", border: "1px solid #2a2a3a", marginBottom: i < insights.length - 1 ? 8 : 0 }}>
            <div style={{ fontSize: 10, color: "#8b87ff", marginBottom: 3, fontWeight: 500 }}>{ins.label}</div>
            <div style={{ fontSize: 11, color: "#ccc", lineHeight: 1.5 }}>
              {ins.prefix}
              <strong style={{ color: "#fff" }}>{ins.text}</strong>
              {ins.rest}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
