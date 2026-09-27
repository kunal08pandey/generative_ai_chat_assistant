import { useState } from "react";
import { createNewConversation, deleteConversation, clearAllConversations } from "../api/client";
import { MessageSquare, Search, Plus, Sparkles, Trash2, RotateCcw } from "lucide-react";

export default function Sidebar({
    conversations,
    setConversations,
    selectedConversationId,
    setSelectedConversationId,
    isOpen,
    onClose,
}) {
    const [search, setSearch] = useState("");

    async function createNewChat() {
        const response = await createNewConversation();
        if (!response) return;
        setConversations((prev) => [response, ...prev]);
        setSelectedConversationId(response.id);
        if (onClose && window.innerWidth <= 768) onClose();
    }

    async function deleteChat(event, conversationId) {
        event.stopPropagation();
        await deleteConversation(conversationId);
        setConversations((previous) => {
            const remaining = previous.filter((conversation) => conversation.id !== conversationId);
            if (selectedConversationId === conversationId) {
                setSelectedConversationId(remaining[0]?.id || "");
            }
            return remaining;
        });
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
                        <Sparkles />
                    </div>
                    <span className="sidebar-logo-text">
                        GEN <span>Labs</span>
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
                                setSelectedConversationId(conv.id);
                                if (onClose && window.innerWidth <= 768) onClose();
                            }}
                        >
                            <MessageSquare />
                            <span className="conv-title">{conv.title || "Untitled"}</span>
                            <button
                                className="delete-conversation-btn"
                                onClick={(event) => deleteChat(event, conv.id).catch(console.error)}
                                title="Delete conversation"
                                aria-label={`Delete ${conv.title || "conversation"}`}
                            >
                                <Trash2 />
                            </button>
                        </div>
                    ))}
                    {filtered.length === 0 && search && (
                        <p style={{ padding: "12px", fontSize: "12px", color: "#5a6278", textAlign: "center" }}>
                            No conversations found
                        </p>
                    )}
                </div>

                <div className="sidebar-footer">
                    GEN Labs — Powered by Ollama
                </div>
            </aside>
        </>
    );
}
