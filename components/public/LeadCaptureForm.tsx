"use client";

import { type FormEvent, useState } from "react";
import { Check } from "lucide-react";

export function LeadCaptureForm({ campaignCode }: { campaignCode: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  function buildLeadMessage(formData: FormData) {
    const message = String(formData.get("message") || "").trim();
    const budget = String(formData.get("budget") || "").trim();
    const viewingWindow = String(formData.get("viewing_window") || "").trim();
    const contactPreference = String(formData.get("contact_preference") || "").trim();
    const buyerIntent = String(formData.get("buyer_intent") || "").trim();
    const context = [
      buyerIntent ? `Buyer intent: ${buyerIntent}` : null,
      budget ? `Budget: ${budget}` : null,
      viewingWindow ? `Preferred viewing: ${viewingWindow}` : null,
      contactPreference ? `Preferred contact: ${contactPreference}` : null
    ].filter(Boolean);

    return [message || "I am interested in this property. Please share more details.", ...context].join("\n");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitted) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);

    setIsSubmitting(true);
    setStatus("Sending inquiry...");

    const response = await fetch("/api/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        campaign_code: campaignCode,
        full_name: formData.get("full_name"),
        phone: formData.get("phone"),
        email: formData.get("email"),
        message: buildLeadMessage(formData)
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(payload?.error ?? "Unable to submit inquiry.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitted(true);
    setStatus("Inquiry sent. The broker will follow up soon.");
    setIsSubmitting(false);
  }

  return (
    <form className="lead-capture-form" onSubmit={handleSubmit}>
      <label>
        <span>Name</span>
        <input name="full_name" autoComplete="name" disabled={isSubmitting || isSubmitted} required />
      </label>
      <label>
        <span>Phone / WhatsApp</span>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          disabled={isSubmitting || isSubmitted}
          required
        />
      </label>
      <label>
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" disabled={isSubmitting || isSubmitted} />
      </label>
      <div className="lead-capture-grid">
        <label>
          <span>Budget</span>
          <input name="budget" placeholder="PKR 1 Crore" disabled={isSubmitting || isSubmitted} />
        </label>
        <label>
          <span>Viewing</span>
          <select name="viewing_window" defaultValue="" disabled={isSubmitting || isSubmitted}>
            <option value="">Select timing</option>
            <option value="Today">Today</option>
            <option value="Tomorrow">Tomorrow</option>
            <option value="This weekend">This weekend</option>
            <option value="Next week">Next week</option>
          </select>
        </label>
        <label>
          <span>Need</span>
          <select name="buyer_intent" defaultValue="" disabled={isSubmitting || isSubmitted}>
            <option value="">Select need</option>
            <option value="Buying for self">Buying for self</option>
            <option value="Investment">Investment</option>
            <option value="Family home">Family home</option>
            <option value="Rental inquiry">Rental inquiry</option>
          </select>
        </label>
        <label>
          <span>Contact</span>
          <select name="contact_preference" defaultValue="WhatsApp" disabled={isSubmitting || isSubmitted}>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Phone call">Phone call</option>
            <option value="SMS">SMS</option>
          </select>
        </label>
      </div>
      <label>
        <span>Question</span>
        <textarea
          name="message"
          defaultValue="I am interested in this property. Please share more details."
          disabled={isSubmitting || isSubmitted}
        />
      </label>
      <button className="primary-button" type="submit" disabled={isSubmitting || isSubmitted}>
        {isSubmitted ? (
          <>
            <Check size={16} /> Sent
          </>
        ) : isSubmitting ? (
          "Sending..."
        ) : (
          "Send inquiry"
        )}
      </button>
      {status ? <p className={`form-status${isSubmitted ? " success" : ""}`}>{status}</p> : null}
    </form>
  );
}
