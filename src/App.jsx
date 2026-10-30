import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/chat/ChatWindow";
import ChatHeader from "./components/chat/ChatHeader";
import {
  fetchConversation,
  fetchMessages,
  createNewConversation,
  deleteConversation,
  getModels,
} from "./api/client";
import DeleteConfirmModal from "./components/chat/DeleteConfirmModal";


export default function App() {
  const [model, setModel] = useState(() => {
    try {
      return localStorage.getItem("selected_model") || "gemini-3.5-flash";
    } catch {
      return "gemini-3.5-flash";
    }
  });
  const [models, setModels] = useState([]);
  const [modelsByProvider, setModelsByProvider] = useState({});
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved) return saved === "dark";
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  });
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [initializationError, setInitializationError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, title }
  const [isDeletingChat, setIsDeletingChat] = useState(false);

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedConversationId
  );
  const isTitled = Boolean(
    selectedConversation?.title && selectedConversation.title !== "New Chat"
  );

  /* ── Dark mode sync & toggle ── */
  useEffect(() => {
    try {
      document.documentElement.classList.toggle("dark", darkMode);
      localStorage.setItem("theme", darkMode ? "dark" : "light");
    } catch (e) {
      console.warn("Could not save theme preference:", e);
    }
  }, [darkMode]);

  const toggleDark = () => {
    setDarkMode((prev) => !prev);
  };

  /* ── Model preference setter ── */
  const handleSetModel = (newModel) => {
    setModel(newModel);
    try {
      if (newModel) {
        localStorage.setItem("selected_model", newModel);
      }
    } catch (e) {
      console.warn("Could not save model preference:", e);
    }
  };

  /* ── Load models ── */
  useEffect(() => {
    let isMounted = true;
    getModels()
      .then((data) => {
        if (!isMounted) return;
        setModelsByProvider(data || {});
        const all = Object.values(data || {}).flat();
        if (all && all.length > 0) {
          setModels(all);
          try {
            const savedModel = localStorage.getItem("selected_model");
            if (savedModel && all.includes(savedModel)) {
              setModel(savedModel);
            } else if (!all.includes(model)) {
              setModel(all[0]);
            }
          } catch {
            if (!all.includes(model)) {
              setModel(all[0]);
            }
          }
        }
      })
      .catch((error) => {
        console.error("Could not load models list:", error);
      })
      .finally(() => {
        if (isMounted) setModelsLoaded(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  /* ── Init Chat ── */
  useEffect(() => {
    let isMounted = true;

    async function initChat() {
      try {
        const data = await fetchConversation();
        if (!isMounted) return;

        if (Array.isArray(data) && data.length > 0) {
          setConversations(data);
          setSelectedConversationId(data[0].id);
          return;
        }

        // Fallback: create a new conversation thread on backend if empty
        const newConversation = await createNewConversation();
        if (!isMounted) return;

        if (newConversation && newConversation.id) {
          setConversations([newConversation]);
          setSelectedConversationId(newConversation.id);
        } else {
          // Local fallback ID if API response payload was empty
          const fallbackId = `conv-${Date.now()}`;
          const fallbackObj = { id: fallbackId, title: "New Chat", created_at: new Date().toISOString() };
          setConversations([fallbackObj]);
          setSelectedConversationId(fallbackId);
        }
      } catch (error) {
        console.error("Error initialising chat:", error);
        if (!isMounted) return;

        try {
          const fallbackConv = await createNewConversation();
          if (isMounted && fallbackConv && fallbackConv.id) {
            setConversations([fallbackConv]);
            setSelectedConversationId(fallbackConv.id);
            return;
          }
        } catch (fbErr) {
          console.error("Fallback creation failed:", fbErr);
        }

        // Ensure we always have an active thread ID so UI is immediately interactive
        const localFallbackId = `conv-${Date.now()}`;
        const localFallbackObj = { id: localFallbackId, title: "New Chat", created_at: new Date().toISOString() };
        setConversations([localFallbackObj]);
        setSelectedConversationId(localFallbackId);
      } finally {
        if (isMounted) setConversationsLoaded(true);
      }
    }

    initChat();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setSidebarOpen(window.innerWidth > 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* ── Load messages when conversation switches ── */
  useEffect(() => {
    if (!selectedConversationId) return;

    let active = true;
    fetchMessages(selectedConversationId)
      .then((data) => {
        if (active) setMessages(data || []);
      })
      .catch((error) => {
        if (active) console.error(error);
      });

    return () => {
      active = false;
    };
  }, [selectedConversationId]);

  /* Called by Sidebar's New Chat button */
  const handleSetSelectedConversationId = (id) => {
    setMessages([]);
    setSelectedConversationId(id);
  };

  /* ── Delete Conversation Handlers ── */
  const handleRequestDelete = (conv) => {
    if (!conv) return;
    setDeleteTarget({ id: conv.id, title: conv.title || "New Chat" });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.id) return;
    setIsDeletingChat(true);
    try {
      try {
        await deleteConversation(deleteTarget.id);
      } catch (err) {
        console.warn("deleteConversation backend notice:", err);
      }

      const remaining = conversations.filter((c) => c.id !== deleteTarget.id);

      if (selectedConversationId === deleteTarget.id) {
        if (remaining.length > 0) {
          handleSetSelectedConversationId(remaining[0].id);
          setConversations(remaining);
        } else {
          // If the last chat was deleted, seamlessly create a fresh conversation
          try {
            const newConv = await createNewConversation();
            if (newConv && newConv.id) {
              setConversations([newConv]);
              handleSetSelectedConversationId(newConv.id);
            } else {
              const fallbackId = `conv-${Date.now()}`;
              const fallbackObj = { id: fallbackId, title: "New Chat", created_at: new Date().toISOString() };
              setConversations([fallbackObj]);
              handleSetSelectedConversationId(fallbackId);
            }
          } catch (createErr) {
            console.error("Failed to create new conversation after delete:", createErr);
            const fallbackId = `conv-${Date.now()}`;
            const fallbackObj = { id: fallbackId, title: "New Chat", created_at: new Date().toISOString() };
            setConversations([fallbackObj]);
            handleSetSelectedConversationId(fallbackId);
          }
        }
      } else {
        setConversations(remaining);
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error("Error during deletion:", err);
    } finally {
      setIsDeletingChat(false);
    }
  };

  // Readiness condition: active model and selected conversation ID exist
  const isReady = Boolean(model && selectedConversationId);

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        setConversations={setConversations}
        selectedConversationId={selectedConversationId}
        setSelectedConversationId={handleSetSelectedConversationId}
        onRequestDelete={handleRequestDelete}
        onTitleUpdate={(convId, title) => {
          setConversations((prev) =>
            prev.map((c) => (c.id === convId ? { ...c, title } : c))
          );
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-content">
        <ChatHeader
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          sidebarOpen={sidebarOpen}
          model={model}
          setModel={handleSetModel}
          models={models}
          modelsByProvider={modelsByProvider}
          darkMode={darkMode}
          toggleDark={toggleDark}
          conversationTitle={selectedConversation?.title}
          selectedConversationId={selectedConversationId}
          onDeleteCurrentChat={() =>
            handleRequestDelete(selectedConversation || { id: selectedConversationId, title: "New Chat" })
          }
        />

        <ChatWindow
          key={selectedConversationId || "no-conversation"}
          messages={messages}
          setMessages={setMessages}
          selectedConversationId={selectedConversationId}
          model={model}
          setModel={handleSetModel}
          isReady={isReady}
          initializationError={initializationError}
          isTitled={isTitled}
          onTitleUpdate={(convId, title) => {
            setConversations((prev) =>
              prev.map((c) => (c.id === convId ? { ...c, title } : c))
            );
          }}
        />
      </div>

      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        conversationTitle={deleteTarget?.title}
        onConfirm={handleConfirmDelete}
        onCancel={() => !isDeletingChat && setDeleteTarget(null)}
        isDeleting={isDeletingChat}
      />
    </div>
  );
}
