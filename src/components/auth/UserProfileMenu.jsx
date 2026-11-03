import { useState, useRef, useEffect } from "react";
import { LogOut, User, Check, Shield, ExternalLink, ChevronDown } from "lucide-react";

export default function UserProfileMenu({ user, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (!user) return null;

  const initials = (user.name || user.email || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="user-profile-menu-container" ref={menuRef}>
      {/* Trigger button */}
      <button
        type="button"
        className={`user-avatar-trigger ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        title={`${user.name || user.email} (Google Account)`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {user.picture ? (
          <img src={user.picture} alt={user.name || "User"} className="user-avatar-img" />
        ) : (
          <div className="user-avatar-fallback">{initials}</div>
        )}
        <span className="user-status-dot" />
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="user-profile-popover" role="menu">
          {/* User info header */}
          <div className="profile-popover-header">
            <div className="popover-avatar-slot">
              {user.picture ? (
                <img src={user.picture} alt={user.name || "User"} className="popover-avatar-img" />
              ) : (
                <div className="popover-avatar-fallback">{initials}</div>
              )}
            </div>
            <div className="popover-user-details">
              <span className="popover-user-name" title={user.name}>
                {user.name || "Google User"}
              </span>
              <span className="popover-user-email" title={user.email}>
                {user.email}
              </span>
              <div className="popover-provider-badge">
                <span className="google-dot" />
                <span>Google Verified</span>
              </div>
            </div>
          </div>

          <div className="profile-popover-divider" />

          {/* Account status info */}
          <div className="profile-popover-section">
            <div className="profile-stat-row">
              <span className="stat-label">Session ID</span>
              <span className="stat-value">{user.id ? String(user.id).slice(0, 12) + "…" : "Active"}</span>
            </div>
            <div className="profile-stat-row">
              <span className="stat-label">Provider</span>
              <span className="stat-value">Google OAuth 2.0</span>
            </div>
          </div>

          <div className="profile-popover-divider" />

          {/* Sign Out Action */}
          <button
            type="button"
            className="profile-logout-btn"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}

