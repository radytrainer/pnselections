"use client";

/**
 * Last-resort boundary for errors in the root layout itself (rare). It
 * replaces the whole document, so it can't rely on the app's styles or
 * components — plain inline styles only.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#fff",
          color: "#111",
          padding: 16,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>
            {offline ? "No internet connection" : "Something went wrong"}
          </h1>
          <p style={{ color: "#555", margin: "0 0 16px", fontSize: 14 }}>
            {offline
              ? "This page needs an internet connection. Reconnect and try again."
              : "The app hit an unexpected error. Try again, or reload the page."}
          </p>
          <button
            type="button"
            onClick={() => (offline ? window.location.reload() : reset())}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
