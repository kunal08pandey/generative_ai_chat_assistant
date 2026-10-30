import { useEffect } from "react";
import { X, Download, ExternalLink, Image as ImageIcon } from "lucide-react";

export default function ImageLightbox({ isOpen, imageUrl, prompt = "Generated Image", onClose }) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  const handleDownload = async () => {
    try {
      const cleanName = (prompt || "generated_image")
        .slice(0, 40)
        .replace(/[^a-zA-Z0-9_\-]/g, "_")
        .toLowerCase();

      // If data URL or external URL
      if (imageUrl.startsWith("data:")) {
        const a = document.createElement("a");
        a.href = imageUrl;
        a.download = `${cleanName}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${cleanName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback
      window.open(imageUrl, "_blank");
    }
  };

  return (
    <div className="image-lightbox-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="image-lightbox-content" onClick={(e) => e.stopPropagation()}>
        {/* Header Controls */}
        <div className="image-lightbox-header">
          <div className="image-lightbox-title">
            <ImageIcon size={16} />
            <span title={prompt}>{prompt || "Generated Image"}</span>
          </div>
          <div className="image-lightbox-actions">
            <button
              type="button"
              className="lightbox-btn"
              onClick={handleDownload}
              title="Download image"
            >
              <Download size={16} />
              <span>Download</span>
            </button>
            <button
              type="button"
              className="lightbox-btn"
              onClick={() => window.open(imageUrl, "_blank")}
              title="Open full size in new tab"
            >
              <ExternalLink size={16} />
            </button>
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Full Image Display */}
        <div className="image-lightbox-body">
          <img
            src={imageUrl}
            alt={prompt || "Full size generated image"}
            className="image-lightbox-img"
          />
        </div>
      </div>
    </div>
  );
}
