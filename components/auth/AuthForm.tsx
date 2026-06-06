"use client";

import { type FormEvent, useState } from "react";
import { Mail, Lock, Chrome } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleGoogleSignIn() {
    setStatus(null);
    setIsSubmitting(true);
    const supabase = createSupabaseBrowserClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      setStatus(error.message);
      setIsSubmitting(false);
    }
  }

  async function handlePasswordAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setIsSubmitting(true);
    const supabase = createSupabaseBrowserClient();

    const authCall =
      mode === "sign-in"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`
            }
          });

    const { error } = await authCall;

    if (error) {
      setStatus(error.message);
      setIsSubmitting(false);
      return;
    }

    if (mode === "sign-up") {
      setStatus("Check your email to confirm the account, then sign in.");
      setIsSubmitting(false);
      return;
    }

    window.location.href = "/";
  }

  return (
    <div className="auth-card">
      <button
        className="oauth-button"
        disabled={isSubmitting}
        type="button"
        onClick={handleGoogleSignIn}
      >
        <Chrome size={18} /> Continue with Google
      </button>

      <div className="divider">
        <span>or</span>
      </div>

      <form className="auth-form" onSubmit={handlePasswordAuth}>
        <label>
          <span>Email</span>
          <div className="auth-input">
            <Mail size={18} />
            <input
              required
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </label>

        <label>
          <span>Password</span>
          <div className="auth-input">
            <Lock size={18} />
            <input
              required
              minLength={8}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </label>

        <button className="primary-button auth-submit" disabled={isSubmitting} type="submit">
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        className="link-button"
        type="button"
        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
      >
        {mode === "sign-in" ? "Create an email account" : "I already have an account"}
      </button>

      {status ? <p className="auth-status">{status}</p> : null}
    </div>
  );
}
