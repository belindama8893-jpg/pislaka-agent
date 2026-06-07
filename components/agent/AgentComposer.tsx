"use client";

import { ArrowUp, LoaderCircle, Mic, Plus, Square, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";

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

type AgentComposerFilePreview = {
  id: string;
  name: string;
  sizeLabel: string;
};

export type AgentComposerContextPreview = {
  id: string;
  type: "listing" | "lead";
  label: string;
  summary: string;
};

type AgentComposerProps = {
  actions?: AgentComposerAction[];
  attachActions?: AgentComposerAction[];
  className?: string;
  contextAttachments?: AgentComposerContextPreview[];
  files?: AgentComposerFilePreview[];
  inputAriaLabel?: string;
  isListening?: boolean;
  isTranscribing?: boolean;
  media?: AgentComposerMediaPreview[];
  onAttach: () => void;
  onChange: (value: string) => void;
  onRemoveContext?: (contextId: string) => void;
  onRemoveFile?: (fileId: string) => void;
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
  attachActions,
  className = "",
  contextAttachments = [],
  files = [],
  inputAriaLabel = "Ask Pislaka Agent",
  isListening = false,
  isTranscribing = false,
  media = [],
  onAttach,
  onChange,
  onRemoveContext,
  onRemoveFile,
  onRemoveMedia,
  onSubmit,
  onVoice,
  placeholder,
  sendDisabled = false,
  value,
  voiceSlot
}: AgentComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
  }, [value]);

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function handleAttachClick() {
    if (attachActions?.length) {
      setIsAttachMenuOpen((current) => !current);
      return;
    }

    onAttach();
  }

  function runAttachAction(action: AgentComposerAction) {
    setIsAttachMenuOpen(false);
    action.onClick();
  }

  return (
    <form className={`agent-composer ${className}`} onSubmit={onSubmit}>
      {contextAttachments.length || files.length || media.length ? (
        <div className="agent-composer-attachments" aria-label="Selected attachments">
          {contextAttachments.map((item) => (
            <div className={`agent-composer-context-chip ${item.type}`} key={item.id}>
              <span>{item.type === "listing" ? "Listing" : "Lead"}</span>
              <strong>{item.label}</strong>
              <small>{item.summary}</small>
              <button
                aria-label={`Remove ${item.label}`}
                type="button"
                onClick={() => onRemoveContext?.(item.id)}
              >
                <X size={13} />
              </button>
            </div>
          ))}

          {files.map((item) => (
            <div className="agent-composer-file-chip" key={item.id}>
              <span>File</span>
              <strong>{item.name}</strong>
              <small>{item.sizeLabel}</small>
              <button
                aria-label={`Remove ${item.name}`}
                type="button"
                onClick={() => onRemoveFile?.(item.id)}
              >
                <X size={13} />
              </button>
            </div>
          ))}

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
        <div className="agent-composer-attach-wrap">
          <button
            aria-expanded={isAttachMenuOpen}
            aria-label="Add attachment"
            className="agent-composer-icon"
            type="button"
            onClick={handleAttachClick}
          >
          <Plus size={21} />
          </button>
          {isAttachMenuOpen && attachActions?.length ? (
            <div className="agent-attach-menu" role="menu">
              {attachActions.map((action) => {
                const Icon = action.icon;

                return (
                  <button key={action.label} role="menuitem" type="button" onClick={() => runAttachAction(action)}>
                    <Icon size={16} />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        {voiceSlot ? (
          voiceSlot
        ) : (
          <textarea
            ref={textareaRef}
            aria-label={inputAriaLabel}
            className="agent-composer-input"
            placeholder={placeholder}
            rows={1}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleTextareaKeyDown}
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
