import type { ReactNode } from "react";
import type { AgentCandidateCardItem, AgentCardAction, AgentCardBadgeTone } from "@/components/agent/cards/card-contract";

export type AgentFieldItem = {
  hidden?: boolean;
  label: ReactNode;
  previousValue?: ReactNode;
  value: ReactNode;
};

export type AgentObjectSummaryVariant = "block" | "compact" | "row";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function hasRenderableValue(value: ReactNode) {
  return value !== null && value !== undefined && value !== "";
}

export function AgentCardButton({
  action,
  ariaLabel,
  children,
  className,
  disabled,
  href,
  icon,
  iconOnly = false,
  kind = "secondary",
  onClick,
  title
}: {
  action?: AgentCardAction;
  ariaLabel?: string;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  href?: string;
  icon?: ReactNode;
  iconOnly?: boolean;
  kind?: AgentCardAction["kind"];
  onClick?: () => void;
  title?: string;
}) {
  const resolvedKind = action?.kind ?? kind;
  const resolvedHref = action?.href ?? href;
  const resolvedIcon = action?.icon ?? icon;
  const resolvedLabel = action?.label ?? children;
  const resolvedDisabled = action?.disabled ?? disabled;
  const resolvedOnClick = action?.onClick ?? onClick;
  const resolvedTitle = action?.title ?? title;
  const resolvedAriaLabel = action?.ariaLabel ?? ariaLabel;
  const buttonClassName = cx("agent-card-button", `agent-card-button-${resolvedKind}`, iconOnly && "agent-card-button-icon", className);

  if (resolvedHref && !resolvedDisabled) {
    return (
      <a aria-label={resolvedAriaLabel} className={buttonClassName} href={resolvedHref} title={resolvedTitle}>
        {resolvedIcon}
        {resolvedLabel ? <span>{resolvedLabel}</span> : null}
      </a>
    );
  }

  return (
    <button
      aria-label={resolvedAriaLabel}
      className={buttonClassName}
      disabled={resolvedDisabled}
      onClick={resolvedOnClick}
      title={resolvedTitle}
      type="button"
    >
      {resolvedIcon}
      {resolvedLabel ? <span>{resolvedLabel}</span> : null}
    </button>
  );
}

export function AgentCardActions({
  actions,
  children,
  className,
  label
}: {
  actions?: AgentCardAction[];
  children?: ReactNode;
  className?: string;
  label?: string;
}) {
  if (!actions?.length && !hasRenderableValue(children)) {
    return null;
  }

  return (
    <div aria-label={label} className={cx("agent-card-actions", className)} role={label ? "group" : undefined}>
      {actions?.map((action) => <AgentCardButton action={action} key={action.key} />)}
      {children}
    </div>
  );
}

export function AgentCardBadge({
  children,
  className,
  tone = "neutral"
}: {
  children: ReactNode;
  className?: string;
  tone?: AgentCardBadgeTone;
}) {
  return <span className={cx("agent-card-badge", `agent-card-badge-${tone}`, className)}>{children}</span>;
}

export function AgentCardNotice({
  children,
  className,
  tone = "neutral"
}: {
  children: ReactNode;
  className?: string;
  tone?: AgentCardBadgeTone;
}) {
  if (!hasRenderableValue(children)) {
    return null;
  }

  return (
    <div className={cx("agent-card-notice", `agent-card-notice-${tone}`, className)}>
      <span aria-hidden="true" />
      {children}
    </div>
  );
}

export function AgentCardTextBlock({
  actions,
  children,
  className,
  label,
  meta,
  title
}: {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  label?: ReactNode;
  meta?: ReactNode;
  title?: ReactNode;
}) {
  if (!hasRenderableValue(children) && !hasRenderableValue(title)) {
    return null;
  }

  return (
    <section className={cx("agent-card-text-block", className)}>
      {hasRenderableValue(label) || hasRenderableValue(meta) || hasRenderableValue(actions) ? (
        <header>
          <div>
            {hasRenderableValue(label) ? <span>{label}</span> : null}
            {hasRenderableValue(meta) ? <small>{meta}</small> : null}
          </div>
          {hasRenderableValue(actions) ? <div className="agent-card-text-block-actions">{actions}</div> : null}
        </header>
      ) : null}
      {hasRenderableValue(title) ? <strong>{title}</strong> : null}
      {hasRenderableValue(children) ? <p>{children}</p> : null}
    </section>
  );
}

export function AgentStepList({
  className,
  label,
  steps
}: {
  className?: string;
  label?: string;
  steps: ReactNode[];
}) {
  const visibleSteps = steps.filter(hasRenderableValue);

  if (!visibleSteps.length) {
    return null;
  }

  return (
    <div aria-label={label} className={cx("agent-card-step-list", className)}>
      {visibleSteps.map((step, index) => (
        <span key={index}>{step}</span>
      ))}
    </div>
  );
}

export function AgentFieldList({
  className,
  compact = false,
  fields
}: {
  className?: string;
  compact?: boolean;
  fields: AgentFieldItem[];
}) {
  const visibleFields = fields.filter((field) => !field.hidden && hasRenderableValue(field.value));

  if (!visibleFields.length) {
    return null;
  }

  return (
    <div className={cx("listing-update-list", compact && "compact", className)}>
      {visibleFields.map((field, index) => (
        <div className="listing-update-row" key={index}>
          <span>{field.label}</span>
          <div>
            {hasRenderableValue(field.previousValue) ? <small>{field.previousValue}</small> : null}
            <strong>{field.value}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AgentActionGroup({
  children,
  className,
  label
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div aria-label={label} className={cx("agent-card-actions", "card-actions", className)} role={label ? "group" : undefined}>
      {children}
    </div>
  );
}

export function AgentObjectSummary({
  badge,
  className,
  description,
  meta,
  title,
  variant = "row"
}: {
  badge?: ReactNode;
  className?: string;
  description?: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
  variant?: AgentObjectSummaryVariant;
}) {
  if (variant === "block") {
    return (
      <div className={cx("promotion-target-card", className)}>
        <strong>{title}</strong>
        {hasRenderableValue(description) ? <span>{description}</span> : null}
        {hasRenderableValue(meta) ? <span>{meta}</span> : null}
        {badge ? <span>{badge}</span> : null}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cx("chat-compact-lead-line", className)}>
        <span>{title}</span>
        {hasRenderableValue(description) ? <small>{description}</small> : null}
        {hasRenderableValue(meta) ? <small>{meta}</small> : null}
      </div>
    );
  }

  return (
    <div className={cx("lead-chat-row standalone", className)}>
      <div>
        <strong>{title}</strong>
        {hasRenderableValue(description) ? <p>{description}</p> : null}
        {hasRenderableValue(meta) ? <small>{meta}</small> : null}
      </div>
      {badge}
    </div>
  );
}

export function AgentInfoGrid({
  className,
  fields,
  single = false
}: {
  className?: string;
  fields: AgentFieldItem[];
  single?: boolean;
}) {
  const visibleFields = fields.filter((field) => !field.hidden && hasRenderableValue(field.value));

  if (!visibleFields.length) {
    return null;
  }

  return (
    <div className={cx("chat-import-fields", single && "single", className)}>
      {visibleFields.map((field, index) => (
        <div key={index}>
          <span>{field.label}</span>
          <strong>{field.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function AgentMiniInfoGrid({
  className,
  fields
}: {
  className?: string;
  fields: AgentFieldItem[];
}) {
  const visibleFields = fields.filter((field) => !field.hidden && hasRenderableValue(field.value));

  if (!visibleFields.length) {
    return null;
  }

  return (
    <div className={cx("chat-lead-mini-card", className)}>
      {visibleFields.map((field, index) => (
        <div key={index}>
          <span>{field.label}</span>
          <strong>{field.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function AgentCandidateList({
  className,
  empty,
  items,
  label
}: {
  className?: string;
  empty?: ReactNode;
  items: AgentCandidateCardItem[];
  label: string;
}) {
  if (!items.length) {
    return hasRenderableValue(empty) ? <p className="agent-card-empty">{empty}</p> : null;
  }

  return (
    <div aria-label={label} className={cx("listing-update-list", "agent-card-candidate-list", className)} role="list">
      {items.map((item) => (
        <article className="listing-update-row agent-card-candidate" key={item.key} role="listitem">
          <div className="agent-card-candidate-content">
            <div className="agent-card-candidate-title-row">
              <strong>{item.title}</strong>
              {item.badge ? <span className="agent-card-candidate-badge">{item.badge}</span> : null}
            </div>
            {hasRenderableValue(item.description) ? <p>{item.description}</p> : null}
            {hasRenderableValue(item.meta) ? <small>{item.meta}</small> : null}
          </div>
          {item.action ? <div className="agent-card-candidate-action">{item.action}</div> : null}
        </article>
      ))}
    </div>
  );
}
