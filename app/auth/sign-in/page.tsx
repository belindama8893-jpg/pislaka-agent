import { AuthForm } from "@/components/auth/AuthForm";
import { CalendarClock, Home, MessageCircle, Sparkles, Users } from "lucide-react";

export default function SignInPage() {
  return (
    <main className="auth-page auth-homepage">
      <aside className="auth-rail" aria-label="Pislaka Agent preview navigation">
        <div className="auth-rail-logo">Pislaka Agent</div>
        <nav className="auth-rail-nav">
          <span className="active">
            <Sparkles size={18} /> New workspace
          </span>
          <span>
            <Home size={18} /> Property intake
          </span>
          <span>
            <Users size={18} /> Lead follow-up
          </span>
          <span>
            <CalendarClock size={18} /> Schedule
          </span>
        </nav>
        <div className="auth-rail-footer">
          <strong>Built for brokers</strong>
          <p>Sign in to keep listings, leads, media, and reminders connected.</p>
        </div>
      </aside>

      <section className="auth-workspace">
        <header className="auth-topbar">
          <span>Pislaka Agent</span>
        </header>
        <div className="auth-center">
          <p className="eyebrow">Agent workspace</p>
          <h1>What should your real estate assistant handle today?</h1>
          <p className="auth-copy">
            Create listings, capture leads, schedule viewings, and draft WhatsApp follow-ups from one AI workspace.
          </p>
          <div className="auth-prompt-panel">
            <AuthForm />
            <div className="auth-starters" aria-label="Common Pislaka Agent tasks">
              <span>
                <Home size={15} /> Publish a listing
              </span>
              <span>
                <MessageCircle size={15} /> Capture a lead
              </span>
              <span>
                <CalendarClock size={15} /> Create a viewing
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
