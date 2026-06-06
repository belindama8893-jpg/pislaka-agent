import { List, Sparkles, Users } from "lucide-react";
import Link from "next/link";

type MobileTabBarProps = {
  active: "agent" | "listings" | "leads";
  listingsCount?: number;
  leadsCount?: number;
};

export function MobileTabBar({ active, listingsCount, leadsCount }: MobileTabBarProps) {
  return (
    <nav className="mobile-tabbar" aria-label="Mobile workspace navigation">
      <Link className={active === "agent" ? "active" : ""} href="/" aria-current={active === "agent" ? "page" : undefined}>
        <Sparkles size={18} />
        <span>Agent</span>
      </Link>
      <Link
        className={active === "listings" ? "active" : ""}
        href="/listings"
        aria-current={active === "listings" ? "page" : undefined}
      >
        <List size={18} />
        <span>Listings</span>
        {typeof listingsCount === "number" ? <strong>{listingsCount}</strong> : null}
      </Link>
      <Link className={active === "leads" ? "active" : ""} href="/leads" aria-current={active === "leads" ? "page" : undefined}>
        <Users size={18} />
        <span>Leads</span>
        {typeof leadsCount === "number" && leadsCount > 0 ? <strong className="urgent">{leadsCount}</strong> : null}
      </Link>
    </nav>
  );
}
