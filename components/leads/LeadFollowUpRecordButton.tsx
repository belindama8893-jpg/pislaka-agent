"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FilePlus2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FollowUpChannel } from "@/lib/leads/types";

type LeadFollowUpRecordButtonProps = {
  leadId: string;
};

function FollowUpRecordPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(children, document.body);
}

export function LeadFollowUpRecordButton({ leadId }: LeadFollowUpRecordButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [channel, setChannel] = useState<FollowUpChannel>("whatsapp");
  const [summary, setSummary] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function saveFollowUpActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!summary.trim()) {
      setStatusMessage("Write a follow-up record first.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("Saving follow-up record...");

    const response = await fetch("/api/leads/followup-activities", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        activity_type: "note_added",
        channel,
        lead_id: leadId,
        source_type: "manual",
        summary: summary.trim()
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatusMessage(payload?.error ?? "Unable to save follow-up record.");
      setIsSaving(false);
      return;
    }

    setChannel("whatsapp");
    setSummary("");
    setStatusMessage(null);
    setIsSaving(false);
    setIsOpen(false);
    router.refresh();
  }

  return (
    <>
      <button className="outline-button small" type="button" onClick={() => setIsOpen(true)}>
        <FilePlus2 size={14} /> Add record
      </button>

      {isOpen ? (
        <FollowUpRecordPortal>
          <div className="lead-modal-backdrop" role="presentation" onClick={() => setIsOpen(false)}>
            <section
              aria-labelledby="lead-followup-modal-title"
              className="lead-modal"
              role="dialog"
              aria-modal="true"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="lead-modal-header">
                <div>
                  <span>Follow-up</span>
                  <h3 id="lead-followup-modal-title">Add follow-up record</h3>
                </div>
                <button
                  aria-label="Close follow-up record"
                  className="icon-button compact"
                  type="button"
                  onClick={() => setIsOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>

              <form className="lead-profile-activity-form in-modal" onSubmit={(event) => void saveFollowUpActivity(event)}>
                <label>
                  <span>Channel</span>
                  <select value={channel} onChange={(event) => setChannel(event.target.value as FollowUpChannel)}>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="phone">Phone</option>
                    <option value="in_person">In person</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>
                  <span>Record</span>
                  <textarea
                    autoFocus
                    placeholder="Customer asked for a Phase 6 option under 4.5 crore..."
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                  />
                </label>
                <div className="card-actions">
                  <button className="primary-button small" type="submit" disabled={isSaving}>
                    <FilePlus2 size={14} /> {isSaving ? "Saving..." : "Add record"}
                  </button>
                  <button className="outline-button small" type="button" onClick={() => setIsOpen(false)}>
                    Cancel
                  </button>
                </div>
              </form>

              {statusMessage ? (
                <p className="form-status inline-status" role="status">
                  {statusMessage}
                </p>
              ) : null}
            </section>
          </div>
        </FollowUpRecordPortal>
      ) : null}
    </>
  );
}
