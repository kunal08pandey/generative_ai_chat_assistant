import { useState, useEffect, useRef } from "react";
import { Sparkles, Sun, Moon, ArrowRight, ShieldCheck, Zap, Layers, FileCode, CheckCircle2 } from "lucide-react";
import { loginWithGoogleApi } from "../../api/client";

// Official Google "G" multicolor vector icon
function GoogleLogoSvg({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.79l7.97-6.2z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export default function LoginScreen({ onLoginSuccess, darkMode, toggleDark }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showManualLogin, setShowManualLogin] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [customName, setCustomName] = useState("");
  const tokenClientRef = useRef(null);

  const clientId = import.meta.env?.VITE_GOOGLE_CLIENT_ID || "";

  // Helper to initialize Google Identity Services OAuth2 token client
  const setupTokenClient = () => {
    if (!window.google?.accounts?.oauth2 || !clientId) return false;
    try {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "email profile openid",
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            console.error("Google OAuth token error:", tokenResponse);
            if (tokenResponse.error !== "popup_closed_by_user") {
              setError(`Google Sign-In error: ${tokenResponse.error_description || tokenResponse.error}`);
            }
            setLoading(false);
            return;
          }

          try {
            setLoading(true);
            setError("");
            // Fetch user's actual profile from Google's userinfo endpoint
            const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });

            if (!userInfoRes.ok) {
              throw new Error("Could not retrieve profile from Google UserInfo API");
            }

            const profile = await userInfoRes.json();
            const authData = await loginWithGoogleApi({
              email: profile.email,
              name: profile.name || profile.given_name,
              picture: profile.picture,
              google_id: profile.sub,
            });

            if (authData?.user) {
              onLoginSuccess(authData.user, authData.token);
            }
          } catch (authErr) {
            console.error("Failed to complete Google authentication:", authErr);
            setError(authErr.message || "Failed to complete Google authentication.");
          } finally {
            setLoading(false);
          }
        },
      });
      return true;
    } catch (err) {
      console.warn("Google Identity Services setup warning:", err);
      return false;
    }
  };

  // Wait for Google Identity Services SDK to load and initialize token client
  useEffect(() => {
    let interval = null;
    let attempts = 0;

    if (!setupTokenClient()) {
      interval = setInterval(() => {
        attempts += 1;
        if (setupTokenClient() || attempts > 25) {
          clearInterval(interval);
        }
      }, 200);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [clientId, onLoginSuccess]);

  // Click handler for custom Google Sign-In button
  const handleCustomGoogleBtnClick = () => {
    setError("");

    if (!clientId) {
      setError(
        "Google Client ID is not configured. Please add VITE_GOOGLE_CLIENT_ID to your .env file or choose a demo profile below."
      );
      return;
    }

    if (tokenClientRef.current) {
      setLoading(true);
      // Opens official Google account chooser popup
      tokenClientRef.current.requestAccessToken({ prompt: "select_account" });
    } else if (window.google?.accounts?.oauth2) {
      setupTokenClient();
      setLoading(true);
      tokenClientRef.current?.requestAccessToken({ prompt: "select_account" });
    } else {
      setError("Google Sign-In SDK is still loading. Please wait a moment and try again.");
    }
  };

  // Explicit demo profile login (only called when user clicks a demo profile chip)
  const handleDemoLogin = async (presetUser) => {
    setLoading(true);
    setError("");
    try {
      const result = await loginWithGoogleApi(presetUser);
      if (result && result.user) {
        onLoginSuccess(result.user, result.token);
      } else {
        throw new Error("Invalid response received from authentication service.");
      }
    } catch (err) {
      console.error("Demo sign-in error:", err);
      setError(err.message || "Authentication failed. Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Background ambient lighting */}
      <div className="login-ambient-glow" />

      {/* Top navbar controls */}
      <header className="login-topbar">
        <div className="login-brand-compact">
          <div className="sidebar-logo-icon">
            <img src="/logo.png" alt="Kshitiz AI Labs Logo" className="sidebar-logo-img" />
          </div>
          <span className="sidebar-logo-text">
            Kshitiz <span>AI Labs</span>
          </span>
        </div>

        <button
          className="icon-btn theme-toggle-btn"
          onClick={toggleDark}
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          type="button"
        >
          {darkMode ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </header>

      {/* Center Auth Card */}
      <main className="login-center-wrapper">
        <div className="login-card">
          {/* Badge */}
          <div className="login-badge">
            <Sparkles size={13} className="login-badge-icon" />
            <span>Studio Multi-Model Workspace</span>
          </div>

          {/* Logo icon */}
          <div className="login-card-logo">
            <img src="/logo.png" alt="Logo" className="login-card-logo-img" />
          </div>

          {/* Header titles */}
          <h1 className="login-title">Sign in to Kshitiz AI Labs</h1>
          <p className="login-subtitle">
            Access multi-model frontier intelligence, document reasoning, 
            and code artifacts with your Google Account.
          </p>

          {/* Error notice */}
          {error && (
            <div className="login-error-alert" role="alert">
              <span>{error}</span>
            </div>
          )}

          {/* Primary Google Auth Action */}
          <div className="login-actions-group">
            <button
              className={`google-signin-btn ${loading ? "google-signin-loading" : ""}`}
              onClick={handleCustomGoogleBtnClick}
              disabled={loading}
              type="button"
            >
              {loading ? (
                <div className="google-btn-spinner" />
              ) : (
                <GoogleLogoSvg size={20} />
              )}
              <span>{loading ? "Authenticating with Google…" : "Sign in with Google"}</span>
            </button>

            {/* Quick demo accounts for testing without OAuth consent config */}
            <div className="login-demo-helper">
              <span className="demo-helper-label">Or test with demo profiles:</span>
              <div className="demo-profiles-row">
                <button
                  type="button"
                  className="demo-profile-chip"
                  onClick={() =>
                    handleDemoLogin({
                      email: "alex.rivers@gmail.com",
                      name: "Alex Rivers",
                      picture: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80",
                      google_id: "google-alex-demo",
                    })
                  }
                  disabled={loading}
                >
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80"
                    alt="Alex"
                    className="demo-chip-avatar"
                  />
                  <span>Alex (Dev)</span>
                </button>

                <button
                  type="button"
                  className="demo-profile-chip"
                  onClick={() =>
                    handleDemoLogin({
                      email: "sarah.chen@gmail.com",
                      name: "Sarah Chen",
                      picture: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80",
                      google_id: "google-sarah-demo",
                    })
                  }
                  disabled={loading}
                >
                  <img
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80"
                    alt="Sarah"
                    className="demo-chip-avatar"
                  />
                  <span>Sarah (Research)</span>
                </button>
              </div>
            </div>

            {/* Custom Google Account details toggle */}
            {!showManualLogin ? (
              <button
                type="button"
                className="login-custom-toggle-btn"
                onClick={() => setShowManualLogin(true)}
              >
                Sign in with custom Google email
              </button>
            ) : (
              <form
                className="login-custom-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customEmail.trim()) {
                    handleDemoLogin({
                      email: customEmail.trim(),
                      name: customName.trim() || customEmail.split("@")[0].replace(".", " "),
                      picture: null,
                      google_id: `google-${Date.now()}`,
                    });
                  }
                }}
              >
                <div className="login-input-field">
                  <label htmlFor="google-email-input">Google Email</label>
                  <input
                    id="google-email-input"
                    type="email"
                    placeholder="your.email@gmail.com"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="login-input-field">
                  <label htmlFor="google-name-input">Full Name (optional)</label>
                  <input
                    id="google-name-input"
                    type="text"
                    placeholder="e.g. John Doe"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </div>
                <div className="custom-form-actions">
                  <button
                    type="button"
                    className="custom-cancel-btn"
                    onClick={() => setShowManualLogin(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="custom-submit-btn"
                    disabled={loading || !customEmail.trim()}
                  >
                    Continue <ArrowRight size={14} />
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Privacy & Security note */}
          <div className="login-card-footer">
            <ShieldCheck size={14} className="security-icon" />
            <span>Secure authentication verified by Kshitiz AI Labs Auth Services</span>
          </div>
        </div>

        {/* Studio Capabilities feature grid underneath */}
        <div className="login-features-row">
          <div className="login-feature-item">
            <div className="feature-icon-badge">
              <Zap size={16} />
            </div>
            <div className="feature-text">
              <h4>Multi-Model Studio</h4>
              <p>Gemini 2.5, Groq Llama-3, local Ollama, and GGUF runtimes.</p>
            </div>
          </div>

          <div className="login-feature-item">
            <div className="feature-icon-badge">
              <Layers size={16} />
            </div>
            <div className="feature-text">
              <h4>RAG Document Intelligence</h4>
              <p>Vector database retrieval for PDFs, Word documents, and Excel sheets.</p>
            </div>
          </div>

          <div className="login-feature-item">
            <div className="feature-icon-badge">
              <FileCode size={16} />
            </div>
            <div className="feature-text">
              <h4>Interactive Artifacts</h4>
              <p>Live syntax-highlighted code files, Excel exports, and visual previews.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="login-footer">
        <span>© 2026 Kshitiz AI Labs. Powered by Google Gemini & Ollama Runtimes.</span>
      </footer>
    </div>
  );
}

