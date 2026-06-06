"use client";

import { type FormEvent, useState } from "react";
import { Building2, Languages, MapPin, Phone, Save, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

type BrokerProfile = {
  full_name: string | null;
  city: string | null;
  agency_name: string | null;
  phone: string | null;
  preferred_language: string | null;
};

type ProfileCompletionFormProps = {
  profile: BrokerProfile;
};

export function ProfileCompletionForm({ profile }: ProfileCompletionFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [city, setCity] = useState(profile.city ?? "Lahore");
  const [agencyName, setAgencyName] = useState(profile.agency_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [preferredLanguage, setPreferredLanguage] = useState(
    profile.preferred_language ?? "english_roman_urdu"
  );
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setIsSubmitting(true);

    const response = await fetch("/api/profile/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        full_name: fullName,
        city,
        agency_name: agencyName,
        phone,
        preferred_language: preferredLanguage
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(payload?.error ?? "Unable to save profile");
      setIsSubmitting(false);
      return;
    }

    setStatus("Profile saved.");
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <section className="profile-completion glass-panel" aria-label="Complete broker profile">
      <div>
        <p className="eyebrow">First-run setup</p>
        <h2>Complete your broker profile</h2>
        <p>
          This information powers listing drafts, WhatsApp copy, and lead follow-up context.
        </p>
      </div>

      <form className="profile-form" onSubmit={handleSubmit}>
        <label>
          <span>Full name</span>
          <div className="profile-input">
            <UserRound size={17} />
            <input
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
        </label>

        <label>
          <span>City</span>
          <div className="profile-input">
            <MapPin size={17} />
            <input required value={city} onChange={(event) => setCity(event.target.value)} />
          </div>
        </label>

        <label>
          <span>Agency</span>
          <div className="profile-input">
            <Building2 size={17} />
            <input
              required
              value={agencyName}
              onChange={(event) => setAgencyName(event.target.value)}
            />
          </div>
        </label>

        <label>
          <span>Phone</span>
          <div className="profile-input">
            <Phone size={17} />
            <input
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
        </label>

        <label>
          <span>Language</span>
          <div className="profile-input">
            <Languages size={17} />
            <select
              value={preferredLanguage}
              onChange={(event) => setPreferredLanguage(event.target.value)}
            >
              <option value="english_roman_urdu">English + Roman Urdu</option>
              <option value="urdu">Urdu</option>
              <option value="english">English</option>
            </select>
          </div>
        </label>

        <button className="primary-button" disabled={isSubmitting} type="submit">
          <Save size={17} /> Save profile
        </button>
      </form>

      {status ? <p className="form-status">{status}</p> : null}
    </section>
  );
}
