import { Sparkles, Code, Lightbulb, BookOpen, Zap } from "lucide-react";

const suggestions = [
  {
    icon: Code,
    title: "Write Code",
    description: "Help me build a REST API with Node.js",
  },
  {
    icon: Lightbulb,
    title: "Brainstorm Ideas",
    description: "Give me 10 startup ideas in AI",
  },
  {
    icon: BookOpen,
    title: "Explain Concepts",
    description: "Explain quantum computing simply",
  },
  {
    icon: Zap,
    title: "Solve Problems",
    description: "Debug my React useEffect issue",
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
              onClick={() => onSuggestionClick(s.description)}
            >
              <div className="suggestion-icon">
                <Icon />
              </div>
              <div>
                <h4>{s.title}</h4>
                <p>{s.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}