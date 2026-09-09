import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Sparkles,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Globe,
  FileText,
  Lightbulb,
  RotateCcw,
  Copy,
  Check,
} from "lucide-react";

const suggestedPrompts = [
  { icon: BarChart3, label: "Analyze my top performing pages", prompt: "What are my top performing pages in Google Search Console and why?" },
  { icon: TrendingUp, label: "Find keyword opportunities", prompt: "Which keywords have high impressions but low CTR? How can I improve them?" },
  { icon: TrendingDown, label: "Identify declining pages", prompt: "Which pages have lost the most traffic in the last 30 days and what might be causing it?" },
  { icon: Globe, label: "Compare mobile vs desktop", prompt: "Compare my mobile vs desktop search performance. Are there significant differences?" },
  { icon: FileText, label: "Content gap analysis", prompt: "Based on my current keyword data, what content gaps should I fill?" },
  { icon: Lightbulb, label: "Quick wins for traffic", prompt: "What are the easiest quick wins to increase my organic traffic based on my GSC data?" },
];

const mockConversation = [
  {
    role: "assistant",
    content: `Welcome! I'm your AI-powered Search Console analyst. I can help you understand your Google Search Console data, identify trends, and find optimization opportunities.\n\nHere's a quick overview of your connected properties:\n\n**• learnwirepro.com** — 2,847 total clicks (last 28 days)\n**• 156 indexed pages** across the domain\n**• Average position: 24.3** with 89,420 impressions\n\nWhat would you like to explore?`,
  },
];

export default function AiChatConsole() {
  const [messages, setMessages] = useState(mockConversation);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (text) => {
    const msg = text || input.trim();
    if (!msg) return;

    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = {
        default: `Great question! Let me analyze your Search Console data.\n\n**Key Findings:**\n\n1. **Top Keywords:** "AI software reviews" (312 clicks, Avg Pos 8.2), "best AI tools 2025" (189 clicks, Avg Pos 12.4), "honest tech reviews" (156 clicks, Avg Pos 6.8)\n\n2. **Pages with Highest CTR:**\n   - /blog/rybbit-review — 8.2% CTR (vs 3.1% site average)\n   - /blog/ai-writing-tools — 6.7% CTR\n   - /recommended/ — 5.9% CTR\n\n3. **Opportunity Zone:** You have 23 keywords ranking on page 2 (positions 11-20) with high impression counts. Moving these to page 1 could significantly increase traffic.\n\n**Recommendation:** Focus on updating and expanding content for your page-2 keywords. Add internal links from your high-authority pages to these target pages.\n\nWould you like me to dive deeper into any of these areas?`,
      };

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: responses.default },
      ]);
      setIsTyping(false);
    }, 1500);
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleReset = () => {
    setMessages(mockConversation);
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 120px)" }}>

      {/* Header */}
      <div className="ctool-hero mb-4 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="ctool-hero-icon">
              <MessageSquare className="h-5 w-5 ctool-accent" />
            </div>
            <div>
              <h1 className="ctool-title font-display">AI Chat Console</h1>
              <p className="ctool-help-text">Discuss and analyze your Search Console data with AI</p>
            </div>
          </div>
          <button onClick={handleReset} className="ui-button ctool-tool-btn">
            <RotateCcw className="h-3 w-3" /> New Chat
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="chat-transcript mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="ctool-empty-icon h-8 w-8">
                <Sparkles className="h-4 w-4" />
              </div>
            )}
            <div className={`chat-bubble ${msg.role === "user" ? "chat-bubble-user" : ""}`}>
              <div className="chat-text whitespace-pre-wrap">
                {msg.content.split(/(\*\*.*?\*\*)/).map((part, pi) =>
                  part.startsWith("**") && part.endsWith("**")
                    ? <strong key={pi} className="chat-strong">{part.slice(2, -2)}</strong>
                    : part
                )}
              </div>
              {msg.role === "assistant" && i > 0 && (
                <button
                  onClick={() => handleCopy(msg.content, i)}
                  className="chat-copy"
                >
                  {copiedIdx === i ? <Check className="h-3 w-3 chat-copied" /> : <Copy className="h-3 w-3" />}
                </button>
              )}
            </div>
            {msg.role === "user" && (
              <div className="chat-avatar">
                <span className="chat-avatar-initial">U</span>
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className="ctool-empty-icon h-8 w-8">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="chat-bubble">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts */}
      {messages.length <= 1 && (
        <div className="flex-shrink-0 mb-4">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {suggestedPrompts.map((sp, i) => {
              const Icon = sp.icon;
              return (
                <button
                  key={i}
                  onClick={() => handleSend(sp.prompt)}
                  className="chat-suggestion"
                >
                  <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span className="chat-suggestion-text">{sp.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="chat-composer flex-shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="stool-bare-input flex-1 px-3 py-2"
          placeholder="Ask about your Search Console data..."
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim()}
          className="ui-button ui-button-primary chat-send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
