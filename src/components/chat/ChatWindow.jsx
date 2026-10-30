import { useState, useRef, useEffect } from "react";
import {
    sendChatStream,
    parseSSEStream,
    uploadFile,
    updateConversationTitle,
    rollbackConversation,
    rollbackToMessage,
    generateImage,
    deleteMessage,
    fetchMessages,
} from "../../api/client";
import MessageBubble from "../MessageBubble";
import WelcomeScreen from "./Welcome";
import DeleteConfirmModal from "./DeleteConfirmModal";
import { Paperclip, Send, X, File, Square, Image as ImageIcon, FileCode, ChevronDown } from "lucide-react";

function normalizeError(err, activeModel) {
    if (typeof err === "object" && err !== null && (err.title || err.message)) {
        return err;
    }
    const raw = typeof err === "string" ? err : (err?.message || String(err));
    const lower = raw.toLowerCase();

    if (lower.includes("all connection attempts failed") || lower.includes("failed to connect to host") || lower.includes("ollama")) {
        return {
            code: "OLLAMA_CONNECTION_ERROR",
            title: "Cannot Connect to Local Ollama",
            message: "The backend could not reach the Ollama service on port 11434.",
            reason: "Ollama is either not running on your host machine or listening only on 127.0.0.1 (which Docker cannot reach via host.docker.internal).",
            suggestion: "1. Start Ollama with: OLLAMA_HOST=0.0.0.0:11434 ollama serve\n2. Or switch to a Google Gemini model (e.g. 'gemini-3.5-flash') using the model dropdown above.",
            model: activeModel,
            technical: raw,
        };
    }
    if (lower.includes("429") || lower.includes("quota") || lower.includes("resource_exhausted")) {
        return {
            code: "QUOTA_EXCEEDED",
            title: "Google API Quota Exceeded (429)",
            message: `Quota limit reached for model '${activeModel}'.`,
            reason: `Model '${activeModel}' has no free tier quota (limit 0). Advanced reasoning and frontier models require an active billing account linked in Google AI Studio.`,
            suggestion: "1. Switch to free tier model 'gemini-3.5-flash' from the dropdown.\n2. Or link a billing account to your project in Google AI Studio.",
            model: activeModel,
            technical: raw,
        };
    }
    if (lower.includes("404") || lower.includes("not found") || lower.includes("no longer available")) {
        return {
            code: "MODEL_NOT_FOUND",
            title: "Model Not Available (404)",
            message: `Model '${activeModel}' is not recognized or has been retired by Google.`,
            reason: "The provider has deprecated or restricted this model identifier for your account.",
            suggestion: "Please select 'gemini-3.5-flash' or 'gemini-3.1-pro-preview' from the model selector above.",
            model: activeModel,
            technical: raw,
        };
    }
    if (lower.includes("503") || lower.includes("unavailable") || lower.includes("overloaded")) {
        const altModel = (activeModel || "").toLowerCase().includes("flash-lite") ? "gemini-3.5-flash" : "gemini-3.5-flash-lite";
        return {
            code: "SERVICE_OVERLOADED",
            title: "Model Server Overloaded (503)",
            message: `Google servers for '${activeModel}' are temporarily experiencing high demand.`,
            reason: "The upstream API service is temporarily unavailable or overloaded.",
            suggestion: `1. Spikes in demand are usually temporary — wait a few moments and retry.\n2. Or switch to '${altModel}' from the dropdown above.`,
            model: activeModel,
            technical: raw,
        };
    }
    return {
        code: "ERROR",
        title: "Model Generation Error",
        message: raw.replace(/^error:\s*/i, "") || "An error occurred while generating a response.",
        reason: "The server or AI provider encountered an issue while processing your prompt.",
        suggestion: "Please try again or select a different model from the dropdown above.",
        model: activeModel,
        technical: raw,
    };
}

function generateCleanTitle(text, mode) {
    if (!text || !text.trim()) {
        return mode === "rag" ? "Document Analysis" : "Image Generation";
    }
    const clean = text.replace(/[`*#_~[\]()]/g, "").trim().replace(/\s+/g, " ");
    if (clean.length <= 42) return clean;
    const truncated = clean.slice(0, 40);
    const lastSpace = truncated.lastIndexOf(" ");
    return (lastSpace > 15 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

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
    const [thinkingState, setThinkingState] = useState(null); // { model, provider } or null
    const [deleteMessageTarget, setDeleteMessageTarget] = useState(null); // { index, message }
    const [isDeletingMessage, setIsDeletingMessage] = useState(false);
    const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);

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
        const scrolledUp = distanceToBottom > 80;
        isUserScrolledUpRef.current = scrolledUp;
        setIsUserScrolledUp(scrolledUp);
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

    // Detect if the current model is a Gemini model
    const isGeminiModel = (m) => {
        const lower = (m || "").toLowerCase();
        return lower.includes("gemini") || lower.includes("argon");
    };

    // Detect image generation intent from prompt text
    const isImageGenerationPrompt = (text) => {
        if (!text) return false;
        const lower = text.toLowerCase().trim();
        return /^(?:please\s+|can\s+you\s+(?:please\s+)?|could\s+you\s+(?:please\s+)?|i\s+want\s+(?:you\s+to\s+)?|help\s+me\s+)?(?:generate|create|draw|make|render|produce)\s+(?:an?\s+)?(?:image|picture|photo|photograph|illustration|drawing|art|portrait|wallpaper)/i.test(lower) ||
            /^(draw|paint|render)\s+/i.test(lower) ||
            lower.startsWith("generate an image") ||
            lower.startsWith("generate image") ||
            lower.startsWith("create an image") ||
            lower.startsWith("create image") ||
            lower.startsWith("draw ") ||
            lower.startsWith("paint ");
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
        setThinkingState(null);
        isUserScrolledUpRef.current = false;

        const controller = new AbortController();
        abortControllerRef.current = controller;
        const conversationId = selectedConversationId;

        let assistantAdded = false;
        let streamHadError = false;

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
                const title = generateCleanTitle(userText, mode);
                updateConversationTitle(conversationId, title)
                    .then(() => onTitleUpdate(conversationId, title))
                    .catch(console.error);
            }

            // Detect image generation:
            // - If Gemini model selected → generates image using Gemini (Flash or Flash-Lite)
            // - If non-Gemini model selected → generates image using x/flux2-klein
            const isFluxModel = model === "x/flux2-klein" || model?.includes("flux");
            const isImagePrompt = isImageGenerationPrompt(userText);
            const currentIsGemini = isGeminiModel(model);

            if ((isFluxModel || isImagePrompt) && currentFiles.length === 0 && currentImages.length === 0) {
                setHasResponseStarted(true);
                const activeImageModel = currentIsGemini ? model : "x/flux2-klein";

                let geminiThinkingLabel = "Gemini";
                if (currentIsGemini) {
                    const mLower = (model || "").toLowerCase();
                    if (mLower.includes("lite")) {
                        geminiThinkingLabel = "Gemini Flash-Lite";
                    } else if (mLower.includes("flash")) {
                        geminiThinkingLabel = "Gemini Flash";
                    } else {
                        geminiThinkingLabel = `Gemini (${model})`;
                    }
                }

                setMessages((prev) => [...prev, {
                    role: "assistant",
                    content: "",
                    isThinking: true,
                    thinkingModel: currentIsGemini ? geminiThinkingLabel : "x/flux2-klein"
                }]);
                assistantAdded = true;

                try {
                    const imgRes = await generateImage(userText, activeImageModel, conversationId);
                    const finalContent = imgRes.data?.content || imgRes.content;
                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            role: "assistant",
                            content: finalContent,
                            isThinking: false,
                        };
                        return updated;
                    });
                    setIsLoading(false);
                    setThinkingState(null);
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
            if (!assistantAdded) {
                setMessages((prev) => [...prev, { role: "assistant", content: "", isThinking: true, thinkingModel: model }]);
                assistantAdded = true;
            }

            let lastUpdate = Date.now();

            for await (const event of parseSSEStream(response)) {
                if (selectedConversationRef.current !== conversationId) break;

                if (event.error) {
                    streamHadError = true;
                    const normalized = normalizeError(event.error, model);
                    setThinkingState(null);
                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            role: "assistant",
                            isError: true,
                            isThinking: false,
                            errorDetails: normalized,
                            content: normalized.message || "An error occurred.",
                        };
                        return updated;
                    });
                    break;
                }

                // Handle thinking event from backend
                if (event.thinking) {
                    setThinkingState({ model: event.model, provider: event.provider });
                    // Update existing assistant message to show thinking state
                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            role: "assistant",
                            content: "",
                            isThinking: true,
                            thinkingModel: event.model,
                        };
                        return updated;
                    });
                    continue;
                }

                if (event.status) {
                    // RAG status updates — show as temporary content
                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            role: "assistant",
                            content: `🔍 ${event.status}`,
                            isThinking: false,
                        };
                        return updated;
                    });
                    lastUpdate = 0; // Force immediate render for status update
                    continue;
                }

                if (event.token) {
                    if (!hasResponseStarted) {
                        setHasResponseStarted(true);
                        setThinkingState(null);
                    }
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
                                isThinking: false,
                                isStreaming: true,
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

            // Always write the final text to state on loop termination if no error occurred
            if (!streamHadError) {
                setThinkingState(null);
                const finalText = fullText;
                setMessages((prev) => {
                    const updated = [...prev];
                    if (updated.length > 0 && updated[updated.length - 1].role === "assistant") {
                        updated[updated.length - 1] = {
                            role: "assistant",
                            content: finalText,
                            isThinking: false,
                            isStreaming: false,
                        };
                    }
                    return updated;
                });
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log("Request cancelled by user");
                // Mark the last assistant message as stopped
                setMessages((prev) => {
                    const updated = [...prev];
                    if (updated.length > 0 && updated[updated.length - 1].role === "assistant") {
                        updated[updated.length - 1] = {
                            ...updated[updated.length - 1],
                            isThinking: false,
                            isStreaming: false,
                            wasStopped: true,
                        };
                    }
                    return updated;
                });
            } else {
                streamHadError = true;
                console.error("Chat Error:", error);
                if (selectedConversationRef.current === conversationId) {
                    const normalized = normalizeError(error, model);
                    setMessages((prev) => {
                        const errorMessage = {
                            role: "assistant",
                            isError: true,
                            isThinking: false,
                            errorDetails: normalized,
                            content: normalized.message || error.message,
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
            setThinkingState(null);
            if (abortControllerRef.current === controller) abortControllerRef.current = null;
            // Clean up preview URLs
            currentImages.forEach(img => URL.revokeObjectURL(img.preview));
            // Only sync messages from backend if no error occurred, preserving wasStopped on abortion
            if (!streamHadError) {
                try {
                    const refreshed = await fetchMessages(conversationId);
                    if (selectedConversationRef.current === conversationId && Array.isArray(refreshed) && refreshed.length > 0) {
                        setMessages((current) => {
                            const wasLastStopped = current.length > 0 && current[current.length - 1].wasStopped;
                            if (wasLastStopped && refreshed.length > 0) {
                                refreshed[refreshed.length - 1].wasStopped = true;
                            }
                            return refreshed;
                        });
                    }
                } catch (syncErr) {
                    console.warn("Post-stream message sync warning:", syncErr);
                }
            }
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

    const handleEditMessage = async (msgIndex, newText) => {
        if (!newText.trim()) return;

        // If response is currently streaming, abort it first
        if (isLoading) {
            abortControllerRef.current?.abort();
        }

        try {
            const targetMsg = messages[msgIndex];
            if (targetMsg?.id) {
                try {
                    await rollbackToMessage(selectedConversationId, targetMsg.id);
                } catch (rErr) {
                    console.warn("rollbackToMessage failed, attempting rollbackConversation:", rErr);
                    await rollbackConversation(selectedConversationId);
                }
            } else {
                await rollbackConversation(selectedConversationId);
            }

            // Truncate messages in local state from msgIndex onward
            setMessages((prev) => prev.slice(0, msgIndex));

            // Resubmit and stream using the newly updated text
            await handleSend(newText);
        } catch (err) {
            console.error("Error editing message:", err);
            setMessages((prev) => prev.slice(0, msgIndex));
            await handleSend(newText);
        }
    };

    const handleDeleteMessagePrompt = (msgIndex) => {
        const msg = messages[msgIndex];
        if (!msg) return;
        setDeleteMessageTarget({ index: msgIndex, message: msg });
    };

    const handleConfirmDeleteMessage = async () => {
        if (!deleteMessageTarget) return;
        const { index, message } = deleteMessageTarget;
        setIsDeletingMessage(true);

        try {
            // Optimistically remove from state
            setMessages((prev) => prev.filter((_, idx) => idx !== index));

            if (message?.id) {
                try {
                    await deleteMessage(message.id, selectedConversationId);
                } catch (err) {
                    console.error("Failed to delete message on backend:", err);
                }
            } else {
                try {
                    await rollbackConversation(selectedConversationId);
                } catch (rErr) {
                    console.warn("Rollback fallback notice:", rErr);
                }
            }
            setDeleteMessageTarget(null);
        } catch (err) {
            console.error("Error deleting message:", err);
        } finally {
            setIsDeletingMessage(false);
        }
    };

    const handleRegenerate = async (msgIndex) => {
        let userPrompt = "";
        for (let i = msgIndex - 1; i >= 0; i--) {
            if (messages[i]?.role === "user") {
                userPrompt = messages[i].content;
                break;
            }
        }
        if (!userPrompt) return;

        if (isLoading) {
            abortControllerRef.current?.abort();
        }

        try {
            const targetMsg = messages[msgIndex];
            if (targetMsg?.id) {
                try {
                    await rollbackToMessage(selectedConversationId, targetMsg.id);
                } catch (rErr) {
                    console.warn("rollbackToMessage notice:", rErr);
                    await rollbackConversation(selectedConversationId);
                }
            } else {
                await rollbackConversation(selectedConversationId);
            }

            setMessages((prev) => prev.slice(0, msgIndex));
            await handleSend(userPrompt);
        } catch (err) {
            console.error("Error regenerating response:", err);
            setMessages((prev) => prev.slice(0, msgIndex));
            await handleSend(userPrompt);
        }
    };

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
                            isEditable={m.role === "user"}
                            onEdit={(newText) => handleEditMessage(i, newText)}
                            onDelete={() => handleDeleteMessagePrompt(i)}
                            onRegenerate={m.role === "assistant" ? () => handleRegenerate(i) : null}
                            isError={m.isError}
                            errorDetails={m.errorDetails}
                            onSelectModel={setModel}
                            isStreaming={m.isStreaming || (isLoading && i === messages.length - 1 && !m.isThinking)}
                            isThinking={m.isThinking}
                            thinkingModel={m.thinkingModel}
                            wasStopped={m.wasStopped}
                        />
                    ))
                )}

                {/* Floating Scroll to Bottom button (ChatGPT / Gemini style) */}
                {isUserScrolledUp && (
                    <button
                        type="button"
                        className="scroll-to-bottom-floating-btn"
                        onClick={() => {
                            messagesContainerRef.current?.scrollTo({
                                top: messagesContainerRef.current.scrollHeight,
                                behavior: "smooth",
                            });
                            setIsUserScrolledUp(false);
                            isUserScrolledUpRef.current = false;
                        }}
                        title="Scroll to bottom"
                        aria-label="Scroll to bottom"
                    >
                        <ChevronDown size={18} />
                    </button>
                )}

                {/* Typing indicator — only shown before the assistant message is added */}
                {isLoading && !hasResponseStarted && messages.length > 0 && messages[messages.length - 1].role === "user" && (
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
                                            // Don't force model switch — if Gemini is selected, use Gemini for image gen
                                            if (!isGeminiModel(model)) {
                                                if (setModel) setModel("x/flux2-klein");
                                            }
                                            setInput((prev) => (prev ? prev : "Generate an image of "));
                                            if (textareaRef.current) textareaRef.current.focus();
                                        }}
                                    >
                                        <ImageIcon size={16} />
                                        <span>Create image</span>
                                    </button>

                                    <div className="gemini-menu-divider" />

                                    <button
                                        className="gemini-menu-item"
                                        onClick={() => {
                                            setShowAttachmentMenu(false);
                                            setInput((prev) => (prev ? prev : "Please generate a file for: "));
                                            if (textareaRef.current) textareaRef.current.focus();
                                        }}
                                    >
                                        <FileCode size={16} />
                                        <span>Generate code file</span>
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

            {/* Confirmation modal for deleting an individual message */}
            <DeleteConfirmModal
                isOpen={Boolean(deleteMessageTarget)}
                title="Delete Message?"
                description={
                    deleteMessageTarget?.message?.content
                        ? `Are you sure you want to delete this ${deleteMessageTarget.message.role === "user" ? "user prompt" : "AI response"} from the conversation?`
                        : "Are you sure you want to delete this message from the conversation?"
                }
                conversationTitle={
                    deleteMessageTarget?.message?.content
                        ? (deleteMessageTarget.message.content.length > 60
                            ? deleteMessageTarget.message.content.slice(0, 60) + "…"
                            : deleteMessageTarget.message.content)
                        : "this message"
                }
                confirmText="Delete Message"
                onConfirm={handleConfirmDeleteMessage}
                onCancel={() => !isDeletingMessage && setDeleteMessageTarget(null)}
                isDeleting={isDeletingMessage}
            />
        </div>
    );
}
