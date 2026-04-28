import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: 32, marginBottom: 12 }}>ExpenseTerminal</h1>
      <p style={{ color: "#444", lineHeight: 1.5 }}>
        Your Next.js app scaffold is set up. Next step is adding real routes and UI.
      </p>
      <p style={{ marginTop: 20 }}>
        <Link href="/api/health">Health check</Link>
      </p>
    </main>
  );
}

