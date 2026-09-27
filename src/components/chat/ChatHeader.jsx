import { Moon, Sun, PanelLeftClose, PanelLeft } from "lucide-react";

export default function ChatHeader({
  onToggleSidebar,
  sidebarOpen,
  model,
  setModel,
  models,
  darkMode,
  toggleDark,
}) {
  return (
    <header className="chat-header">
      {/* Left: toggle + title */}
      <div className="chat-header-left">
        <button className="icon-btn" onClick={onToggleSidebar} title="Toggle sidebar">
          {sidebarOpen ? <PanelLeftClose /> : <PanelLeft />}
        </button>
        <div>
          <div className="chat-header-title">GEN Labs Assistant</div>
          <div className="chat-header-subtitle">Horizon AI Interface</div>
        </div>
      </div>

      {/* Right: Model tabs + dark mode */}
      <div className="chat-header-right">
        {/* Model selector tabs */}
        {models.length > 0 && (
          <div className="model-selector-header">
            {models.map((m) => (
              <button
                key={m}
                className={`model-tab ${model === m ? "active" : ""}`}
                onClick={() => setModel(m)}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {/* Dark mode toggle */}
        <button className="icon-btn" onClick={toggleDark} title="Toggle dark mode">
          {darkMode ? <Sun /> : <Moon />}
        </button>
      </div>
    </header>
  );
}
