import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Pencil,
  Check,
  X,
  FileText,
  FileSpreadsheet,
  FileCode,
  File,
  AlertTriangle,
  HelpCircle,
  Wrench,
  ChevronDown,
  Loader2,
  StopCircle,
  Trash2,
  Copy,
  RotateCw,
  Maximize2,
  Download,
  ExternalLink,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "./chat/CodeBlock";
import TableBlock from "./chat/TableBlock";
import MessageExportBar from "./chat/MessageExportBar";
import ImageLightbox from "./chat/ImageLightbox";

/**
 * Rich Error Card Component displaying why an exception occurred
 * and step-by-step guidance on how to fix it.
 */
function ErrorCard({ error, fallbackText, onSelectModel, onDelete }) {
  const [showTechnical, setShowTechnical] = useState(false);

  const err = error || {
    title: "Generation Error",
    message: fallbackText || "An unexpected error occurred while generating the response.",
    reason: "The AI service encountered an issue processing the request.",
    suggestion: "Please try again or select another model from the dropdown above.",
    code: "ERROR",
  };

  return (
    <div className="error-card" role="alert">
      <div className="error-card-header">
        <div className="error-card-badge">
          <AlertTriangle className="error-card-icon" size={17} />
          <span>{err.title || "Execution Error"}</span>
        </div>
        <div className="error-card-header-actions">
          {err.code && <span className="error-code-tag">{err.code}</span>}
          {onDelete && (
            <button
              type="button"
              className="error-card-delete-btn"
              onClick={onDelete}
              title="Delete error message"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="error-card-body">
        {err.message && (
          <p className="error-main-message">{err.message}</p>
        )}

        {err.reason && (
          <div className="error-section">
            <div className="error-section-label">
              <HelpCircle size={13} />
              <span>Why this happened:</span>
            </div>
            <p className="error-section-text">{err.reason}</p>
          </div>
        )}

        {err.suggestion && (
          <div className="error-section">
            <div className="error-section-label suggestion-label">
              <Wrench size={13} />
              <span>How to resolve:</span>
            </div>
            <div className="error-suggestion-box">
              {String(err.suggestion)
                .split("\n")
                .map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
            </div>
          </div>
        )}

        {/* Quick Action Button to switch to working free model */}
        {onSelectModel && (err.code === "QUOTA_EXCEEDED" || err.code === "OLLAMA_CONNECTION_ERROR" || err.code === "MODEL_NOT_FOUND" || err.code === "SERVICE_OVERLOADED") && (
          <div className="error-actions">
            {err.code === "SERVICE_OVERLOADED" ? (
              <button
                type="button"
                className="error-action-btn primary"
                onClick={() => {
                  const alt = (err.model || "").toLowerCase().includes("flash-lite")
                    ? "gemini-3.5-flash"
                    : "gemini-3.5-flash-lite";
                  onSelectModel(alt);
                }}
              >
                <Sparkles size={14} />
                Switch to {(err.model || "").toLowerCase().includes("flash-lite") ? "gemini-3.5-flash" : "gemini-3.5-flash-lite"}
              </button>
            ) : (
              <button
                type="button"
                className="error-action-btn primary"
                onClick={() => onSelectModel("gemini-3.5-flash")}
              >
                <Sparkles size={14} />
                Switch to gemini-3.5-flash (Free Tier)
              </button>
            )}
          </div>
        )}

        {/* Collapsible Technical Details */}
        {err.technical && (
          <div className="error-technical-wrapper">
            <button
              type="button"
              className="error-technical-toggle"
              onClick={() => setShowTechnical(!showTechnical)}
            >
              <span>{showTechnical ? "Hide Technical Details" : "Show Technical Details"}</span>
              <ChevronDown className={`tech-chevron ${showTechnical ? "rotate" : ""}`} size={14} />
            </button>
            {showTechnical && (
              <pre className="error-technical-log">{err.technical}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Gemini-style Thinking Indicator
 * Displays animated shimmer while thinking, and expandable thought steps when complete.
 */
function ThinkingIndicator({ model, thoughtContent = null, isThinking = false, isExpanded = false }) {
  const [expanded, setExpanded] = useState(isExpanded || isThinking);

  useEffect(() => {
    if (isThinking) {
      setExpanded(true);
    }
  }, [isThinking]);

  return (
    <div className="thinking-indicator">
      <button
        className="thinking-header"
        onClick={() => setExpanded((p) => !p)}
        type="button"
      >
        <div className="thinking-header-left">
          {isThinking ? (
            <Loader2 className="thinking-spinner" size={14} />
          ) : (
            <Sparkles size={14} style={{ color: "var(--primary)" }} />
          )}
          <span className="thinking-label">
            {isThinking
              ? "Thinking…"
              : `Thought Process${model ? ` (${model})` : ""}`}
          </span>
        </div>
        <ChevronDown
          className={`thinking-chevron ${expanded ? "expanded" : ""}`}
          size={13}
        />
      </button>
      {expanded && (
        <div className="thinking-body">
          {thoughtContent ? (
            <div className="thinking-text">{thoughtContent}</div>
          ) : (
            <div className="thinking-shimmer-lines">
              <div className="shimmer-line" style={{ width: "85%" }} />
              <div className="shimmer-line" style={{ width: "60%" }} />
              <div className="shimmer-line" style={{ width: "72%" }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ImageArtifact Component with Fullscreen Lightbox & Download
 */
function ImageArtifact({ src, alt }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const cleanName = (alt || "generated_image")
        .slice(0, 40)
        .replace(/[^a-zA-Z0-9_\-]/g, "_")
        .toLowerCase();
      if (src.startsWith("data:")) {
        const a = document.createElement("a");
        a.href = src;
        a.download = `${cleanName}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
      const res = await fetch(src);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${cleanName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(src, "_blank");
    }
  };

  if (loadError) {
    return (
      <div className="image-artifact-error">
        <AlertTriangle size={16} />
        <span>Failed to load image</span>
      </div>
    );
  }

  return (
    <>
      <div className="image-artifact-wrapper" onClick={() => setLightboxOpen(true)}>
        {!loaded && <div className="image-artifact-skeleton" />}
        <img
          src={src}
          alt={alt || "Generated AI Image"}
          className={`image-artifact-img ${loaded ? "visible" : ""}`}
          onLoad={() => setLoaded(true)}
          onError={() => setLoadError(true)}
          loading="lazy"
        />
        <div className="image-artifact-overlay">
          <button
            type="button"
            className="image-overlay-btn"
            onClick={() => setLightboxOpen(true)}
            title="View Fullscreen"
          >
            <Maximize2 size={13} />
            <span>Preview</span>
          </button>
          <button
            type="button"
            className="image-overlay-btn"
            onClick={handleDownload}
            title="Download Image"
          >
            <Download size={13} />
            <span>Save</span>
          </button>
        </div>
      </div>

      <ImageLightbox
        isOpen={lightboxOpen}
        imageUrl={src}
        prompt={alt}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}

/**
 * MessageBubble Component
 * 
 * Supports:
 * - Gemini-style thinking & reasoning accordion (<think>...</think> and SSE events)
 * - Hover edit button on user messages with in-place editor
 * - Animated streaming cursor
 * - CodeBlock artifacts with direct file download (.swift, .py, .sh, .php, etc.)
 * - TableBlock with direct Excel export (.xlsx) and CSV
 * - Gemini/ChatGPT export bar with Word (.docx), PDF, and Excel options
 * - Error cards with model-switching actions
 */
export default function MessageBubble({
  role,
  text,
  attachments = [],
  isEditable = false,
  onEdit = null,
  onDelete = null,
  onRegenerate = null,
  isError = false,
  errorDetails = null,
  onSelectModel = null,
  isStreaming = false,
  isThinking = false,
  thinkingModel = null,
  wasStopped = false,
}) {
  const isUser = role === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text || "");
  const [copiedUser, setCopiedUser] = useState(false);
  const textareaRef = useRef(null);

  // Extract reasoning/thought block if present (e.g. <think>...</think>)
  let thoughtContent = null;
  let cleanText = text || "";
  if (typeof text === "string" && text.includes("<think>")) {
    const thinkMatch = text.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
    if (thinkMatch) {
      thoughtContent = thinkMatch[1].trim();
      cleanText = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/, "").trim();
    }
  }

  // Detect whether this message represents an error
  const hasError =
    !isUser &&
    (isError ||
      Boolean(errorDetails) ||
      (typeof text === "string" && (
        text.startsWith("Error: ") ||
        text.startsWith("Sorry, something went wrong: ") ||
        text.startsWith("Quota Exceeded (429):")
      )));

  // Keep editing text in sync if text prop changes
  useEffect(() => {
    setEditText(text || "");
  }, [text]);

  // Auto-resize the editing textarea
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 240) + "px";
    }
  }, [isEditing, editText]);

  const handleSave = () => {
    if (editText.trim() && editText.trim() !== text && onEdit) {
      onEdit(editText.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditText(text || "");
    setIsEditing(false);
  };

  const handleCopyUserText = async () => {
    try {
      await navigator.clipboard.writeText(text || "");
      setCopiedUser(true);
      setTimeout(() => setCopiedUser(false), 2000);
    } catch (e) {
      console.error("Failed to copy user message:", e);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const renderAttachmentChip = (att, i) => {
    if (att.type === "image" && att.preview) {
      return (
        <div key={i} className="bubble-attachment-chip image-chip">
          <img src={att.preview} alt={att.name || "Attached Image"} />
        </div>
      );
    }
    if (att.type === "pdf") {
      return (
        <div key={i} className="bubble-attachment-chip pdf-chip">
          <FileText size={16} />
          <span>{att.name}</span>
        </div>
      );
    }
    if (att.type === "excel") {
      return (
        <div key={i} className="bubble-attachment-chip excel-chip">
          <FileSpreadsheet size={16} />
          <span>{att.name}</span>
        </div>
      );
    }
    if (att.type === "word") {
      return (
        <div key={i} className="bubble-attachment-chip word-chip">
          <FileCode size={16} />
          <span>{att.name}</span>
        </div>
      );
    }
    return (
      <div key={i} className="bubble-attachment-chip file-chip">
        <File size={16} />
        <span>{att.name}</span>
      </div>
    );
  };

  if (isEditing) {
    return (
      <div className="message user editing">
        <div className="message-inner">
          <div className="bubble edit-bubble">
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Edit your message..."
            />
            <div className="edit-actions">
              <button className="edit-btn save" onClick={handleSave} title="Save & Resubmit">
                <Check size={14} /> Save & Resubmit
              </button>
              <button className="edit-btn cancel" onClick={handleCancel} title="Cancel">
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`message ${isUser ? "user" : "assistant"} ${hasError ? "error-message" : ""}`}>
      <div className="message-inner">
        {isUser ? (
          <div className="bubble-wrapper">
            <div className="bubble">
              {attachments.length > 0 && (
                <div className="bubble-attachments">
                  {attachments.map((att, i) => renderAttachmentChip(att, i))}
                </div>
              )}
              <div>{text}</div>
            </div>
            {(isEditable || onDelete) && (
              <div className="message-action-group">
                {isEditable && (
                  <button
                    className="message-action-btn edit-trigger"
                    onClick={() => setIsEditing(true)}
                    title="Edit message"
                    type="button"
                  >
                    <Pencil size={12} />
                  </button>
                )}
                <button
                  className={`message-action-btn copy-trigger ${copiedUser ? "success" : ""}`}
                  onClick={handleCopyUserText}
                  title={copiedUser ? "Copied!" : "Copy text"}
                  type="button"
                >
                  {copiedUser ? <Check size={12} /> : <Copy size={12} />}
                </button>
                {onDelete && (
                  <button
                    className="message-action-btn delete-trigger"
                    onClick={onDelete}
                    title="Delete message"
                    type="button"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        ) : hasError ? (
          <>
            <div className="ai-avatar error-avatar">
              <AlertTriangle size={16} />
            </div>
            <ErrorCard
              error={errorDetails}
              fallbackText={text}
              onSelectModel={onSelectModel}
              onDelete={onDelete}
            />
          </>
        ) : (
          <>
            <div className="ai-avatar">
              <Sparkles />
            </div>
            <div className="bubble-wrapper assistant-wrapper">
              {/* Gemini-style Thinking Indicator / Reasoning Accordion */}
              {(isThinking || Boolean(thoughtContent)) && (
                <ThinkingIndicator
                  model={thinkingModel}
                  thoughtContent={thoughtContent}
                  isThinking={isThinking}
                  isExpanded={isThinking}
                />
              )}

              {/* Main response bubble */}
              {(!isThinking || (cleanText && cleanText.trim().length > 0)) && (
                <div className={`bubble markdown ${isStreaming ? "streaming" : ""}`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      img({ node, src, alt, ...props }) {
                        return <ImageArtifact src={src} alt={alt} />;
                      },
                      table({ children, ...props }) {
                        return <TableBlock {...props}>{children}</TableBlock>;
                      },
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const lang = match ? match[1] : "";
                        const rawCode = String(children || "").replace(/\n$/, "");
                        const meta = node?.data?.meta || "";
                        return (
                          <CodeBlock
                            language={lang}
                            value={rawCode}
                            inline={inline}
                            meta={meta}
                          />
                        );
                      },
                    }}
                  >
                    {cleanText}
                  </ReactMarkdown>
                  {/* Blinking streaming cursor */}
                  {isStreaming && <span className="streaming-cursor" />}
                </div>
              )}

              {/* Stopped message indicator */}
              {wasStopped && (
                <div className="stopped-indicator-wrapper">
                  <div className="stopped-indicator">
                    <StopCircle size={12} />
                    <span>Generation stopped</span>
                  </div>
                  {onRegenerate && (
                    <button
                      type="button"
                      className="regenerate-stopped-btn"
                      onClick={onRegenerate}
                      title="Regenerate response"
                    >
                      <RotateCw size={12} />
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              )}

              {/* Export actions bar */}
              {!isStreaming && !isThinking && cleanText && cleanText.trim().length > 0 && (
                <MessageExportBar
                  text={cleanText}
                  onDelete={onDelete}
                  onRegenerate={onRegenerate}
                />
              )}

              {/* Fallback actions if export bar is not shown */}
              {!isStreaming && !isThinking && (!cleanText || cleanText.trim().length === 0) && (onDelete || onRegenerate) && (
                <div className="gemini-message-footer">
                  <div className="gemini-action-group">
                    {onRegenerate && (
                      <button
                        type="button"
                        className="gemini-icon-btn regenerate-btn"
                        onClick={onRegenerate}
                        title="Regenerate response"
                      >
                        <RotateCw size={13} />
                        <span>Retry</span>
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        className="gemini-icon-btn delete-msg-btn"
                        onClick={onDelete}
                        title="Delete this message"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
