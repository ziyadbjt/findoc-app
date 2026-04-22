import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Sparkles, X } from "lucide-react";

import { sendChatMessage } from "../api";
import { useAuth } from "../context/AuthContext";


export default function ChatBot({ dossierId, open, onClose, onOpen }) {
  const { token } = useAuth();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Je peux repondre sur les retards, la TVA, les ecritures PCM et le resume du dossier.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: 80,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 18px",
          borderRadius: 999,
          border: "1px solid var(--accent-line)",
          background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 64%, #f0d4bc))",
          color: "#fff9f1",
          boxShadow: "0 18px 44px rgba(35, 24, 15, 0.24)",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            background: "rgba(255, 249, 241, 0.16)",
            border: "1px solid rgba(255, 249, 241, 0.22)",
          }}
        >
          <MessageSquare size={16} />
        </span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.15 }}>
          <span>Activer le chat</span>
          <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.9 }}>PCM, TVA, retards, ecritures</span>
        </span>
      </button>
    );
  }

  const ask = async () => {
    const content = input.trim();
    if (!content || loading) return;

    const history = messages.map((message) => ({ role: message.role, content: message.content }));
    const assistantIndex = messages.length + 1;
    setMessages((prev) => [...prev, { role: "user", content }, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      await sendChatMessage(
        token,
        { dossier_id: Number(dossierId), message: content, historique: history },
        {
          onChunk: (chunk) => {
            setMessages((prev) =>
              prev.map((message, index) =>
                index === assistantIndex ? { ...message, content: `${message.content}${chunk}` } : message
              )
            );
          },
          onDone: () => setLoading(false),
        }
      );
    } catch {
      setMessages((prev) =>
        prev.map((message, index) =>
          index === assistantIndex ? { ...message, content: "Le chat est indisponible pour le moment." } : message
        )
      );
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", right: 24, bottom: 24, width: 380, maxWidth: "calc(100vw - 24px)", zIndex: 80 }}>
      <div className="card" style={{ padding: 0, overflow: "hidden", boxShadow: "0 24px 80px rgba(20, 20, 20, 0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--line-1)", background: "linear-gradient(135deg, rgba(164,104,60,0.14), rgba(47,111,106,0.10))" }}>
          <div style={{ width: 34, height: 34, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--accent-bg)", color: "var(--accent-ink)" }}>
            <MessageSquare size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Chatbot FinDoc</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>PCM, TVA, Loi 69-21, resume dossier</div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={14} /></button>
        </div>

        <div ref={bodyRef} style={{ maxHeight: 420, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10, background: "rgba(255,255,255,0.45)" }}>
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              style={{
                alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "92%",
                padding: "10px 12px",
                borderRadius: 14,
                background: message.role === "user" ? "var(--accent)" : "var(--bg-inset)",
                color: message.role === "user" ? "white" : "var(--ink-0)",
                whiteSpace: "pre-wrap",
                fontSize: 12.5,
                lineHeight: 1.55,
              }}
            >
              {message.role === "assistant" && index === 0 && <Sparkles size={13} style={{ verticalAlign: "text-bottom", marginRight: 6 }} />}
              {message.content || (loading ? "Analyse en cours..." : "")}
            </div>
          ))}
        </div>

        <div style={{ padding: 14, borderTop: "1px solid var(--line-1)", background: "var(--bg-1)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <textarea
              rows={2}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  ask();
                }
              }}
              placeholder="Ex: Quelles factures sont en retard ?"
              style={{ flex: 1, resize: "none", border: "1px solid var(--line-1)", borderRadius: 12, padding: "10px 12px", background: "var(--bg-0)", color: "var(--ink-0)" }}
            />
            <button className="btn btn-primary" onClick={ask} disabled={loading || !input.trim()} style={{ alignSelf: "stretch" }}>
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
