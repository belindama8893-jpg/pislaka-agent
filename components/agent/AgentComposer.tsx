"use client";

import { ArrowUp, LoaderCircle, Mic, Plus, Square, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DragEvent, FormEvent, KeyboardEvent, ReactNode } from "react";

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
  label?: string;
  name: string;
  sizeLabel: string;
};

export type AgentComposerContextPreview = {
  id: string;
  type: "listing" | "lead";
  label: string;
  summary: string;
  media?: AgentComposerMediaPreview[];
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
  onFilesDropped?: (files: File[]) => void;
  onRemoveContext?: (contextId: string) => void;
  onRemoveFile?: (fileId: string) => void;
  onRemoveMedia?: (mediaId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onVoice: () => void;
  placeholder: string;
  sendDisabled?: boolean;
  topSlot?: ReactNode;
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
  onFilesDropped,
  onRemoveContext,
  onRemoveFile,
  onRemoveMedia,
  onSubmit,
  onVoice,
  placeholder,
  sendDisabled = false,
  topSlot,
  value,
  voiceSlot
}: AgentComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const attachWrapRef = useRef<HTMLDivElement | null>(null);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const hasInlineItems = Boolean(contextAttachments.length || files.length || media.length);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
  }, [value]);

  useEffect(() => {
    if (!isAttachMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || attachWrapRef.current?.contains(target)) {
        return;
      }

      setIsAttachMenuOpen(false);
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAttachMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAttachMenuOpen]);

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const nativeEvent = event.nativeEvent as KeyboardEvent["nativeEvent"] & {
      isComposing?: boolean;
    };
    if (isComposing || nativeEvent.isComposing || event.key === "Process") {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      if (isComposing || event.nativeEvent.isComposing) {
        return;
      }

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

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragActive(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.files.length) {
      setIsDragActive(false);
      return;
    }

    event.preventDefault();
    setIsDragActive(false);
    onFilesDropped?.(Array.from(event.dataTransfer.files));
  }

  return (
    <form className={`agent-composer ${className}`} onSubmit={onSubmit}>
      {topSlot}

      <div
        className={`agent-composer-row ${isDragActive ? "is-drag-active" : ""} ${hasInlineItems ? "has-inline-items" : ""}`}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {hasInlineItems ? (
        <div className="agent-composer-attachments" aria-label="Selected attachments">
          {contextAttachments.map((item) => (
            <div className={`agent-composer-context-chip ${item.type}`} key={item.id}>
              <span>{item.type === "listing" ? "Listing" : "Lead"}</span>
              <strong>{item.label}</strong>
              <small>{item.summary}</small>
              {item.media?.length ? (
                <div className="agent-composer-context-media" aria-label={`${item.label} media`}>
                  {item.media.map((media) => (
                    <span className="agent-composer-context-thumb" key={media.id}>
                      {media.mediaType === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt={media.name} src={media.previewUrl} />
                      ) : (
                        <video muted playsInline src={media.previewUrl} />
                      )}
                    </span>
                  ))}
                </div>
              ) : null}
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
              <span>{item.label ?? "File"}</span>
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
        <div className="agent-composer-attach-wrap" ref={attachWrapRef}>
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
            onCompositionEnd={() => setIsComposing(false)}
            onCompositionStart={() => setIsComposing(true)}
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
