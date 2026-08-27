"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function sendLink() {
    setError(null);
    setState("sending");

    const { error: authError } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false,
      },
    });

    if (authError) {
      setError(authError.message);
      setState("idle");
      return;
    }
    setState("sent");
  }

  return (
    <main>
      <div className="shell">
        <div className="centered">
          <span className="eyebrow">Redaction desk</span>
          <h2>Sign in to review tickets.</h2>

          {state === "sent" ? (
            <p>
              A sign-in link is on its way to {email}. It opens the review queue
              directly.
            </p>
          ) : (
            <>
              <p>
                Reviewer accounts are created by an administrator. Enter your work
                address and we&rsquo;ll send a sign-in link.
              </p>
              <input
                className="field"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && email.includes("@")) void sendLink();
                }}
                placeholder="you@enpal.de"
                autoComplete="email"
                aria-label="Work email address"
              />
              <button
                className="btn btn-clear"
                onClick={sendLink}
                disabled={state === "sending" || !email.includes("@")}
              >
                {state === "sending" ? "Sending…" : "Send sign-in link"}
              </button>
              {error && (
                <p className="notice notice-error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
