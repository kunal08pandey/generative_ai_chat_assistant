/**
 * File & Document Export Utilities
 * =================================
 * Provides clean, 1-click downloads for:
 * - Code files (.swift, .py, .sh, .php, .js, .html, .css, etc.)
 * - Excel spreadsheets (.xlsx / .csv)
 * - Word documents (.docx / .doc)
 * - Printable PDF documents (.pdf)
 * - Markdown / Plaintext (.md / .txt)
 */
const API_BASE = (import.meta.env?.VITE_API_BASE_URL || "").replace(/\/$/, "");

const LANGUAGE_MAP = {
  python: { ext: ".py", defaultName: "main.py", label: "Python", mime: "text/x-python", color: "#3B82F6" },
  py: { ext: ".py", defaultName: "main.py", label: "Python", mime: "text/x-python", color: "#3B82F6" },
  swift: { ext: ".swift", defaultName: "ContentView.swift", label: "Swift", mime: "text/x-swift", color: "#F97316" },
  bash: { ext: ".sh", defaultName: "script.sh", label: "Bash / Shell", mime: "application/x-sh", color: "#10B981" },
  sh: { ext: ".sh", defaultName: "script.sh", label: "Shell Script", mime: "application/x-sh", color: "#10B981" },
  shell: { ext: ".sh", defaultName: "script.sh", label: "Shell Script", mime: "application/x-sh", color: "#10B981" },
  zsh: { ext: ".sh", defaultName: "script.sh", label: "Zsh Script", mime: "application/x-sh", color: "#10B981" },
  php: { ext: ".php", defaultName: "index.php", label: "PHP", mime: "application/x-httpd-php", color: "#8B5CF6" },
  javascript: { ext: ".js", defaultName: "index.js", label: "JavaScript", mime: "text/javascript", color: "#FBBF24" },
  js: { ext: ".js", defaultName: "index.js", label: "JavaScript", mime: "text/javascript", color: "#FBBF24" },
  typescript: { ext: ".ts", defaultName: "index.ts", label: "TypeScript", mime: "application/typescript", color: "#3B82F6" },
  ts: { ext: ".ts", defaultName: "index.ts", label: "TypeScript", mime: "application/typescript", color: "#3B82F6" },
  jsx: { ext: ".jsx", defaultName: "Component.jsx", label: "React JSX", mime: "text/jsx", color: "#06B6D4" },
  tsx: { ext: ".tsx", defaultName: "Component.tsx", label: "React TSX", mime: "text/tsx", color: "#06B6D4" },
  html: { ext: ".html", defaultName: "index.html", label: "HTML", mime: "text/html", color: "#EA580C" },
  css: { ext: ".css", defaultName: "styles.css", label: "CSS", mime: "text/css", color: "#2563EB" },
  json: { ext: ".json", defaultName: "data.json", label: "JSON", mime: "application/json", color: "#64748B" },
  sql: { ext: ".sql", defaultName: "query.sql", label: "SQL", mime: "application/sql", color: "#0284C7" },
  c: { ext: ".c", defaultName: "main.c", label: "C", mime: "text/x-c", color: "#64748B" },
  cpp: { ext: ".cpp", defaultName: "main.cpp", label: "C++", mime: "text/x-c++src", color: "#2563EB" },
  "c++": { ext: ".cpp", defaultName: "main.cpp", label: "C++", mime: "text/x-c++src", color: "#2563EB" },
  java: { ext: ".java", defaultName: "Main.java", label: "Java", mime: "text/x-java-source", color: "#DC2626" },
  kotlin: { ext: ".kt", defaultName: "Main.kt", label: "Kotlin", mime: "text/x-kotlin", color: "#7C3AED" },
  kt: { ext: ".kt", defaultName: "Main.kt", label: "Kotlin", mime: "text/x-kotlin", color: "#7C3AED" },
  rust: { ext: ".rs", defaultName: "main.rs", label: "Rust", mime: "text/rust", color: "#D97706" },
  rs: { ext: ".rs", defaultName: "main.rs", label: "Rust", mime: "text/rust", color: "#D97706" },
  go: { ext: ".go", defaultName: "main.go", label: "Go", mime: "text/x-go", color: "#06B6D4" },
  golang: { ext: ".go", defaultName: "main.go", label: "Go", mime: "text/x-go", color: "#06B6D4" },
  ruby: { ext: ".rb", defaultName: "script.rb", label: "Ruby", mime: "text/x-ruby", color: "#EF4444" },
  rb: { ext: ".rb", defaultName: "script.rb", label: "Ruby", mime: "text/x-ruby", color: "#EF4444" },
  yaml: { ext: ".yaml", defaultName: "config.yaml", label: "YAML", mime: "text/yaml", color: "#E11D48" },
  yml: { ext: ".yaml", defaultName: "config.yaml", label: "YAML", mime: "text/yaml", color: "#E11D48" },
  markdown: { ext: ".md", defaultName: "document.md", label: "Markdown", mime: "text/markdown", color: "#475569" },
  md: { ext: ".md", defaultName: "document.md", label: "Markdown", mime: "text/markdown", color: "#475569" },
  text: { ext: ".txt", defaultName: "document.txt", label: "Plain Text", mime: "text/plain", color: "#64748B" },
  txt: { ext: ".txt", defaultName: "document.txt", label: "Plain Text", mime: "text/plain", color: "#64748B" },
  csv: { ext: ".csv", defaultName: "data.csv", label: "CSV", mime: "text/csv", color: "#107C41" },
  tsv: { ext: ".tsv", defaultName: "data.tsv", label: "TSV", mime: "text/tab-separated-values", color: "#107C41" },
  excel: { ext: ".xlsx", defaultName: "spreadsheet.xlsx", label: "Excel", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", color: "#107C41" },
  xlsx: { ext: ".xlsx", defaultName: "spreadsheet.xlsx", label: "Excel", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", color: "#107C41" },
  xls: { ext: ".xls", defaultName: "spreadsheet.xls", label: "Excel", mime: "application/vnd.ms-excel", color: "#107C41" },
  sheets: { ext: ".xlsx", defaultName: "spreadsheet.xlsx", label: "Spreadsheet", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", color: "#107C41" },
  xml: { ext: ".xml", defaultName: "document.xml", label: "XML", mime: "application/xml", color: "#D97706" },
  dockerfile: { ext: ".dockerfile", defaultName: "Dockerfile", label: "Dockerfile", mime: "text/plain", color: "#0284C7" },
};

export function getLanguageMeta(langOrName = "") {
  const clean = (langOrName || "").toLowerCase().trim();
  if (!clean) {
    return {
      ext: ".txt",
      defaultName: "code.txt",
      label: "Code",
      mime: "text/plain",
      color: "#64748B",
    };
  }
  if (LANGUAGE_MAP[clean]) {
    return LANGUAGE_MAP[clean];
  }
  // Try matching extension safely
  for (const key in LANGUAGE_MAP) {
    const mapExt = (LANGUAGE_MAP[key].ext || "").replace(".", "").toLowerCase();
    if (mapExt && clean === mapExt) {
      return LANGUAGE_MAP[key];
    }
  }
  return {
    ext: ".txt",
    defaultName: "code.txt",
    label: clean.toUpperCase(),
    mime: "text/plain",
    color: "#64748B",
  };
}

/**
 * Extract filename from code block info string, comment headers, or defaults
 */
export function extractFilename(code = "", language = "", infoString = "") {
  // 1. Check info string: e.g. python filename="app.py" or swift:ContentView.swift
  if (infoString) {
    const fnMatch =
      infoString.match(/filename=["']?([a-zA-Z0-9_\-.]+)["']?/i) ||
      infoString.match(/name=["']?([a-zA-Z0-9_\-.]+)["']?/i) ||
      infoString.match(/[:=]([a-zA-Z0-9_\-.]+\.[a-zA-Z0-9]+)/i);
    if (fnMatch && fnMatch[1]) {
      return fnMatch[1];
    }
  }

  // 2. Check first line comments: e.g. // ContentView.swift or # app.py or /* index.php */
  const firstLine = (code.split("\n")[0] || "").trim();
  const commentPatterns = [
    /^(?:\/\/\s*|#\s*|\/\*\s*)([a-zA-Z0-9_\-.]+\.[a-zA-Z0-9]{1,8})(?:\s*\*\/)?$/,
    /^(?:#|\/\/)\s*(?:filename|file|name):\s*([a-zA-Z0-9_\-.]+\.[a-zA-Z0-9]{1,8})/i,
    /^<!--\s*([a-zA-Z0-9_\-.]+\.[a-zA-Z0-9]{1,8})\s*-->/,
  ];

  for (const pattern of commentPatterns) {
    const match = firstLine.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // 3. If explicit language provided, use its default filename
  if (language && language.trim().length > 0) {
    const meta = getLanguageMeta(language);
    return meta.defaultName;
  }

  return "";
}

/**
 * Checks if a message text contains markdown table data
 */
export function hasTableContent(text = "") {
  return /\|.+?\|.+?\|\n\s*\|?[-:]+[-|\s:]*\|?/m.test(text);
}

/**
 * Immediate in-browser download of any string content as a file
 */
export function downloadFile(content, filename, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Export document content to Microsoft Word (.docx or .doc)
 */
export async function exportToDoc(title = "Document", content = "", filename = "document.docx") {
  const docFilename = filename.endsWith(".docx") ? filename : `${filename.replace(/\.[^/.]+$/, "")}.docx`;

  // Try backend /export/docx first
  try {
    const res = await fetch(`${API_BASE}/export/docx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content,
        filename: docFilename,
      }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = docFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    }
  } catch (err) {
    console.warn("Backend /export/docx failed, falling back to client-side DOC:", err);
  }

  // Client-side fallback: Word-compatible HTML format
  const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1e293b; }
        h1 { color: #1e3a8a; font-size: 18pt; margin-bottom: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
        h2 { color: #2563eb; font-size: 14pt; margin-top: 18px; }
        h3 { color: #3b82f6; font-size: 12pt; }
        p { margin-bottom: 8px; }
        pre { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; font-family: 'Consolas', monospace; font-size: 10pt; border-radius: 4px; }
        ul, ol { margin-left: 20px; margin-bottom: 12px; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div>${content.replace(/\n/g, "<br/>")}</div>
    </body>
    </html>
  `;
  const fallbackName = docFilename.replace(".docx", ".doc");
  downloadFile(htmlContent, fallbackName, "application/msword;charset=utf-8");
  return true;
}

/**
 * Export table or CSV content to Microsoft Excel (.xlsx)
 */
export async function exportToExcel(title = "Spreadsheet", content = "", filename = "spreadsheet.xlsx") {
  const xlsxFilename = filename.endsWith(".xlsx") ? filename : `${filename.replace(/\.[^/.]+$/, "")}.xlsx`;

  // Try backend /export/xlsx first
  try {
    const res = await fetch(`${API_BASE}/export/xlsx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content,
        filename: xlsxFilename,
      }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = xlsxFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    }
  } catch (err) {
    console.warn("Backend /export/xlsx failed, falling back to client-side CSV:", err);
  }

  // Client-side fallback: CSV with UTF-8 BOM so Excel opens it with proper column layout
  let csvContent = content;
  if (content.includes("|")) {
    const lines = content.split("\n");
    const csvRows = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || /^\|?\s*[-:]+[-|\s:]*\|?$/.test(trimmed)) continue;
      if (trimmed.includes("|")) {
        const cells = trimmed
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => `"${c.trim().replace(/"/g, '""')}"`);
        csvRows.push(cells.join(","));
      }
    }
    if (csvRows.length > 0) {
      csvContent = csvRows.join("\n");
    }
  }

  // Prepend UTF-8 BOM \uFEFF for Excel
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
  const csvFilename = xlsxFilename.replace(".xlsx", ".csv");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = csvFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/**
 * Print / Export document to clean PDF using browser's print engine
 */
export function exportToPdf(title = "Document", content = "") {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to export to PDF.");
    return;
  }

  // Convert basic markdown paragraphs, headings, and code
  const formattedHtml = content
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/^\s*[-*]\s+(.*$)/gim, "<li>$1</li>")
    .replace(/```([\s\S]*?)```/gm, "<pre><code>$1</code></pre>")
    .replace(/\n\n/g, "</p><p>");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        @page { margin: 20mm; size: A4; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 11pt;
          line-height: 1.6;
          color: #0f172a;
          margin: 0;
          padding: 24px;
        }
        h1 { font-size: 20pt; color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 0; }
        h2 { font-size: 15pt; color: #2563eb; margin-top: 24px; }
        h3 { font-size: 13pt; color: #3b82f6; }
        p { margin: 8px 0; }
        pre {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 12px;
          font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
          font-size: 9.5pt;
          overflow-x: auto;
          white-space: pre-wrap;
          page-break-inside: avoid;
        }
        li { margin-bottom: 4px; }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div><p>${formattedHtml}</p></div>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
