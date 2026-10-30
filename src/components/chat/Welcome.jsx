import {
  Sparkles,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCode,
  Layers,
  FileText,
  Brain,
} from "lucide-react";

const suggestions = [
  {
    icon: ImageIcon,
    title: "Generate AI Images",
    tag: "Gemini / Flux",
    description: "Create vivid 8K photorealistic artwork or concept designs",
    prompt: "Generate an image of a futuristic floating city at sunset, 8k photorealistic concept art",
    color: "#8B5CF6",
  },
  {
    icon: FileSpreadsheet,
    title: "Excel Spreadsheets",
    tag: ".xlsx / CSV",
    description: "Build financial models, forecasts, and tables exportable to Excel",
    prompt: "Create an annual sales forecast Excel spreadsheet (.xlsx) with revenue, expenses, and growth projections",
    color: "#107C41",
  },
  {
    icon: FileCode,
    title: "Write Code & Scripts",
    tag: ".py .swift .sh",
    description: "Generate Python, Swift, Shell, or JS with 1-click file download",
    prompt: "Write a modular Python script with error handling and CLI arguments to process CSV data",
    color: "#2563EB",
  },
  {
    icon: Layers,
    title: "Analyze Documents",
    tag: "PDF / Word / TXT",
    description: "Upload or drop documents to extract data, query, and summarize",
    prompt: "What key insights, summaries, and action items can you extract from my uploaded document?",
    color: "#F59E0B",
  },
  {
    icon: FileText,
    title: "Draft Documents",
    tag: "Word & PDF",
    description: "Write detailed proposals and guides ready to export as Word or PDF",
    prompt: "Draft a comprehensive project proposal document ready to export as Word or PDF",
    color: "#E11D48",
  },
  {
    icon: Brain,
    title: "Deep Reasoning",
    tag: "Thinking Mode",
    description: "Step-by-step thinking for system architecture and algorithms",
    prompt: "Analyze the architectural trade-offs between Microservices and Monoliths with a decision matrix",
    color: "#6366F1",
  },
];

export default function WelcomeScreen({ onSuggestionClick }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-icon">
        <Sparkles />
      </div>
      <h2 className="welcome-title">How can I help you today?</h2>
      <p className="welcome-subtitle">
        I&apos;m your AI assistant powered by GEN Labs. Ask me anything — from
        coding and writing to analysis and creative work.
      </p>

      <div className="suggestion-grid">
        {suggestions.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.title}
              className="suggestion-card"
              onClick={() => onSuggestionClick(s.prompt)}
              type="button"
            >
              <div
                className="suggestion-icon"
                style={{
                  color: s.color,
                  backgroundColor: `${s.color}18`,
                }}
              >
                <Icon size={20} />
              </div>
              <div className="suggestion-content">
                <div className="suggestion-header">
                  <h4>{s.title}</h4>
                  {s.tag && <span className="suggestion-tag">{s.tag}</span>}
                </div>
                <p>{s.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}