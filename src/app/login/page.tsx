"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    const correctPassword = process.env.NEXT_PUBLIC_REVIEW_PASSWORD;

    if (!correctPassword) {
      setError("Password not configured. Contact the administrator.");
      return;
    }

    if (password === correctPassword) {
      // Set auth cookie via a server action
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth: true }),
      });

      if (response.ok) {
        router.push("/review");
      }
    } else {
      setError("Incorrect password. Try again.");
      setPassword("");
    }
  }

  return (
    <main>
      <div className="shell">
        <div className="centered">
          <span className="eyebrow">Redaction desk</span>
          <h2>Enter password to review tickets.</h2>

          <input
            className="field"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleLogin();
            }}
            placeholder="Password"
            autoComplete="off"
            aria-label="Password"
            autoFocus
          />

          <button
            className="btn btn-clear"
            onClick={handleLogin}
            disabled={!password}
            style={{ marginTop: "12px" }}
          >
            Sign in
          </button>

          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
