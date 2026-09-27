import { useState, useRef, useEffect } from "react";
import { sendChatStream, parseSSEStream, uploadFile, updateConversationTitle, rollbackConversation, generateImage } from "../../api/client";
import MessageBubble from "../MessageBubble";
import WelcomeScreen from "./Welcome";
import { Paperclip, Send, X, File, Square, Image as ImageIcon } from "lucide-react";

export default function ChatWindow({
    messages,
    setMessages,
    selectedConversationId,
    model,
    setModel,
    isReady,
    initializationError,
    onTitleUpdate,
    isTitled,           // true once conversation has been given a real title
}) {
    const [input, setInput] = useState("");
    const [images, setImages] = useState([]); // Array of { name, base64, preview }
    const [files, setFiles] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasResponseStarted, setHasResponseStarted] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const textareaRef = useRef(null);
    const bottomRef = useRef(null);
    const fileInputRef = useRef(null);
    const abortControllerRef = useRef(null);
    const selectedConversationRef = useRef(selectedConversationId);
    const imagesRef = useRef(images);

    const convertToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                // Remove the data:image/png;base64, prefix
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const handleSuggestionClick = (text) => {
        setInput(text);
        textareaRef.current?.focus();
    };

    useEffect(() => {
        imagesRef.current = images;
    }, [images]);

    useEffect(() => {
        selectedConversationRef.current = selectedConversationId;
    }, [selectedConversationId]);

    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const attachmentMenuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(e.target)) {
                setShowAttachmentMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => () => {
        abortControllerRef.current?.abort();
        imagesRef.current.forEach((image) => URL.revokeObjectURL(image.preview));
    }, []);

    const messagesContainerRef = useRef(null);
    const isUserScrolledUpRef = useRef(false);

    // Detect user manual scrolling: pause auto-scroll if user scrolls up away from bottom
    const handleScroll = () => {
        const el = messagesContainerRef.current;
        if (!el) return;
        const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        isUserScrolledUpRef.current = distanceToBottom > 80;
    };

    // Direct DOM scroll position pinning without smooth animation jumps
    useEffect(() => {
        const el = messagesContainerRef.current;
        if (el && !isUserScrolledUpRef.current) {
            el.scrollTop = el.scrollHeight;
        }
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    }, [input]);

    const handleFileSelect = async (e) => {
        const selected = Array.from(e.target.files || []);
        await processFiles(selected);
        e.target.value = "";
    };

    const processFiles = async (selected) => {
        for (const file of selected) {
            const isImage = file.type.startsWith('image/');
            if (isImage) {
                const base64 = await convertToBase64(file);
                const preview = URL.createObjectURL(file);
                setImages((prev) => [...prev, { name: file.name, base64, preview }]);
            } else {
                const suffix = file.name.split('.').pop().toLowerCase();
                if (
                    ['pdf', 'docx', 'txt', 'xlsx', 'xls', 'xlsm', 'xltx', 'xltm'].includes(suffix) ||
                    file.type.startsWith('text/') ||
                    file.type.includes('spreadsheet') ||
                    file.type.includes('excel') ||
                    file.type.includes('word')
                ) {
                    setFiles((prev) => [...prev, file]);
                } else {
                    alert(`Unsupported file format: ${file.name}`);
                }
            }
        }
    };

    const removeFile = (idx) => {
        setFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    const removeImage = (idx) => {
        setImages((prev) => {
            const newImages = [...prev];
            URL.revokeObjectURL(newImages[idx].preview);
            return newImages.filter((_, i) => i !== idx);
        });
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isReady && !isLoading) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (!isReady || isLoading) return;

        const droppedFiles = Array.from(e.dataTransfer.files || []);
        await processFiles(droppedFiles);
    };

    async function handleSend(overrideText = null) {
        const textToSubmit = typeof overrideText === "string" ? overrideText : input;

        // Optimized condition: can send if there is input, OR images, OR documents
        if ((!textToSubmit.trim() && images.length === 0 && files.length === 0) || !isReady || isLoading) return;

        const userText = textToSubmit.trim();
        const currentImages = [...images];
        const currentFiles = [...files];

        if (typeof overrideText !== "string") {
            setInput("");
            setImages([]);
        }
        setIsLoading(true);
        setHasResponseStarted(false);
        isUserScrolledUpRef.current = false;

        const controller = new AbortController();
        abortControllerRef.current = controller;
        const conversationId = selectedConversationId;

        let assistantAdded = false;

        try {
            const b64Images = currentImages.map(img => img.base64);
            const mode = currentFiles.length > 0 ? "rag" : "chat";

            // If files are present, upload them first (RAG mode)
            if (currentFiles.length > 0) {
                for (const file of currentFiles) {
                    try {
                        await uploadFile(file, controller.signal);
                    } catch (upErr) {
                        console.error("Document upload warning:", upErr);
                    }
                }
                setFiles([]);
            }

            if (selectedConversationRef.current !== conversationId) return;

            const helperGetFileType = (filename = "") => {
                const ext = filename.split(".").pop().toLowerCase();
                if (ext === "pdf") return "pdf";
                if (["xlsx", "xls", "csv"].includes(ext)) return "excel";
                if (["doc", "docx"].includes(ext)) return "word";
                return "file";
            };

            const attachments = [
                ...currentImages.map(img => ({ type: "image", preview: img.preview, name: img.name })),
                ...currentFiles.map(f => ({ type: helperGetFileType(f.name), name: f.name }))
            ];

            // Clean fallback label if prompt text is empty
            const displayMessage = userText || (mode === "rag" ? "Analyzed document(s)" : "Analyzed image(s)");
            setMessages((prev) => [...prev, { role: "user", content: displayMessage, attachments }]);

            if (!isTitled && onTitleUpdate) {
                const title = userText.slice(0, 60) || (mode === "rag" ? "Document Analysis" : "Image Generation");
                updateConversationTitle(conversationId, title)
                    .then(() => onTitleUpdate(conversationId, title))
                    .catch(console.error);
            }

            // Detect image creation mode or explicit image generation prompt
            const isImageMode = model === "x/flux2-klein" || model?.includes("flux");
            const isImagePrompt = /^(generate|create|draw|make|show)\s+(an?\s+)?(image|picture|photo|illustration|drawing|art)\s+of/i.test(userText) || 
                                  userText.toLowerCase().includes("generate an image") || 
                                  userText.toLowerCase().includes("generate image");

            if ((isImageMode || isImagePrompt) && currentFiles.length === 0 && currentImages.length === 0) {
                setHasResponseStarted(true);
                setMessages((prev) => [...prev, { role: "assistant", content: "🪄 Enhancing prompt & synthesizing image with x/flux2-klein..." }]);

                try {
                    const activeImageModel = isImageMode ? model : "x/flux2-klein";
                    const imgRes = await generateImage(userText, activeImageModel, conversationId);
                    const finalContent = imgRes.data?.content || imgRes.content;
                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            role: "assistant",
                            content: finalContent,
                        };
                        return updated;
                    });
                    setIsLoading(false);
                    return;
                } catch (imgErr) {
                    console.warn("Direct /generate-image call failed, falling back to stream endpoint:", imgErr);
                }
            }

            const response = await sendChatStream(
                userText,
                model,
                mode,
                conversationId,
                controller.signal,
                b64Images.length > 0 ? b64Images : null
            );

            // Add an empty assistant message that we'll fill with streamed tokens
            let fullText = "";
            setHasResponseStarted(true);
            setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
            assistantAdded = true;

            let lastUpdate = Date.now();

            for await (const event of parseSSEStream(response)) {
                if (selectedConversationRef.current !== conversationId) break;
                if (event.error) {
                    // Replace the last (empty) assistant message with the error
                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            role: "assistant",
                            content: `Error: ${event.error}`,
                        };
                        return updated;
                    });
                    break;
                }

                if (event.status) {
                    // RAG status updates — show as temporary content
                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            role: "assistant",
                            content: `🔍 ${event.status}`,
                        };
                        return updated;
                    });
                    lastUpdate = 0; // Force immediate render for status update
                    continue;
                }

                if (event.token) {
                    fullText += event.token;
                    const now = Date.now();
                    // Throttle updates to ~60ms to avoid overwhelming React's render cycles
                    if (now - lastUpdate > 60) {
                        const currentText = fullText;
                        setMessages((prev) => {
                            const updated = [...prev];
                            updated[updated.length - 1] = {
                                role: "assistant",
                                content: currentText,
                            };
                            return updated;
                        });
                        lastUpdate = now;
                    }
                }

                if (event.done) {
                    break;
                }
            }

            // Always write the final text to state on loop termination
            const finalText = fullText;
            setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                    role: "assistant",
                    content: finalText,
                };
                return updated;
            });
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log("Request cancelled by user");
            } else {
                console.error("Chat Error:", error);
                if (selectedConversationRef.current === conversationId) {
                    setMessages((prev) => {
                        const errorMessage = {
                            role: "assistant",
                            content: `Sorry, something went wrong: ${error.message}`,
                        };
                        if (!assistantAdded) return [...prev, errorMessage];
                        const updated = [...prev];
                        updated[updated.length - 1] = errorMessage;
                        return updated;
                    });
                }
            }
        } finally {
            setIsLoading(false);
            setHasResponseStarted(false);
            if (abortControllerRef.current === controller) abortControllerRef.current = null;
            // Clean up preview URLs
            currentImages.forEach(img => URL.revokeObjectURL(img.preview));
        }
    }

    const handleStop = () => {
        abortControllerRef.current?.abort();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleEditLastMessage = async (newText) => {
        if (!newText.trim() || isLoading) return;

        try {
            // 1. Roll back the last interaction in backend database
            await rollbackConversation(selectedConversationId);

            // 2. Remove the last user message and assistant response from local state
            setMessages((prev) => {
                const updated = [...prev];
                const idx = [...updated].reverse().findIndex(m => m.role === "user");
                if (idx !== -1) {
                    const actualIdx = updated.length - 1 - idx;
                    return updated.slice(0, actualIdx);
                }
                return updated;
            });

            // 3. Resubmit and stream using the newly updated text
            await handleSend(newText);
        } catch (err) {
            console.error("Error editing and resubmitting message:", err);
            alert("Failed to edit and resubmit message: " + err.message);
        }
    };

    // Find the index of the last user message to make it editable
    const lastUserIndex = [...messages].reverse().findIndex(m => m.role === "user");
    const actualLastUserIndex = lastUserIndex !== -1 ? messages.length - 1 - lastUserIndex : -1;

    return (
        <div
            className={`chat ${isDragging ? "dragging" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="drag-overlay">
                    <div className="drag-overlay-inner">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "48px", height: "48px", marginBottom: "16px", color: "var(--accent)" }}>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <p style={{ fontSize: "16px", fontWeight: "600", color: "var(--dark)" }}>Drop your files or images here</p>
                        <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>Supports PDF, Word, TXT, Excel and images</p>
                    </div>
                </div>
            )}

            <div className="messages" ref={messagesContainerRef} onScroll={handleScroll}>
                {messages.length === 0 ? (
                    <WelcomeScreen onSuggestionClick={handleSuggestionClick} />
                ) : (
                    messages.map((m, i) => (
                        <MessageBubble
                            key={m.id || `${m.role}-${i}`}
                            role={m.role}
                            text={m.content}
                            attachments={m.attachments || []}
                            isEditable={i === actualLastUserIndex && !isLoading}
                            onEdit={handleEditLastMessage}
                        />
                    ))
                )}

                {/* Typing indicator */}
                {isLoading && !hasResponseStarted && (
                    <div className="message assistant">
                        <div className="message-inner">
                            <div className="ai-avatar">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                </svg>
                            </div>
                            <div className="bubble">
                                <div className="typing-dots">
                                    <span /><span /><span />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            <div className="input-section">
                {!isReady && (
                    <div className={`chat-status ${initializationError ? "error" : ""}`} role="status">
                        {initializationError || "Connecting to the chat service…"}
                    </div>
                )}
                <div className="input-box">
                    {(files.length > 0 || images.length > 0) && (
                        <div className="attached-files">
                            {/* Images thumbnails */}
                            {images.map((img, i) => (
                                <div className="file-chip image-chip" key={i}>
                                    <img src={img.preview} alt="Preview" style={{ width: 20, height: 20, borderRadius: 2, marginRight: 4, objectFit: 'cover' }} />
                                    {img.name}
                                    <button onClick={() => removeImage(i)} title="Remove">
                                        <X style={{ width: 12, height: 12 }} />
                                    </button>
                                </div>
                            ))}
                            {/* Document labels */}
                            {files.map((f, i) => (
                                <div className="file-chip" key={i}>
                                    <File style={{ width: 12, height: 12 }} />
                                    {f.name}
                                    <button onClick={() => removeFile(i)} title="Remove">
                                        <X style={{ width: 12, height: 12 }} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="input-top">
                        <div className="attachment-menu-wrapper" ref={attachmentMenuRef}>
                            <button
                                className={`input-action-btn ${showAttachmentMenu ? "active" : ""}`}
                                title="Attachments & Tools"
                                onClick={() => setShowAttachmentMenu((prev) => !prev)}
                            >
                                {showAttachmentMenu ? <X size={18} /> : <Paperclip size={18} />}
                            </button>

                            {showAttachmentMenu && (
                                <div className="gemini-tools-menu">
                                    <button
                                        className="gemini-menu-item"
                                        onClick={() => {
                                            setShowAttachmentMenu(false);
                                            fileInputRef.current?.click();
                                        }}
                                    >
                                        <Paperclip size={16} />
                                        <span>Upload files</span>
                                    </button>

                                    <div className="gemini-menu-divider" />

                                    <button
                                        className="gemini-menu-item"
                                        onClick={() => {
                                            setShowAttachmentMenu(false);
                                            if (setModel) setModel("x/flux2-klein");
                                            setInput((prev) => (prev ? prev : "Generate an image of "));
                                            if (textareaRef.current) textareaRef.current.focus();
                                        }}
                                    >
                                        <ImageIcon size={16} />
                                        <span>Create image</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isReady ? "Type your message here…" : "Waiting for chat service…"}
                            rows={1}
                        />
                        {isLoading ? (
                            <button
                                className="send-btn stop-btn"
                                onClick={handleStop}
                                title="Stop generating"
                            >
                                <Square fill="currentColor" size={18} />
                            </button>
                        ) : (
                            <button
                                className="send-btn"
                                onClick={() => handleSend()}
                                disabled={!isReady || (!input.trim() && images.length === 0 && files.length === 0)}
                                title="Send"
                            >
                                <Send />
                            </button>
                        )}
                    </div>

                    <div className="input-bottom">
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            style={{ display: "none" }}
                            onChange={handleFileSelect}
                            accept=".pdf,.docx,.txt,.xlsx,.xls,image/*"
                        />
                        <span className="disclaimer">
                            GEN Labs may produce inaccurate information. Verify important facts.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
