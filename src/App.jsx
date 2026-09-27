import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/chat/ChatWindow";
import ChatHeader from "./components/chat/ChatHeader";
import {
  fetchConversation,
  fetchMessages,
  createNewConversation,
  getModels,
} from "./api/client";


export default function App() {
  const [model, setModel] = useState("gemma4:e4b");
  const [models, setModels] = useState(["gemma4:e4b"]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [darkMode, setDarkMode] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [initializationError, setInitializationError] = useState("");

  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedConversationId
  );
  const isTitled = Boolean(
    selectedConversation?.title && selectedConversation.title !== "New Chat"
  );

  /* ── Dark mode ── */
  const toggleDark = () => {
    setDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  };

  /* ── Load models ── */
  useEffect(() => {
    let isMounted = true;
    getModels()
      .then((data) => {
        if (!isMounted) return;
        const all = Object.values(data || {}).flat();
        if (all && all.length > 0) {
          setModels(all);
          setModel(all[0]);
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

  // Readiness condition: active model and selected conversation ID exist
  const isReady = Boolean(model && selectedConversationId);

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        setConversations={setConversations}
        selectedConversationId={selectedConversationId}
        setSelectedConversationId={handleSetSelectedConversationId}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-content">
        <ChatHeader
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          sidebarOpen={sidebarOpen}
          model={model}
          setModel={setModel}
          models={models}
          darkMode={darkMode}
          toggleDark={toggleDark}
        />

        <ChatWindow
          key={selectedConversationId || "no-conversation"}
          messages={messages}
          setMessages={setMessages}
          selectedConversationId={selectedConversationId}
          model={model}
          setModel={setModel}
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
    </div>
  );
}
