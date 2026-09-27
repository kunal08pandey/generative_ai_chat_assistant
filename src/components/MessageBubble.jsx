import { useState, useRef, useEffect } from "react";
import { Sparkles, Pencil, Check, X, FileText, FileSpreadsheet, FileCode, File, Image as ImageIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * role: "user" | "assistant"
 * text: message content string
 * attachments: array of attached files/images [{ type, preview, name }]
 * isEditable: true if this message can be edited and resubmitted
 * onEdit: callback function (newText) to trigger resubmission
 */
export default function MessageBubble({ role, text, attachments = [], isEditable, onEdit }) {
    const isUser = role === "user";
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(text);
    const textareaRef = useRef(null);

    // Keep editing text in sync if the text prop updates
    useEffect(() => {
        setEditText(text);
    }, [text]);

    // Auto-resize the editing textarea to fit content
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 240) + "px";
        }
    }, [isEditing, editText]);

    const handleSave = () => {
        if (editText.trim() && editText.trim() !== text) {
            onEdit(editText.trim());
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditText(text);
        setIsEditing(false);
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
        <div className={`message ${isUser ? "user" : "assistant"}`}>
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
                        {isEditable && (
                            <button
                                className="message-action-btn edit-trigger"
                                onClick={() => setIsEditing(true)}
                                title="Edit message"
                            >
                                <Pencil size={12} />
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="ai-avatar">
                            <Sparkles />
                        </div>
                        <div className="bubble markdown">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
