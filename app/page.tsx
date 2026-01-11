import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "16px",
        fontFamily: "Arial, sans-serif",
        background: "#0d1117",
        color: "#e6edf3"
      }}
    >
      <h1 style={{ margin: 0, fontSize: "28px" }}>WebNerd Games</h1>
      <div style={{ display: "flex", gap: "12px" }}>
        <Link
          href="/find"
          style={{
            padding: "10px 16px",
            background: "#2563eb",
            borderRadius: "8px"
          }}
        >
          In Depth (Find)
        </Link>
        <Link
          href="/stock"
          style={{
            padding: "10px 16px",
            background: "#22c55e",
            borderRadius: "8px"
          }}
        >
          WebNerd Stocks
        </Link>
      </div>
    </main>
  );
}
