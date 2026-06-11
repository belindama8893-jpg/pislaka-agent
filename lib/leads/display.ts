import type { LeadRecord } from "@/lib/leads/types";

export function formatLeadStatusLabel(status: LeadRecord["status"], urgency?: LeadRecord["urgency"] | null) {
  if (status === "qualified" && urgency === "high") {
    return "Hot lead";
  }

  const labels: Record<LeadRecord["status"], string> = {
    new: "New",
    contacted: "Contacted",
    qualified: "Interested",
    closed: "Closed",
    lost: "Not interested"
  };

  return labels[status];
}

export function getLeadStatusClassName(status: LeadRecord["status"], urgency?: LeadRecord["urgency"] | null, extraClass = "") {
  return ["lead-status", status, status === "qualified" && urgency === "high" ? "hot" : null, extraClass]
    .filter(Boolean)
    .join(" ");
}
