"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatLeadStatusLabel, getLeadStatusClassName } from "@/lib/leads/display";
import type { LeadRecord } from "@/lib/leads/types";

type LeadStatusEditorProps = {
  leadId: string;
  status: LeadRecord["status"];
  urgency: LeadRecord["urgency"];
};

function StatusEditorPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(children, document.body);
}

export function LeadStatusEditor({ leadId, status, urgency }: LeadStatusEditorProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<LeadRecord["status"]>(status);
  const [selectedUrgency, setSelectedUrgency] = useState<NonNullable<LeadRecord["urgency"]>>(urgency ?? "normal");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("Saving status...");

    const response = await fetch("/api/leads", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: leadId,
        status: selectedStatus,
        urgency: selectedUrgency
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(payload?.error ?? "Unable to save status.");
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    setIsOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        className={getLeadStatusClassName(status, urgency, "as-button")}
        type="button"
        onClick={() => {
          setSelectedStatus(status);
          setSelectedUrgency(urgency ?? "normal");
          setMessage(null);
          setIsOpen(true);
        }}
      >
        {formatLeadStatusLabel(status, urgency)}
      </button>

      {isOpen ? (
        <StatusEditorPortal>
          <div className="lead-modal-backdrop" role="presentation" onClick={() => setIsOpen(false)}>
            <section
              aria-labelledby="lead-status-modal-title"
              aria-modal="true"
              className="lead-modal lead-status-modal"
              role="dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="lead-modal-header">
                <div>
                  <span>Status</span>
                  <h3 id="lead-status-modal-title">Edit lead status</h3>
                </div>
                <button
                  aria-label="Close status editor"
                  className="icon-button compact"
                  type="button"
                  onClick={() => setIsOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <form className="lead-profile-activity-form in-modal" onSubmit={(event) => void saveStatus(event)}>
                <label>
                  <span>Stage</span>
                  <select
                    value={selectedStatus}
                    onChange={(event) => setSelectedStatus(event.target.value as LeadRecord["status"])}
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Interested</option>
                    <option value="closed">Closed</option>
                    <option value="lost">Not interested</option>
                  </select>
                </label>
                <label>
                  <span>Priority</span>
                  <select
                    value={selectedUrgency}
                    onChange={(event) => setSelectedUrgency(event.target.value as NonNullable<LeadRecord["urgency"]>)}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <div className="card-actions">
                  <button className="primary-button small" type="submit" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save status"}
                  </button>
                  <button className="outline-button small" type="button" onClick={() => setIsOpen(false)}>
                    Cancel
                  </button>
                </div>
              </form>
              {message ? (
                <p className="form-status inline-status" role="status">
                  {message}
                </p>
              ) : null}
            </section>
          </div>
        </StatusEditorPortal>
      ) : null}
    </>
  );
}
