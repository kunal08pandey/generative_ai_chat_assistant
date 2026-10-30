import { useState, useRef } from "react";
import { Download, FileSpreadsheet, Copy, Check } from "lucide-react";
import { exportToExcel, downloadFile } from "../../utils/fileExporter";

export default function TableBlock({ children, ...props }) {
  const tableRef = useRef(null);
  const [downloaded, setDownloaded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Extract CSV representation from the rendered table DOM
  const getTableCsv = () => {
    if (!tableRef.current) return "";
    const trs = tableRef.current.querySelectorAll("tr");
    const rows = [];
    trs.forEach((tr) => {
      const cells = [];
      tr.querySelectorAll("th, td").forEach((c) => {
        const text = c.innerText.replace(/"/g, '""').trim();
        cells.push(`"${text}"`);
      });
      if (cells.length > 0) {
        rows.push(cells.join(","));
      }
    });
    return rows.join("\n");
  };

  const handleDownloadExcel = async () => {
    const csv = getTableCsv();
    if (!csv) return;
    await exportToExcel("Data Sheet", csv, "spreadsheet.xlsx");
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const handleDownloadCsv = () => {
    const csv = getTableCsv();
    if (!csv) return;
    downloadFile("\uFEFF" + csv, "data.csv", "text/csv;charset=utf-8");
  };

  const handleCopy = async () => {
    const csv = getTableCsv();
    if (!csv) return;
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy table: ", err);
    }
  };

  return (
    <div className="table-artifact-wrapper">
      {/* Table Action Header Bar */}
      <div className="table-artifact-header">
        <div className="table-header-left">
          <FileSpreadsheet size={15} className="table-header-icon" />
          <span className="table-header-title">Data Table</span>
        </div>

        <div className="table-header-right">
          {/* Copy Table */}
          <button
            type="button"
            className="table-action-btn"
            onClick={handleCopy}
            title="Copy table data"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          {/* Download CSV */}
          <button
            type="button"
            className="table-action-btn"
            onClick={handleDownloadCsv}
            title="Download as CSV file"
          >
            <Download size={13} />
            <span>CSV</span>
          </button>

          {/* Download Excel */}
          <button
            type="button"
            className="table-action-btn excel-btn"
            onClick={handleDownloadExcel}
            title="Download as Microsoft Excel (.xlsx)"
          >
            {downloaded ? <Check size={13} /> : <Download size={13} />}
            <span>{downloaded ? "Saved!" : "Excel (.xlsx)"}</span>
          </button>
        </div>
      </div>

      {/* Table Element */}
      <div className="table-artifact-scroll" ref={tableRef}>
        <table className="custom-markdown-table" {...props}>
          {children}
        </table>
      </div>
    </div>
  );
}
