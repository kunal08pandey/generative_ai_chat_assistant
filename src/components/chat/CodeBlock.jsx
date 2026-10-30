import { useState } from "react";
import {
  Copy,
  Check,
  Download,
  FileCode,
  Terminal,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import {
  extractFilename,
  getLanguageMeta,
  downloadFile,
  exportToExcel,
} from "../../utils/fileExporter";

export default function CodeBlock({ language = "", value = "", inline = false, meta = "" }) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  // If inline code `...`, render inline
  if (inline) {
    return <code className="inline-code-badge">{value}</code>;
  }

  const cleanCode = typeof value === "string" ? value : String(value || "");
  const detectedFilename = extractFilename(cleanCode, language, meta);
  const langMeta = getLanguageMeta(language || (detectedFilename ? detectedFilename.split(".").pop() : ""));

  const isExcelOrCsv = ["csv", "tsv", "excel", "xlsx", "xls", "sheets"].includes(
    (language || "").toLowerCase().trim()
  );

  const displayName = detectedFilename || (language ? langMeta.label : "code");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code: ", err);
    }
  };

  const handleDownload = async () => {
    if (isExcelOrCsv) {
      const xlsxName = detectedFilename
        ? detectedFilename.replace(/\.[^/.]+$/, ".xlsx")
        : "spreadsheet.xlsx";
      await exportToExcel("Sheet", cleanCode, xlsxName);
    } else {
      const saveName = detectedFilename || langMeta.defaultName;
      downloadFile(cleanCode, saveName, langMeta.mime);
    }
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const renderIcon = () => {
    if (isExcelOrCsv) {
      return <FileSpreadsheet size={15} style={{ color: "#107C41" }} />;
    }
    const l = (language || "").toLowerCase();
    if (l === "sh" || l === "bash" || l === "zsh" || l === "shell") {
      return <Terminal size={15} style={{ color: langMeta.color }} />;
    }
    if (l === "md" || l === "markdown" || l === "txt") {
      return <FileText size={15} style={{ color: langMeta.color }} />;
    }
    return <FileCode size={15} style={{ color: langMeta.color }} />;
  };

  return (
    <div className="code-artifact-container">
      {/* Code Header Bar (ChatGPT / Gemini style) */}
      <div className="code-artifact-header">
        <div className="code-header-left">
          <div className="code-file-icon">{renderIcon()}</div>
          <span className="code-filename" title={displayName}>
            {displayName}
          </span>
          {detectedFilename && (
            <span
              className="code-lang-pill"
              style={{
                borderColor: `${langMeta.color}40`,
                backgroundColor: `${langMeta.color}15`,
                color: langMeta.color,
              }}
            >
              {langMeta.label}
            </span>
          )}
        </div>

        <div className="code-header-right">
          {/* Copy Button */}
          <button
            type="button"
            className={`code-action-btn ${copied ? "success" : ""}`}
            onClick={handleCopy}
            title="Copy code to clipboard"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          {/* Download File Button */}
          <button
            type="button"
            className={`code-action-btn ${isExcelOrCsv ? "excel-download" : "primary-download"} ${downloaded ? "success" : ""}`}
            onClick={handleDownload}
            title={isExcelOrCsv ? "Download as Excel (.xlsx)" : `Download ${detectedFilename || langMeta.ext || "file"}`}
          >
            {downloaded ? <Check size={14} /> : <Download size={14} />}
            <span>
              {downloaded
                ? "Saved!"
                : isExcelOrCsv
                ? "Download Excel (.xlsx)"
                : `Download ${langMeta.ext || ""}`}
            </span>
          </button>
        </div>
      </div>

      {/* Code Content */}
      <div className="code-artifact-body">
        <pre className="code-pre">
          <code className={`code-content language-${language || "text"}`}>
            {cleanCode}
          </code>
        </pre>
      </div>
    </div>
  );
}
