"use client";

import { type FormEvent, useState } from "react";
import { Lock, Mail } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";
type AuthFormProps = {
  onAuthStarted?: () => void;
};

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="google-icon" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

export function AuthForm({ onAuthStarted }: AuthFormProps = {}) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPasswordStep, setShowPasswordStep] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleGoogleSignIn() {
    setStatus(null);
    setIsSubmitting(true);
    onAuthStarted?.();
    window.location.href = new URL("/api/auth/google", window.location.origin).toString();
  }

  async function handlePasswordAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    if (!showPasswordStep) {
      setShowPasswordStep(true);
      return;
    }

    setIsSubmitting(true);
    onAuthStarted?.();
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
        <GoogleIcon /> Continue with Google
      </button>

      <div className="divider">
        <span>OR</span>
      </div>

      <form className="auth-form" onSubmit={handlePasswordAuth}>
        <label>
          <span className="sr-only">Email</span>
          <div className="auth-input">
            <Mail size={18} />
            <input
              required
              autoComplete="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </label>

        {showPasswordStep ? (
          <label>
            <span className="sr-only">Password</span>
            <div className="auth-input">
              <Lock size={18} />
              <input
                required
                minLength={8}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </label>
        ) : null}

        <button className="primary-button auth-submit" disabled={isSubmitting} type="submit">
          {!showPasswordStep
            ? "Continue with email"
            : mode === "sign-in"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <p className="auth-policy">
        By continuing, you acknowledge Pislaka&apos;s <span>Privacy Policy</span>.
      </p>

      <button
        className="link-button"
        type="button"
        onClick={() => {
          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          setPassword("");
          setShowPasswordStep(false);
          setStatus(null);
        }}
      >
        {mode === "sign-in" ? "Create an email account" : "I already have an account"}
      </button>

      {status ? <p className="auth-status">{status}</p> : null}
    </div>
  );
}
