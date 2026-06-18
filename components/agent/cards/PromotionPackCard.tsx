import type { ReactNode } from "react";
import { Megaphone } from "lucide-react";
import { AgentOutputCard } from "@/components/agent/AgentOutputCard";

export type PromotionPackCopy = {
  actions?: ReactNode;
  body: ReactNode;
  copiedHint?: ReactNode;
  cta?: ReactNode;
  landingUrl?: ReactNode;
  title: ReactNode;
};

export type PromotionPackChannel = {
  copies: PromotionPackCopy[];
  icon?: ReactNode;
  id: string;
  label: ReactNode;
  meta?: ReactNode;
};

export type PromotionPackCardProps = {
  channels: PromotionPackChannel[];
  status?: ReactNode;
  subtitle?: ReactNode;
  title: string;
};

function hasRenderableValue(value: ReactNode) {
  return value !== null && value !== undefined && value !== "";
}

export function PromotionPackCard({
  channels,
  status,
  subtitle,
  title
}: PromotionPackCardProps) {
  return (
    <AgentOutputCard
      className="promotion-card-shell promotion-pack-agent-card"
      domain="Promotion"
      icon={<Megaphone size={16} />}
      intent="external"
      status={status}
      summary={subtitle}
      title={title}
      tone="promotion"
    >
      <div className="promotion-pack-list">
        {channels.map((channel) => (
          <article className="promotion-pack-channel" key={channel.id}>
            <header>
              <div>
                {channel.icon}
                <strong>{channel.label}</strong>
              </div>
              {hasRenderableValue(channel.meta) ? <span>{channel.meta}</span> : null}
            </header>
            <div className="promotion-pack-options">
              {channel.copies.map((copy, index) => (
                <section className="promotion-pack-copy" key={index}>
                  <div className="promotion-pack-copy-header">
                    <strong>{copy.title}</strong>
                    {copy.actions ? <div className="promotion-pack-copy-actions">{copy.actions}</div> : null}
                  </div>
                  <p>{copy.body}</p>
                  {hasRenderableValue(copy.cta) ? <span className="promotion-pack-cta">{copy.cta}</span> : null}
                  {hasRenderableValue(copy.landingUrl) ? <div className="promotion-pack-url">{copy.landingUrl}</div> : null}
                  {hasRenderableValue(copy.copiedHint) ? <small>{copy.copiedHint}</small> : null}
                </section>
              ))}
            </div>
          </article>
        ))}
      </div>
    </AgentOutputCard>
  );
}
