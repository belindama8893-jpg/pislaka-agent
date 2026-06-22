"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ChevronLeft, ChevronRight, LoaderCircle, X } from "lucide-react";

export type AgentMediaGalleryItem = {
  alt?: string;
  id: string;
  label: string;
  mediaType?: "image" | "video" | "placeholder";
  onRemove?: () => void;
  removeDisabled?: boolean;
  removeLabel?: string;
  sourceLabel?: string;
  src?: string;
  status?: "pending" | "uploading" | "uploaded" | "failed";
};

type AgentMediaGalleryProps = {
  addMediaButton?: ReactNode;
  items: AgentMediaGalleryItem[];
  label?: string;
  maxVisible?: number;
};

function getStatusIcon(status?: AgentMediaGalleryItem["status"]) {
  if (status === "uploading") {
    return <LoaderCircle className="spin-icon" size={16} />;
  }

  if (status === "uploaded") {
    return <CheckCircle2 size={16} />;
  }

  if (status === "failed") {
    return <X size={15} />;
  }

  return null;
}

export function AgentMediaGallery({ addMediaButton, items, label = "Listing media", maxVisible = 4 }: AgentMediaGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const hasOverflow = items.length > maxVisible;
  const visibleItems = hasOverflow && !isExpanded ? items.slice(0, maxVisible) : items;
  const moreCount = hasOverflow ? Math.max(0, items.length - (maxVisible - 1)) : 0;
  const activeItem = activeIndex === null ? null : items[activeIndex] ?? null;

  function openAt(index: number) {
    if (!items[index]) {
      return;
    }

    setActiveIndex(index);
  }

  function step(delta: number) {
    setActiveIndex((current) => {
      if (current === null || !items.length) {
        return current;
      }

      return (current + delta + items.length) % items.length;
    });
  }

  return (
    <div className="agent-media-gallery" aria-label={label}>
      <div className="agent-media-preview draft-grid">
        {visibleItems.map((item, index) => {
          const statusIcon = getStatusIcon(item.status);
          const isMoreTrigger = hasOverflow && !isExpanded && index === maxVisible - 1;

          return (
            <button
              aria-label={isMoreTrigger ? `Show ${moreCount} more media` : `Preview ${item.label}`}
              className={`agent-media-thumb agent-media-thumb-button ${item.status ?? ""} ${item.src ? "" : "placeholder"} ${isMoreTrigger ? "agent-media-has-more" : ""}`.trim()}
              key={item.id}
              onClick={() => {
                if (isMoreTrigger) {
                  setIsExpanded(true);
                  return;
                }

                openAt(index);
              }}
              type="button"
            >
              {item.src ? (
                item.mediaType === "video" ? (
                  <video muted playsInline src={item.src} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={item.alt ?? item.label} src={item.src} referrerPolicy="no-referrer" />
                )
              ) : (
                <span>{item.label}</span>
              )}
              {item.sourceLabel ? <span className="agent-media-source">{item.sourceLabel}</span> : null}
              {statusIcon ? (
                <span className="agent-media-upload-state" aria-label={`${item.label} ${item.status}`}>
                  {statusIcon}
                </span>
              ) : null}
              {isMoreTrigger ? (
                <span className="agent-media-more-overlay" aria-hidden="true">
                  <strong>+{moreCount}</strong>
                  <small>More</small>
                </span>
              ) : null}
              {item.onRemove ? (
                <span
                  aria-label={item.removeLabel ?? `Remove ${item.label}`}
                  className="agent-media-remove"
                  role="button"
                  tabIndex={item.removeDisabled ? -1 : 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!item.removeDisabled) {
                      item.onRemove?.();
                    }
                  }}
                  onKeyDown={(event) => {
                    if (item.removeDisabled || (event.key !== "Enter" && event.key !== " ")) {
                      return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    item.onRemove?.();
                  }}
                >
                  <X size={13} />
                </span>
              ) : null}
            </button>
          );
        })}
        {!hasOverflow || isExpanded ? (
          addMediaButton
        ) : (
          null
        )}
      </div>
      {hasOverflow && !isExpanded && addMediaButton ? <div className="agent-media-gallery-add-row">{addMediaButton}</div> : null}
      {activeItem && typeof document !== "undefined" ? createPortal(
        <div className="agent-media-lightbox" role="dialog" aria-modal="true" aria-label={activeItem.label}>
          <button className="agent-media-lightbox-backdrop" type="button" aria-label="Close media preview" onClick={() => setActiveIndex(null)} />
          <div className="agent-media-lightbox-panel">
            <div className="agent-media-lightbox-header">
              <span>{activeIndex !== null ? `${activeIndex + 1} / ${items.length}` : null}</span>
              <strong>{activeItem.label}</strong>
              <button type="button" aria-label="Close media preview" onClick={() => setActiveIndex(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="agent-media-lightbox-stage">
              {activeItem.src ? (
                activeItem.mediaType === "video" ? (
                  <video controls src={activeItem.src} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={activeItem.alt ?? activeItem.label} src={activeItem.src} referrerPolicy="no-referrer" />
                )
              ) : (
                <div className="agent-media-lightbox-placeholder">{activeItem.label}</div>
              )}
            </div>
            {items.length > 1 ? (
              <div className="agent-media-lightbox-controls">
                <button type="button" onClick={() => step(-1)}>
                  <ChevronLeft size={18} />
                  <span>Previous</span>
                </button>
                <button type="button" onClick={() => step(1)}>
                  <span>Next</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            ) : null}
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
