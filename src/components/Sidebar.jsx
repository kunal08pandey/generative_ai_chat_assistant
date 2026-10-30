import { useState, useRef } from "react";
import {
    createNewConversation,
    deleteConversation,
    clearAllConversations,
    updateConversationTitle,
} from "../api/client";
import {
    MessageSquare,
    Search,
    Plus,
    Sparkles,
    Trash2,
    RotateCcw,
    Pencil,
    Check,
    X,
} from "lucide-react";

export default function Sidebar({
    conversations,
    setConversations,
    selectedConversationId,
    setSelectedConversationId,
    onRequestDelete,
    onTitleUpdate,
    isOpen,
    onClose,
}) {
    const [search, setSearch] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState("");

    async function createNewChat() {
        const response = await createNewConversation();
        if (!response) return;
        setConversations((prev) => [response, ...prev]);
        setSelectedConversationId(response.id);
        if (onClose && window.innerWidth <= 768) onClose();
    }

    async function deleteChat(event, conversationId) {
        event.stopPropagation();
        try {
            await deleteConversation(conversationId);
        } catch (err) {
            console.warn("deleteConversation warning:", err);
        }
        const remaining = conversations.filter((conversation) => conversation.id !== conversationId);
        if (selectedConversationId === conversationId) {
            if (remaining.length > 0) {
                setSelectedConversationId(remaining[0].id);
                setConversations(remaining);
            } else {
                try {
                    const newConv = await createNewConversation();
                    if (newConv && newConv.id) {
                        setConversations([newConv]);
                        setSelectedConversationId(newConv.id);
                    } else {
                        const fallbackId = `conv-${Date.now()}`;
                        const fallbackObj = { id: fallbackId, title: "New Chat", created_at: new Date().toISOString() };
                        setConversations([fallbackObj]);
                        setSelectedConversationId(fallbackId);
                    }
                } catch {
                    const fallbackId = `conv-${Date.now()}`;
                    const fallbackObj = { id: fallbackId, title: "New Chat", created_at: new Date().toISOString() };
                    setConversations([fallbackObj]);
                    setSelectedConversationId(fallbackId);
                }
            }
        } else {
            setConversations(remaining);
        }
    }

    async function handleClearAll() {
        if (!window.confirm("Are you sure you want to clear all chat history?")) return;
        try {
            await clearAllConversations();
            const newConv = await createNewConversation();
            if (newConv && newConv.id) {
                setConversations([newConv]);
                setSelectedConversationId(newConv.id);
            } else {
                setConversations([]);
                setSelectedConversationId("");
            }
        } catch (err) {
            console.error("Error clearing conversations:", err);
        }
    }

    function startRename(event, conv) {
        event.stopPropagation();
        setEditingId(conv.id);
        setEditTitle(conv.title || "New Chat");
    }

    async function handleSaveRename(convId) {
        const trimmed = editTitle.trim();
        if (!trimmed) {
            setEditingId(null);
            return;
        }
        setEditingId(null);
        try {
            await updateConversationTitle(convId, trimmed);
            setConversations((prev) =>
                prev.map((c) => (c.id === convId ? { ...c, title: trimmed } : c))
            );
            if (onTitleUpdate) {
                onTitleUpdate(convId, trimmed);
            }
        } catch (err) {
            console.error("Failed to rename conversation:", err);
        }
    }

    function handleRenameKeyDown(event, convId) {
        if (event.key === "Enter") {
            event.preventDefault();
            handleSaveRename(convId);
        } else if (event.key === "Escape") {
            setEditingId(null);
        }
    }

    const filtered = conversations.filter((c) =>
        (c.title || "Untitled").toLowerCase().includes(search.toLowerCase())
    );

    return (
        <>
            {/* Mobile overlay */}
            <div
                className={`sidebar-overlay ${isOpen ? "visible" : ""}`}
                onClick={onClose}
            />

            <aside className={`sidebar ${isOpen ? "open" : ""}`}>
                {/* Logo */}
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">
                        <img src="/logo.jpg" alt="Kshitiz AI Labs" className="sidebar-logo-img" />
                    </div>
                    <span className="sidebar-logo-text">
                        Kshitiz <span>AI Labs</span>
                    </span>
                </div>

                {/* New Chat */}
                <button className="new-chat-btn" onClick={createNewChat}>
                    <Plus />
                    New Chat
                </button>

                {/* Search */}
                <div className="sidebar-search">
                    <Search />
                    <input
                        type="text"
                        placeholder="Search conversations…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Conversation List */}
                <div className="conversation-section">
                    {filtered.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingRight: "8px", marginBottom: "8px" }}>
                            <p className="conv-section-title" style={{ margin: 0 }}>History</p>
                            <button
                                onClick={handleClearAll}
                                title="Clear all history"
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "var(--muted)",
                                    fontSize: "11px",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px"
                                }}
                            >
                                <RotateCcw size={12} /> Clear All
                            </button>
                        </div>
                    )}
                    {filtered.map((conv) => (
                        <div
                            key={conv.id}
                            className={`conversation-item ${selectedConversationId === conv.id ? "active" : ""}`}
                            onClick={() => {
                                if (editingId !== conv.id) {
                                    setSelectedConversationId(conv.id);
                                    if (onClose && window.innerWidth <= 768) onClose();
                                }
                            }}
                        >
                            {editingId === conv.id ? (
                                <div className="conv-rename-wrapper" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="text"
                                        className="conv-rename-input"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        onKeyDown={(e) => handleRenameKeyDown(e, conv.id)}
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        className="conv-action-btn check"
                                        onClick={() => handleSaveRename(conv.id)}
                                        title="Save title"
                                    >
                                        <Check size={13} />
                                    </button>
                                    <button
                                        type="button"
                                        className="conv-action-btn cancel"
                                        onClick={() => setEditingId(null)}
                                        title="Cancel"
                                    >
                                        <X size={13} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <MessageSquare />
                                    <span
                                        className="conv-title"
                                        title="Double click to rename"
                                        onDoubleClick={(e) => startRename(e, conv)}
                                    >
                                        {conv.title || "Untitled"}
                                    </span>
                                    <div className="conv-item-actions">
                                        <button
                                            className="conv-action-btn rename-btn"
                                            onClick={(e) => startRename(e, conv)}
                                            title="Rename chat"
                                            aria-label={`Rename ${conv.title || "conversation"}`}
                                            type="button"
                                        >
                                            <Pencil size={12} />
                                        </button>
                                        <button
                                            className="delete-conversation-btn"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                if (onRequestDelete) {
                                                    onRequestDelete(conv);
                                                } else {
                                                    deleteChat(event, conv.id).catch(console.error);
                                                }
                                            }}
                                            title={`Delete ${conv.title || "conversation"}`}
                                            aria-label={`Delete ${conv.title || "conversation"}`}
                                            type="button"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                    {filtered.length === 0 && search && (
                        <p style={{ padding: "12px", fontSize: "12px", color: "#5a6278", textAlign: "center" }}>
                            No conversations found
                        </p>
                    )}
                </div>

                <div className="sidebar-footer">
                    Kshitiz AI Labs — Powered by Ollama
                </div>
            </aside>
        </>
    );
}
