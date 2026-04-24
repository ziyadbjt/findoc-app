import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Send, Sparkles, X } from "lucide-react";

import { getTeamMessages, postTeamMessage, sendChatMessage } from "../api";
import { useAuth } from "../context/AuthContext";


export default function ChatBot({ dossierId, open, onClose, onOpen }) {
  const { token, user } = useAuth();
  const [mode, setMode] = useState("ai");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Bonjour, je suis FinAI. Comment puis-je vous aider ?",
    },
  ]);
  const [teamMessages, setTeamMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef(null);

  const currentMessages = mode === "ai" ? messages : teamMessages;
  const teamEmptyState = useMemo(() => ({
    user_name: "Equipe",
    content: "Aucun message interne pour ce dossier. Lance la discussion avec ton equipe ici.",
  }), []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [currentMessages, open, mode]);

  useEffect(() => {
    if (!open || !token || !dossierId) return;

    let active = true;
    let intervalId;

    const load = async () => {
      try {
        const response = await getTeamMessages(token, dossierId);
        if (active) setTeamMessages(response.data || []);
      } catch {}
    };

    load();
    intervalId = window.setInterval(load, 5000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [open, token, dossierId]);

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
          background: "linear-gradient(135deg, rgba(0,50,40,0.95), rgba(0,70,55,0.9))",
          color: "var(--mint)",
          border: "1px solid rgba(143,212,188,0.28)",
          boxShadow: "0 18px 44px rgba(0,0,0,0.5), 0 0 0 1px rgba(143,212,188,0.14)",
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
            background: "rgba(143, 212, 188, 0.12)",
            border: "1px solid rgba(143, 212, 188, 0.24)",
          }}
        >
          <MessageSquare size={16} />
        </span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.15 }}>
          <span>FinAI — Assistant FinDoc</span>
          <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.9 }}>Posez vos questions comptables</span>
        </span>
      </button>
    );
  }

  const ask = async () => {
    const content = input.trim();
    if (!content || loading) return;

    if (mode === "team") {
      setLoading(true);
      try {
        const response = await postTeamMessage(token, dossierId, content);
        setTeamMessages((prev) => [...prev, response.data]);
        setInput("");
      } catch {
        setTeamMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            dossier_id: Number(dossierId),
            user_id: -1,
            user_name: "Système",
            user_email: "",
            content: "Impossible d'envoyer le message pour le moment.",
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setLoading(false);
      }
      return;
    }

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
      <div className="card chatbot-card" style={{ padding: 0, overflow: "hidden", boxShadow: "0 24px 80px rgba(20, 20, 20, 0.18)" }}>
        <div className="chatbot-head" style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--line-1)" }}>
          <div className="chatbot-head-icon" style={{ width: 34, height: 34, borderRadius: 12, display: "grid", placeItems: "center" }}>
            <MessageSquare size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="chatbot-title" style={{ fontSize: 13, fontWeight: 700 }}>FinAI — Assistant FinDoc</div>
            <div className="chatbot-subtitle" style={{ fontSize: 11.5 }}>Factures, TVA, ecritures, dossier</div>
          </div>
          <button className="icon-btn chatbot-close" onClick={onClose}><X size={14} /></button>
        </div>

        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--line-1)", background: "var(--bg-inset)" }}>
          <div className="segmented" style={{ width: "100%" }}>
            <button className={mode === "ai" ? "active" : ""} onClick={() => setMode("ai")} style={{ flex: 1 }}>
              Assistant IA
            </button>
            <button className={mode === "team" ? "active" : ""} onClick={() => setMode("team")} style={{ flex: 1 }}>
              Chat equipe
            </button>
          </div>
        </div>

        <div ref={bodyRef} className="chatbot-body" style={{ maxHeight: 420, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {(mode === "team" && teamMessages.length === 0 ? [teamEmptyState] : currentMessages).map((message, index) => (
            <div
              key={`${mode}-${message.id || message.role || "message"}-${index}`}
              className={`chatbot-message ${mode === "team" ? ((message.user_email && user?.email && message.user_email === user.email) ? "user" : "assistant") : (message.role === "user" ? "user" : "assistant")}`}
              style={{
                alignSelf: mode === "team"
                  ? ((message.user_email && user?.email && message.user_email === user.email) ? "flex-end" : "flex-start")
                  : (message.role === "user" ? "flex-end" : "flex-start"),
                maxWidth: "92%",
                padding: "10px 12px",
                borderRadius: 14,
                whiteSpace: "pre-wrap",
                fontSize: 12.5,
                lineHeight: 1.55,
              }}
            >
              {mode === "team" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 10.5, opacity: 0.78, fontWeight: 700, letterSpacing: "0.03em" }}>
                    {message.user_name || "Equipe"}
                  </div>
                  <div>{message.content || ""}</div>
                </div>
              ) : (
                <>
                  {message.role === "assistant" && index === 0 && <Sparkles size={13} style={{ verticalAlign: "text-bottom", marginRight: 6 }} />}
                  {message.content || (loading ? "Analyse en cours..." : "")}
                </>
              )}
            </div>
          ))}
        </div>

        <div className="chatbot-compose" style={{ padding: 14, borderTop: "1px solid var(--line-1)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <textarea
              className="chatbot-input"
              rows={2}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  ask();
                }
              }}
              placeholder={mode === "team" ? "Ecrire a l'equipe a propos de ce dossier..." : "Ex: Quelles factures sont en retard ?"}
              style={{ flex: 1, resize: "none", borderRadius: 12, padding: "10px 12px" }}
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
