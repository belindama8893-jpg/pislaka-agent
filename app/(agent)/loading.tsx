import { MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function Loading() {
  return (
    <main className="workspace-shell is-agent-home agent-route-loading" aria-busy="true">
      <aside className="workspace-sidebar" aria-label="Pislaka workspace navigation">
        <Link className="workspace-sidebar-brand" href="/">
          <Image src="/logo.png" alt="Pislaka" width={324} height={120} priority />
        </Link>

        <nav className="workspace-sidebar-nav" aria-label="Agent conversations">
          <p>Agent conversations</p>
          <Link className="workspace-nav-item active" href="/">
            <span>
              <MessageCircle size={16} /> Agent Chat
            </span>
          </Link>
        </nav>

        <nav className="workspace-sidebar-nav" aria-label="Workspace pages">
          <p>Workspace</p>
          <Link className="workspace-nav-item" href="/listings">
            <span>Listings</span>
          </Link>
          <Link className="workspace-nav-item" href="/leads">
            <span>Leads</span>
          </Link>
          <Link className="workspace-nav-item" href="#">
            <span>Analytics</span>
          </Link>
          <Link className="workspace-nav-item" href="/schedule">
            <span>Schedule</span>
          </Link>
        </nav>
      </aside>

      <section className="workspace-main">
        <header className="workspace-main-topbar">
          <Link className="workspace-mobile-brand" href="/">
            <Image src="/logo.png" alt="Pislaka" width={324} height={120} priority />
          </Link>
          <div className="workspace-top-account">
            <span className="account-avatar loading-avatar">P</span>
          </div>
        </header>

        <section className="chat-panel is-empty agent-loading-panel">
          <div className="messages">
            <div className="agent-loading-blank" />
          </div>
        </section>
      </section>
    </main>
  );
}
