import { AuthForm } from "@/components/auth/AuthForm";

export default function SignInPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel glass-panel">
        <div>
          <p className="eyebrow">Pislaka Agent</p>
          <h1>Sign in to Agent Workspace</h1>
          <p className="auth-copy">
            Use Google or email/password for the MVP. Phone and WhatsApp OTP are reserved for
            the next local-market login step.
          </p>
        </div>
        <AuthForm />
      </section>
    </main>
  );
}
