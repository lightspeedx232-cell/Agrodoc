import { useEffect, useRef, useState } from "react";
import { assistantApi, farmApi, type ChatMessage } from "../lib/api";
import type { Farm } from "../lib/types";
import { PageHeader, Alert } from "../components/ui";

const SUGGESTED = [
  "How do I treat early blight on tomato?",
  "What is the best time to apply potash for paddy?",
  "Tell me about PM-KISAN eligibility",
  "How often should I irrigate onion in Kerala?",
  "What are signs of nitrogen deficiency in rice?",
  "Best practices for organic vegetable farming",
];

export default function Assistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    farmApi.list().then(setFarms).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const buildFarmContext = (): Record<string, string> | undefined => {
    if (selectedFarmId == null) return undefined;
    const farm = farms.find(f => f.id === selectedFarmId);
    if (!farm) return undefined;
    const plot = farm.plots[0];
    return {
      farm_name: farm.name,
      state: farm.state ?? "",
      crop: plot?.crop ?? "",
      growth_stage: plot?.growth_stage ?? "",
    };
  };

  const send = async (text = input.trim()) => {
    if (!text || loading) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setLoading(true);
    try {
      const res = await assistantApi.chat(nextHistory, buildFarmContext());
      setConfigured(res.configured);
      setMessages(prev => [...prev, { role: "assistant", content: res.reply }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Sorry, I could not connect to the assistant right now. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <PageHeader
        title="AI Farming Assistant"
        subtitle="Ask questions about crops, diseases, schemes, irrigation, and more."
      />

      {!configured && (
        <Alert variant="warning">
          The AI assistant is not configured. Set <code>AI_PROVIDER=openai</code> and{" "}
          <code>OPENAI_API_KEY</code> in the backend <code>.env</code> file to enable it.
        </Alert>
      )}

      {/* Farm context selector */}
      {farms.length > 0 && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-brand-600">Context:</span>
          <select
            className="input max-w-xs py-1"
            value={selectedFarmId ?? ""}
            onChange={e => setSelectedFarmId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">No farm context</option>
            {farms.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <span className="text-brand-400 text-xs">
            (Selecting a farm gives the assistant context about your crops)
          </span>
        </div>
      )}

      {/* Chat messages */}
      <div className="card flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="text-5xl">🌱</div>
            <p className="text-brand-700 font-medium">Ask me anything about farming</p>
            <div className="grid gap-2 sm:grid-cols-2 w-full max-w-lg">
              {SUGGESTED.map(s => (
                <button
                  key={s}
                  className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-left text-sm text-brand-700 hover:bg-brand-100"
                  onClick={() => send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-brand-600 text-white rounded-br-sm"
                  : "bg-white border border-brand-100 text-brand-900 rounded-bl-sm"
              }`}
            >
              {msg.role === "assistant" && (
                <span className="mr-1 text-brand-500 text-xs">🌿 AgroDoc</span>
              )}
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-brand-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span key={i} className="h-2 w-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <textarea
          className="input flex-1 resize-none"
          rows={2}
          placeholder="Type your farming question… (Enter to send, Shift+Enter for new line)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
        />
        <button
          className="btn-primary px-5 self-end"
          onClick={() => send()}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </div>

      <p className="mt-2 text-center text-xs text-brand-400">
        AI advice is informational. For critical decisions, consult your local KVK or agriculture officer.
      </p>
    </div>
  );
}
