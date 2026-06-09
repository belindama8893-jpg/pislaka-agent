"use client";

import { type FormEvent, useState } from "react";
import {
  Check,
  Copy,
  Edit3,
  Home,
  ImageIcon,
  Megaphone,
  MessageCircle,
  Save,
  Sparkles,
  Upload,
  Video
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ListingRecord } from "@/lib/listings/types";
import type { ListingPromotion } from "@/lib/promotions/types";

type ListingDraftsPanelProps = {
  listings: ListingRecord[];
  className?: string;
  collapsed?: boolean;
};

type EditState = {
  title: string;
  location_area: string;
  price_amount: string;
  bedrooms: string;
  bathrooms: string;
  status: ListingRecord["status"];
};

function formatPrice(listing: ListingRecord) {
  if (!listing.price_amount) {
    return "Price not set";
  }

  const crore = listing.price_amount / 10000000;
  if (crore >= 1) {
    return `${listing.price_currency ?? "PKR"} ${crore.toFixed(crore % 1 === 0 ? 0 : 1)} Crore`;
  }

  return `${listing.price_currency ?? "PKR"} ${listing.price_amount.toLocaleString("en-PK")}`;
}

function getInitialEditState(listing: ListingRecord): EditState {
  return {
    title: listing.title ?? "",
    location_area: listing.location_area ?? "",
    price_amount: listing.price_amount ? String(Math.round(listing.price_amount)) : "",
    bedrooms: listing.bedrooms === null ? "" : String(listing.bedrooms),
    bathrooms: listing.bathrooms === null ? "" : String(listing.bathrooms),
    status: listing.status
  };
}

export function ListingDraftsPanel({ className = "", collapsed = false, listings }: ListingDraftsPanelProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promotions, setPromotions] = useState<Record<string, ListingPromotion>>({});

  function startEditing(listing: ListingRecord) {
    setEditingId(listing.id);
    setEditState(getInitialEditState(listing));
    setStatus(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditState(null);
    setStatus(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>, listingId: string) {
    event.preventDefault();
    if (!editState) {
      return;
    }

    setStatus("Saving listing...");
    const response = await fetch("/api/listings/draft", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: listingId,
        title: editState.title,
        location_area: editState.location_area,
        price_amount: editState.price_amount ? Number(editState.price_amount) : undefined,
        bedrooms: editState.bedrooms ? Number(editState.bedrooms) : undefined,
        bathrooms: editState.bathrooms ? Number(editState.bathrooms) : undefined,
        status: editState.status
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(payload?.error ?? "Unable to save listing");
      return;
    }

    setStatus("Listing saved.");
    cancelEditing();
    router.refresh();
  }

  async function handleMediaUpload(listingId: string, file: File | undefined) {
    if (!file) {
      return;
    }

    setUploadingId(listingId);
    setStatus("Uploading media...");

    const formData = new FormData();
    formData.append("listing_id", listingId);
    formData.append("file", file);

    const response = await fetch("/api/listings/media", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(payload?.error ?? "Unable to upload media");
      setUploadingId(null);
      return;
    }

    setStatus("Media uploaded.");
    setUploadingId(null);
    router.refresh();
  }

  async function handlePromote(listingId: string) {
    setPromotingId(listingId);
    setStatus("Generating promotion pack...");

    const response = await fetch("/api/agent/promote-listing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ listing_id: listingId })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(payload?.error ?? "Unable to generate promotion pack");
      setPromotingId(null);
      return;
    }

    const payload = (await response.json()) as { promotion: ListingPromotion };
    setPromotions((current) => ({ ...current, [listingId]: payload.promotion }));
    setStatus("Promotion pack ready.");
    setPromotingId(null);
  }

  async function copyPromotionText(text: string) {
    await navigator.clipboard.writeText(text);
    setStatus("Copied promotion copy.");
  }

  const header = (
    <div className="widget-header">
      <h3>
        <Home size={18} /> Listing Library
      </h3>
      <span className="count-pill">{listings.length}</span>
    </div>
  );

  const content = (
    <>
      {listings.length === 0 ? (
        <p className="empty-state">Confirmed listing drafts will appear here for review, editing, and media uploads.</p>
      ) : (
        <div className="listing-stack">
          {listings.map((listing) => {
            const locationLabel =
              [listing.location_area, listing.city].filter(Boolean).join(", ") || "Location not set";
            const propertyLabel = [listing.property_type, listing.listing_type]
              .filter(Boolean)
              .join(" · ");
            const areaLabel = listing.area_value
              ? `${listing.area_value} ${listing.area_unit ?? ""}`.trim()
              : "Area not set";
            const mediaItems = listing.media ?? [];
            const mediaCount = mediaItems.length;

            return editingId === listing.id && editState ? (
              <form
                className="listing-edit-card"
                key={listing.id}
                onSubmit={(event) => handleSubmit(event, listing.id)}
              >
                <label>
                  <span>Title</span>
                  <input
                    required
                    value={editState.title}
                    onChange={(event) => setEditState({ ...editState, title: event.target.value })}
                  />
                </label>
                <label>
                  <span>Area</span>
                  <input
                    value={editState.location_area}
                    onChange={(event) =>
                      setEditState({ ...editState, location_area: event.target.value })
                    }
                  />
                </label>
                <div className="listing-edit-grid">
                  <label>
                    <span>Price</span>
                    <input
                      min="1"
                      type="number"
                      value={editState.price_amount}
                      onChange={(event) =>
                        setEditState({ ...editState, price_amount: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Status</span>
                    <select
                      value={editState.status}
                      onChange={(event) =>
                        setEditState({
                          ...editState,
                          status: event.target.value as ListingRecord["status"]
                        })
                      }
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>
                  <label>
                    <span>Beds</span>
                    <input
                      min="0"
                      type="number"
                      value={editState.bedrooms}
                      onChange={(event) =>
                        setEditState({ ...editState, bedrooms: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Baths</span>
                    <input
                      min="0"
                      type="number"
                      value={editState.bathrooms}
                      onChange={(event) =>
                        setEditState({ ...editState, bathrooms: event.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="listing-edit-media" aria-label="Listing media">
                  <div className="listing-edit-media-header">
                    <span>Photos & video</span>
                    <small>{mediaCount ? `${mediaCount} media` : "No media yet"}</small>
                  </div>
                  {mediaCount ? (
                    <div className="listing-media-strip listing-edit-media-strip">
                      {mediaItems.slice(0, 6).map((media) => (
                        <div className="listing-media-thumb" key={media.id}>
                          {media.signed_url && media.media_type === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img alt="" src={media.signed_url} />
                          ) : media.signed_url && media.media_type === "video" ? (
                            <video muted playsInline preload="metadata" src={media.signed_url} />
                          ) : media.media_type === "video" ? (
                            <Video size={16} />
                          ) : (
                            <ImageIcon size={16} />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="listing-media-empty">
                      Add listing photos or a walkthrough video while editing this property.
                    </span>
                  )}
                  <label className="outline-button small listing-upload-button">
                    <Upload size={14} /> {uploadingId === listing.id ? "Uploading..." : "Add photos/video"}
                    <input
                      accept="image/*,video/*"
                      disabled={uploadingId === listing.id}
                      type="file"
                      onChange={(event) => {
                        void handleMediaUpload(listing.id, event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <div className="card-actions">
                  <button className="primary-button small" type="submit">
                    <Save size={15} /> Save
                  </button>
                  <button className="outline-button small" type="button" onClick={cancelEditing}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <article className="listing-row" id={`listing-${listing.id}`} key={listing.id}>
                <div className="listing-row-main">
                  <div className="listing-row-titleline">
                    <strong>{listing.title || "Untitled listing"}</strong>
                    <span className={`listing-status ${listing.status}`}>{listing.status}</span>
                  </div>
                  <p>{locationLabel}</p>
                  <div className="listing-row-context">
                    <span>{propertyLabel || "Property type not set"}</span>
                    <span>{areaLabel}</span>
                  </div>
                </div>

                <div className="listing-row-price">
                  <span>Price</span>
                  <strong>{formatPrice(listing)}</strong>
                </div>

                <div className="listing-row-facts">
                  <span>{listing.bedrooms ?? "-"} beds</span>
                  <span>{listing.bathrooms ?? "-"} baths</span>
                </div>

                <div className="listing-row-media">
                  {mediaCount ? (
                    <div className="listing-media-strip">
                      {mediaItems.slice(0, 3).map((media) => (
                        <div className="listing-media-thumb" key={media.id}>
                          {media.signed_url && media.media_type === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img alt="" src={media.signed_url} />
                          ) : media.signed_url && media.media_type === "video" ? (
                            <video muted playsInline preload="metadata" src={media.signed_url} />
                          ) : media.media_type === "video" ? (
                            <Video size={16} />
                          ) : (
                            <ImageIcon size={16} />
                          )}
                        </div>
                      ))}
                      <span>{mediaCount} media</span>
                    </div>
                  ) : (
                    <span className="listing-media-empty">No media</span>
                  )}
                </div>

                <div className="listing-row-actions">
                  <button
                    className="outline-button small"
                    type="button"
                    onClick={() => router.push(`/?listing=${listing.id}`)}
                  >
                    <MessageCircle size={14} /> Ask Agent
                  </button>
                  <button
                    className="outline-button small"
                    type="button"
                    onClick={() => router.push(`/?listing=${listing.id}&mode=edit`)}
                  >
                    <Sparkles size={14} /> AI Edit
                  </button>
                  <button className="outline-button small" type="button" onClick={() => startEditing(listing)}>
                    <Edit3 size={14} /> Edit
                  </button>
                  <button
                    className="outline-button small"
                    type="button"
                    onClick={() => void handlePromote(listing.id)}
                    disabled={promotingId === listing.id}
                  >
                    <Megaphone size={14} /> {promotingId === listing.id ? "Generating..." : "Promote"}
                  </button>
                </div>

                {promotions[listing.id] ? (
                  <div className="promotion-pack">
                    <div className="promotion-summary">{promotions[listing.id].summary}</div>
                    <div className="promotion-grid">
                      {promotions[listing.id].cards.map((card) => {
                        const selectedMedia = listing.media?.find(
                          (media) => media.id === card.selected_media_id
                        );
                        return (
                          <article className="promotion-card" key={card.channel}>
                            <div className="promotion-card-header">
                              <span>{card.channel}</span>
                              <button
                                className="icon-button compact"
                                type="button"
                                aria-label={`Copy ${card.channel} promotion`}
                                onClick={() =>
                                  void copyPromotionText(`${card.title}\n\n${card.body}\n\n${card.cta}`)
                                }
                              >
                                <Copy size={14} />
                              </button>
                            </div>
                            <strong>{card.title}</strong>
                            <p>{card.body}</p>
                            <small>{card.cta}</small>
                            <div className="promotion-media-brief">
                              {selectedMedia?.signed_url ? (
                                <div className="listing-media-thumb">
                                  {selectedMedia.media_type === "image" ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img alt="" src={selectedMedia.signed_url} />
                                  ) : (
                                    <video muted playsInline preload="metadata" src={selectedMedia.signed_url} />
                                  )}
                                </div>
                              ) : null}
                              <span>{card.image_brief}</span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {status ? (
        <p className="form-status inline-status">
          <Check size={14} /> {status}
        </p>
      ) : null}
    </>
  );

  if (collapsed) {
    return (
      <details className={`listing-library listing-library-collapsed glass-panel ${className}`}>
        <summary className="listing-library-summary">
          <span className="listing-library-summary-title">
            <Home size={18} /> Listing Library
          </span>
          <span className="count-pill">{listings.length}</span>
          <span className="listing-library-summary-action">View and edit listings</span>
        </summary>
        <div className="listing-library-body">{content}</div>
      </details>
    );
  }

  return (
    <section className={`listing-library glass-panel ${className}`}>
      {header}
      {content}
    </section>
  );
}
