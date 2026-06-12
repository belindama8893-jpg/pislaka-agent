"use client";

import { type FormEvent, useState } from "react";
import { CalendarClock, Check, Edit3, Mail, Phone, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { LeadListItem } from "@/lib/leads/types";

type LeadProfileEditorProps = {
  lead: LeadListItem;
};

type LeadEditState = {
  email: string;
  full_name: string;
  phone: string;
};

function getInitialEditState(lead: LeadListItem): LeadEditState {
  return {
    email: lead.email ?? "",
    full_name: lead.full_name ?? "",
    phone: lead.phone ?? ""
  };
}

function getLeadSource(lead: LeadListItem) {
  return lead.campaign_channel ?? lead.source_channel ?? "Unknown source";
}

export function LeadProfileEditor({ lead }: LeadProfileEditorProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<LeadEditState>(() => getInitialEditState(lead));
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  function updateEditState<K extends keyof LeadEditState>(key: K, value: LeadEditState[K]) {
    setEditState((current) => ({ ...current, [key]: value }));
  }

  function cancelEdit() {
    setEditState(getInitialEditState(lead));
    setStatusMessage(null);
    setIsEditing(false);
  }

  async function saveLeadDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingLead(true);
    setStatusMessage("Saving customer information...");

    const response = await fetch("/api/leads", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: lead.id,
        email: editState.email.trim() || null,
        full_name: editState.full_name.trim() || undefined,
        phone: editState.phone.trim() || undefined
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatusMessage(payload?.error ?? "Unable to save customer information.");
      setIsSavingLead(false);
      return;
    }

    setStatusMessage("Customer information saved.");
    setIsSavingLead(false);
    setIsEditing(false);
    router.refresh();
  }

  return (
    <section className="lead-profile-section lead-profile-editor" aria-labelledby="lead-edit-title">
      <div className="lead-profile-section-header">
        <h3 id="lead-edit-title">
          <UserRound size={17} /> Customer information
        </h3>
        {isEditing ? (
          <button aria-label="Cancel editing customer information" className="icon-button compact" type="button" onClick={cancelEdit}>
            <X size={15} />
          </button>
        ) : (
          <button aria-label="Edit customer information" className="icon-button compact" type="button" onClick={() => setIsEditing(true)}>
            <Edit3 size={15} />
          </button>
        )}
      </div>

      {isEditing ? (
        <form className="lead-profile-form lead-profile-contact-form" onSubmit={(event) => void saveLeadDetails(event)}>
          <label>
            <span>Name</span>
            <input
              value={editState.full_name}
              onChange={(event) => updateEditState("full_name", event.target.value)}
            />
          </label>
          <label>
            <span>Phone</span>
            <input value={editState.phone} onChange={(event) => updateEditState("phone", event.target.value)} />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={editState.email}
              onChange={(event) => updateEditState("email", event.target.value)}
            />
          </label>
          <div className="card-actions">
            <button className="primary-button small" type="submit" disabled={isSavingLead}>
              <Check size={14} /> {isSavingLead ? "Saving..." : "Save"}
            </button>
            <button className="outline-button small" type="button" onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="lead-contact-list">
          <span>
            <UserRound size={14} /> {lead.full_name || "Unnamed buyer"}
          </span>
          <span>
            <Phone size={14} /> {lead.phone || "No phone"}
          </span>
          <span>
            <Mail size={14} /> {lead.email || "No email"}
          </span>
          <span>
            <CalendarClock size={14} /> {getLeadSource(lead)}
            {lead.campaign_code ? ` · ${lead.campaign_code}` : ""}
          </span>
        </div>
      )}

      {statusMessage ? (
        <p className="form-status inline-status" role="status">
          {statusMessage}
        </p>
      ) : null}
    </section>
  );
}
