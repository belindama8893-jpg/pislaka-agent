import type { ReactNode } from "react";

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
    <div aria-label={label} className={cx("card-actions", className)} role={label ? "group" : undefined}>
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
