"use client";

import { ArrowUp, LoaderCircle, Mic, Plus, Square, X, type LucideIcon } from "lucide-react";
import type { FormEvent, ReactNode } from "react";

export type AgentComposerAction = {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
};

type AgentComposerMediaPreview = {
  id: string;
  mediaType: "image" | "video";
  name: string;
  previewUrl: string;
};

type AgentComposerProps = {
  actions?: AgentComposerAction[];
  className?: string;
  inputAriaLabel?: string;
  isListening?: boolean;
  isTranscribing?: boolean;
  media?: AgentComposerMediaPreview[];
  onAttach: () => void;
  onChange: (value: string) => void;
  onRemoveMedia?: (mediaId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onVoice: () => void;
  placeholder: string;
  sendDisabled?: boolean;
  value: string;
  voiceSlot?: ReactNode;
};

export function AgentComposer({
  actions,
  className = "",
  inputAriaLabel = "Ask Pislaka Agent",
  isListening = false,
  isTranscribing = false,
  media = [],
  onAttach,
  onChange,
  onRemoveMedia,
  onSubmit,
  onVoice,
  placeholder,
  sendDisabled = false,
  value,
  voiceSlot
}: AgentComposerProps) {
  return (
    <form className={`agent-composer ${className}`} onSubmit={onSubmit}>
      {media.length ? (
        <div className="agent-composer-media" aria-label="Selected media">
          {media.map((item) => (
            <div className="agent-composer-media-thumb" key={item.id}>
              {item.mediaType === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={item.name} src={item.previewUrl} />
              ) : (
                <video muted playsInline src={item.previewUrl} />
              )}
              <button
                aria-label={`Remove ${item.name}`}
                type="button"
                onClick={() => onRemoveMedia?.(item.id)}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="agent-composer-row">
        <button aria-label="Attach media" className="agent-composer-icon" type="button" onClick={onAttach}>
          <Plus size={21} />
        </button>
        {voiceSlot ? (
          voiceSlot
        ) : (
          <input
            aria-label={inputAriaLabel}
            className="agent-composer-input"
            placeholder={placeholder}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
        <button
          aria-label={isListening ? "Stop recording" : "Record voice"}
          aria-pressed={isListening}
          className={`agent-composer-voice ${isListening ? "recording" : ""}`}
          disabled={isTranscribing}
          type="button"
          onClick={onVoice}
        >
          {isTranscribing ? <LoaderCircle className="spin-icon" size={18} /> : isListening ? <Square size={15} /> : <Mic size={19} />}
        </button>
        <button aria-label="Send message" className="agent-composer-send" disabled={sendDisabled} type="submit">
          <ArrowUp size={20} />
        </button>
      </div>

      {actions?.length ? (
        <div className="agent-composer-actions" aria-label="Common Pislaka Agent tasks">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <button key={action.label} type="button" onClick={action.onClick}>
                <Icon size={18} />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </form>
  );
}
