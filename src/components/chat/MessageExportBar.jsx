import { useState, useRef, useEffect } from "react";
import {
  Copy,
  Check,
  FileDown,
  FileSpreadsheet,
  Printer,
  FileText,
  ChevronDown,
  Trash2,
  RotateCw,
} from "lucide-react";
import {
  exportToDoc,
  exportToPdf,
  exportToExcel,
  downloadFile,
  hasTableContent,
} from "../../utils/fileExporter";

export default function MessageExportBar({ text = "", onDelete = null, onRegenerate = null }) {
  const [copied, setCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [excelSuccess, setExcelSuccess] = useState(false);
  const [docxSuccess, setDocxSuccess] = useState(false);
  const menuRef = useRef(null);

  const containsTable = hasTableContent(text);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showExportMenu]);

  if (!text || text.trim().length === 0) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleDownloadExcel = async () => {
    setShowExportMenu(false);
    const firstHeading = text.match(/^#+\s*(.+)$/m)?.[1] || "Spreadsheet";
    const cleanTitle = firstHeading.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
    await exportToExcel(cleanTitle, text, `${cleanTitle}.xlsx`);
    setExcelSuccess(true);
    setTimeout(() => setExcelSuccess(false), 2000);
  };

  const handleDownloadDocx = async () => {
    setShowExportMenu(false);
    const firstHeading = text.match(/^#+\s*(.+)$/m)?.[1] || "Document";
    const cleanTitle = firstHeading.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
    await exportToDoc(cleanTitle, text, `${cleanTitle}.docx`);
    setDocxSuccess(true);
    setTimeout(() => setDocxSuccess(false), 2000);
  };

  const handleDownloadPdf = () => {
    setShowExportMenu(false);
    const firstHeading = text.match(/^#+\s*(.+)$/m)?.[1] || "Document";
    exportToPdf(firstHeading, text);
  };

  const handleDownloadMd = () => {
    setShowExportMenu(false);
    const firstHeading = text.match(/^#+\s*(.+)$/m)?.[1] || "document";
    const cleanTitle = firstHeading.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
    downloadFile(text, `${cleanTitle}.md`, "text/markdown;charset=utf-8");
  };

  return (
    <div className="gemini-message-footer">
      <div className="gemini-action-group">
        {/* Copy Button */}
        <button
          type="button"
          className={`gemini-icon-btn ${copied ? "success" : ""}`}
          onClick={handleCopy}
          title={copied ? "Copied to clipboard!" : "Copy response"}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied && <span className="btn-feedback">Copied</span>}
        </button>

        {/* Regenerate Button */}
        {onRegenerate && (
          <button
            type="button"
            className="gemini-icon-btn regenerate-btn"
            onClick={onRegenerate}
            title="Regenerate this response"
          >
            <RotateCw size={13} />
            <span>Retry</span>
          </button>
        )}

        {/* If the message contains tabular data, show direct Excel download button */}
        {containsTable && (
          <button
            type="button"
            className={`gemini-icon-btn excel-direct-btn ${excelSuccess ? "success" : ""}`}
            onClick={handleDownloadExcel}
            title="Download as Excel spreadsheet (.xlsx)"
          >
            {excelSuccess ? <Check size={14} /> : <FileSpreadsheet size={14} />}
            <span>{excelSuccess ? "Saved!" : "Excel (.xlsx)"}</span>
          </button>
        )}

        {/* Export Dropdown Menu (Gemini / ChatGPT Style) */}
        <div className="gemini-export-wrapper" ref={menuRef}>
          <button
            type="button"
            className={`gemini-icon-btn export-trigger ${showExportMenu ? "active" : ""}`}
            onClick={() => setShowExportMenu((prev) => !prev)}
            title="Export / Download options"
          >
            <FileDown size={14} />
            <span>Export</span>
            <ChevronDown size={12} className={`export-chevron ${showExportMenu ? "open" : ""}`} />
          </button>

          {showExportMenu && (
            <div className="gemini-export-dropdown">
              <button
                type="button"
                className="gemini-dropdown-item"
                onClick={handleDownloadExcel}
              >
                <FileSpreadsheet size={15} style={{ color: "#107C41" }} />
                <span>Export to Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                className="gemini-dropdown-item"
                onClick={handleDownloadDocx}
              >
                <FileDown size={15} style={{ color: "#2563EB" }} />
                <span>Export to Word (.docx)</span>
              </button>

              <button
                type="button"
                className="gemini-dropdown-item"
                onClick={handleDownloadPdf}
              >
                <Printer size={15} style={{ color: "#DC2626" }} />
                <span>Print / Save as PDF (.pdf)</span>
              </button>

              <div className="gemini-dropdown-divider" />

              <button
                type="button"
                className="gemini-dropdown-item"
                onClick={handleDownloadMd}
              >
                <FileText size={15} style={{ color: "#64748B" }} />
                <span>Download Markdown (.md)</span>
              </button>
            </div>
          )}
        </div>

        {/* Delete button */}
        {onDelete && (
          <button
            type="button"
            className="gemini-icon-btn delete-msg-btn"
            onClick={onDelete}
            title="Delete this message"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
