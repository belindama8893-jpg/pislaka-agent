import type { ReactNode } from "react";

export type AgentCardTone = "default" | "lead" | "listing" | "schedule" | "promotion";

export type AgentCardIntent = "draft" | "read" | "confirm" | "external" | "select" | "partial" | "saved";

export type AgentCardActionKind =
  | "primary"
  | "secondary"
  | "ghost"
  | "external"
  | "danger"
  | "success"
  | "warning"
  | "icon"
  | "complete";

export type AgentCardBadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "selected";

export type AgentCardAction = {
  ariaLabel?: string;
  disabled?: boolean;
  href?: string;
  icon?: ReactNode;
  key: string;
  kind: AgentCardActionKind;
  label: ReactNode;
  onClick?: () => void;
  title?: string;
};

export type AgentCardStatusTone = "idle" | "loading" | "success" | "error" | "auth";

export type AgentCardStatus = {
  message: ReactNode;
  tone: AgentCardStatusTone;
};

export type AgentCandidateCardItem = {
  action?: ReactNode;
  badge?: ReactNode;
  description?: ReactNode;
  key: string;
  meta?: ReactNode;
  title: ReactNode;
};
