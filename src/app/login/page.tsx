"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    setIsLoading(true);

    try {
      const { data, error: authError } = await createClient().auth.signInWithPassword({
        email: username,
        password,
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }

      if (data.session) {
        router.push("/review");
      }
    } catch (err) {
      setError("An unexpected error occurred. Try again.");
      setIsLoading(false);
    }
  }

  return (
    <main>
      <div className="shell">
        <div className="centered">
          <span className="eyebrow">Redaction desk</span>
          <h2>Sign in to review tickets.</h2>

          <p>Enter your credentials to access the review queue.</p>

          <input
            className="field"
            type="email"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleLogin();
            }}
            placeholder="Email"
            autoComplete="email"
            aria-label="Email"
            disabled={isLoading}
          />

          <input
            className="field"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleLogin();
            }}
            placeholder="Password"
            autoComplete="current-password"
            aria-label="Password"
            disabled={isLoading}
            style={{ marginTop: "8px" }}
          />

          <button
            className="btn btn-clear"
            onClick={handleLogin}
            disabled={isLoading || !username || !password}
            style={{ marginTop: "12px" }}
          >
            {isLoading ? "Signing in…" : "Sign in"}
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
