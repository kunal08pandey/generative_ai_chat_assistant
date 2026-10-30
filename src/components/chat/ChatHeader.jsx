import { useState, useRef, useEffect } from "react";
import {
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  Sparkles,
  Cpu,
  Box,
  Check,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";

export default function ChatHeader({
  onToggleSidebar,
  sidebarOpen,
  model,
  setModel,
  models = [],
  modelsByProvider = {},
  darkMode,
  toggleDark,
  conversationTitle,
  onDeleteCurrentChat,
  selectedConversationId,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Categorize models by provider
  const groupedModels = (() => {
    const hasProviderData = Object.keys(modelsByProvider).length > 0;
    if (hasProviderData) {
      const order = ["gemini", "ollama", "llama_cpp"];
      const sortedKeys = Object.keys(modelsByProvider).sort((a, b) => {
        const idxA = order.indexOf(a);
        const idxB = order.indexOf(b);
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      });

      return sortedKeys.map((providerKey) => {
        let label = "Ollama Local";
        let iconType = "ollama";
        if (providerKey === "gemini") {
          label = "Google Gemini";
          iconType = "gemini";
        } else if (providerKey === "llama_cpp") {
          label = "Llama.cpp";
          iconType = "llama";
        }
        return {
          provider: providerKey,
          label,
          iconType,
          models: modelsByProvider[providerKey] || [],
        };
      });
    }

    // Fallback heuristic if modelsByProvider is not yet populated
    const geminiList = models.filter(
      (m) => m.toLowerCase().includes("gemini") || m.toLowerCase().includes("argon")
    );
    const llamaList = models.filter((m) => m.toLowerCase().includes("gguf"));
    const ollamaList = models.filter(
      (m) => !geminiList.includes(m) && !llamaList.includes(m)
    );

    const groups = [];
    if (geminiList.length > 0) {
      groups.push({ provider: "gemini", label: "Google Gemini", iconType: "gemini", models: geminiList });
    }
    if (ollamaList.length > 0) {
      groups.push({ provider: "ollama", label: "Ollama Local", iconType: "ollama", models: ollamaList });
    }
    if (llamaList.length > 0) {
      groups.push({ provider: "llama_cpp", label: "Llama.cpp", iconType: "llama", models: llamaList });
    }
    return groups;
  })();

  const getProviderIcon = (modelName) => {
    const lower = (modelName || "").toLowerCase();
    if (lower.includes("gemini") || lower.includes("argon")) {
      return <Sparkles className="model-icon gemini-icon" />;
    }
    if (lower.includes("flux")) {
      return <ImageIcon className="model-icon" />;
    }
    if (lower.includes("gguf")) {
      return <Box className="model-icon llama-icon" />;
    }
    return <Cpu className="model-icon ollama-icon" />;
  };

  const getModelBadge = (modelName) => {
    const lower = (modelName || "").toLowerCase();
    if (lower.includes("argon")) return { label: "Frontier", type: "frontier" };
    if (lower.includes("pro")) return { label: "Pro", type: "pro" };
    if (lower.includes("flash-lite")) return { label: "Lite", type: "lite" };
    if (lower.includes("flash")) return { label: "Fast", type: "fast" };
    if (lower.includes("coder")) return { label: "Code", type: "code" };
    if (lower.includes("flux") || lower.includes("turbo") || lower.includes("image")) return { label: "Vision", type: "vision" };
    return null;
  };

  const handleSelectModel = (m) => {
    setModel(m);
    setIsOpen(false);
  };

  const activeBadge = getModelBadge(model);

  return (
    <header className="chat-header">
      {/* Left: toggle + title */}
      <div className="chat-header-left">
        <button className="icon-btn" onClick={onToggleSidebar} title="Toggle sidebar">
          {sidebarOpen ? <PanelLeftClose /> : <PanelLeft />}
        </button>
        <div>
          <div className="chat-header-title" title={conversationTitle || "GEN Labs Assistant"}>
            {conversationTitle || "GEN Labs Assistant"}
          </div>
          <div className="chat-header-subtitle">Horizon AI Interface</div>
        </div>
      </div>

      {/* Right: Model dropdown selector + dark mode */}
      <div className="chat-header-right">
        {models.length > 0 && (
          <div className="model-dropdown-container" ref={dropdownRef}>
            <button
              className={`model-dropdown-trigger ${isOpen ? "active" : ""}`}
              onClick={() => setIsOpen(!isOpen)}
              aria-haspopup="listbox"
              aria-expanded={isOpen}
              title="Select AI Model"
              type="button"
            >
              <div className="trigger-content">
                {getProviderIcon(model)}
                <span className="trigger-model-name">{model || "Select Model"}</span>
                {activeBadge && (
                  <span className={`model-badge badge-${activeBadge.type}`}>
                    {activeBadge.label}
                  </span>
                )}
              </div>
              <ChevronDown className={`chevron-icon ${isOpen ? "rotate" : ""}`} />
            </button>

            {isOpen && (
              <div className="model-dropdown-popover" role="listbox">
                <div className="dropdown-scroll-container">
                  {groupedModels.map((group) => {
                    if (!group.models || group.models.length === 0) return null;
                    return (
                      <div key={group.provider} className="model-group-section">
                        <div className="model-group-header">
                          {group.iconType === "gemini" && <Sparkles className="group-header-icon gemini-header-icon" />}
                          {group.iconType === "ollama" && <Cpu className="group-header-icon ollama-header-icon" />}
                          {group.iconType === "llama" && <Box className="group-header-icon llama-header-icon" />}
                          <span>{group.label}</span>
                        </div>
                        <div className="model-group-items">
                          {group.models.map((m) => {
                            const isSelected = model === m;
                            const badge = getModelBadge(m);
                            return (
                              <button
                                key={m}
                                className={`model-dropdown-item ${isSelected ? "selected" : ""}`}
                                onClick={() => handleSelectModel(m)}
                                role="option"
                                aria-selected={isSelected}
                                type="button"
                              >
                                <div className="item-left">
                                  {getProviderIcon(m)}
                                  <span className="item-model-name">{m}</span>
                                  {badge && (
                                    <span className={`model-badge badge-${badge.type}`}>
                                      {badge.label}
                                    </span>
                                  )}
                                </div>
                                {isSelected && <Check className="item-check-icon" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delete current chat button */}
        {selectedConversationId && onDeleteCurrentChat && (
          <button
            className="icon-btn delete-chat-header-btn"
            onClick={onDeleteCurrentChat}
            title="Delete this chat"
            aria-label="Delete this chat"
            type="button"
          >
            <Trash2 size={18} />
          </button>
        )}

        {/* Dark mode toggle */}
        <button className="icon-btn" onClick={toggleDark} title="Toggle dark mode">
          {darkMode ? <Sun /> : <Moon />}
        </button>
      </div>
    </header>
  );
}
