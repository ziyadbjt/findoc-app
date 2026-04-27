import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Lock, MessageSquare, Send, Sparkles, Users, X } from "lucide-react";

import {
  getPrivateChatContacts,
  getPrivateMessages,
  getTeamMessages,
  postPrivateMessage,
  postTeamMessage,
  sendChatMessage,
} from "../api";
import { useAuth } from "../context/AuthContext";

export default function ChatBot({ dossierId, open, onClose, onOpen }) {
  const { token, user } = useAuth();
  const [mode, setMode] = useState("ai");
  const [teamView, setTeamView] = useState("project");
  const [selectedContactId, setSelectedContactId] = useState();
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Bonjour, je suis FinAI. Comment puis-je vous aider ?",
    },
  ]);
  const [projectMessages, setProjectMessages] = useState([]);
  const [privateContacts, setPrivateContacts] = useState([]);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef(null);
  const storageScope = useMemo(
    () => `findoc:chat:${user?.email || "anon"}:${dossierId || "none"}`,
    [dossierId, user?.email]
  );
  const seenProjectKey = `${storageScope}:seen:project`;
  const seenPrivatePrefix = `${storageScope}:seen:private:`;

  const getStoredSeenAt = (key) => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(key) || "";
  };

  const setStoredSeenAt = (key, value) => {
    if (typeof window === "undefined" || !value) return;
    localStorage.setItem(key, value);
  };

  const selectedContact = useMemo(
    () => privateContacts.find((contact) => Number(contact.id) === Number(selectedContactId)) || null,
    [privateContacts, selectedContactId]
  );

  const currentMessages = useMemo(() => {
    if (mode === "ai") return messages;
    if (teamView === "project") return projectMessages;
    return privateMessages;
  }, [messages, mode, privateMessages, projectMessages, teamView]);

  const teamEmptyState = useMemo(
    () => ({
      user_name: "Equipe",
      content: "Aucun message interne pour ce dossier. Lance la discussion avec ton equipe ici.",
    }),
    []
  );

  const privateEmptyState = useMemo(
    () => ({
      sender_name: selectedContact?.nom || "Prive",
      content: selectedContact
        ? `Aucun message prive avec ${selectedContact.nom || selectedContact.email}.`
        : "Choisis une personne du projet pour ouvrir une conversation privee.",
    }),
    [selectedContact]
  );

  const projectUnreadCount = useMemo(() => {
    const seenAt = getStoredSeenAt(seenProjectKey);
    return projectMessages.filter(
      (message) =>
        message.user_email &&
        user?.email &&
        message.user_email !== user.email &&
        message.created_at &&
        (!seenAt || String(message.created_at) > seenAt)
    ).length;
  }, [projectMessages, seenProjectKey, user?.email]);

  const contactsWithUnread = useMemo(
    () =>
      privateContacts.map((contact) => {
        const seenAt = getStoredSeenAt(`${seenPrivatePrefix}${contact.id}`);
        const hasUnread = Boolean(contact.last_message_at && (!seenAt || String(contact.last_message_at) > seenAt));
        return { ...contact, unread: hasUnread ? 1 : 0 };
      }),
    [privateContacts, seenPrivatePrefix]
  );

  const privateUnreadCount = useMemo(
    () => contactsWithUnread.reduce((total, contact) => total + (contact.unread ? 1 : 0), 0),
    [contactsWithUnread]
  );

  const totalUnreadCount = projectUnreadCount + privateUnreadCount;

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [currentMessages, mode, open, selectedContactId, teamView]);

  useEffect(() => {
    if (!open || mode !== "team" || teamView !== "project" || !projectMessages.length) return;
    const latestIncoming = [...projectMessages]
      .reverse()
      .find((message) => message.user_email && user?.email && message.user_email !== user.email);
    if (latestIncoming?.created_at) {
      setStoredSeenAt(seenProjectKey, latestIncoming.created_at);
    }
  }, [mode, open, projectMessages, seenProjectKey, teamView, user?.email]);

  useEffect(() => {
    if (!open || mode !== "team" || teamView !== "private" || !selectedContactId || !privateMessages.length) return;
    const latestIncoming = [...privateMessages]
      .reverse()
      .find((message) => message.sender_email && user?.email && message.sender_email !== user.email);
    if (latestIncoming?.created_at) {
      setStoredSeenAt(`${seenPrivatePrefix}${selectedContactId}`, latestIncoming.created_at);
    }
  }, [mode, open, privateMessages, seenPrivatePrefix, selectedContactId, teamView, user?.email]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frameId = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frameId);
    }

    setVisible(false);
    const timeoutId = window.setTimeout(() => setMounted(false), 220);
    return () => window.clearTimeout(timeoutId);
  }, [open]);

  useEffect(() => {
    if (!open || !token || !dossierId) return;

    let active = true;
    let intervalId;

    const load = async () => {
      try {
        const [projectResponse, contactsResponse] = await Promise.all([
          getTeamMessages(token, dossierId),
          getPrivateChatContacts(token, dossierId),
        ]);

        if (!active) return;

        const nextContacts = contactsResponse.data || [];
        setProjectMessages(projectResponse.data || []);
        setPrivateContacts(nextContacts);

        if (selectedContactId === undefined && nextContacts.length > 0) {
          setSelectedContactId(nextContacts[0].id);
        }
      } catch {}
    };

    load();
    intervalId = window.setInterval(load, 5000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [open, token, dossierId, selectedContactId]);

  useEffect(() => {
    if (!open || !token || !dossierId || mode !== "team" || teamView !== "private" || !selectedContactId) return;

    let active = true;
    let intervalId;

    const loadPrivateConversation = async () => {
      try {
        const response = await getPrivateMessages(token, dossierId, selectedContactId);
        if (active) setPrivateMessages(response.data || []);
      } catch {}
    };

    loadPrivateConversation();
    intervalId = window.setInterval(loadPrivateConversation, 5000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [open, token, dossierId, mode, teamView, selectedContactId]);

  const ask = async () => {
    const content = input.trim();
    if (!content || loading) return;

    if (mode === "team") {
      setLoading(true);
      try {
        if (teamView === "private") {
          if (!selectedContactId) return;
          const response = await postPrivateMessage(token, dossierId, selectedContactId, content);
          setPrivateMessages((prev) => [...prev, response.data]);
          setPrivateContacts((prev) =>
            prev.map((contact) =>
              Number(contact.id) === Number(selectedContactId)
                ? { ...contact, last_message: response.data.content, last_message_at: response.data.created_at }
                : contact
            )
          );
        } else {
          const response = await postTeamMessage(token, dossierId, content);
          setProjectMessages((prev) => [...prev, response.data]);
        }
        setInput("");
      } catch {
        const errorMessage =
          teamView === "private"
            ? {
                id: `error-${Date.now()}`,
                sender_name: "Systeme",
                sender_email: "",
                content: "Impossible d'envoyer le message prive pour le moment.",
                created_at: new Date().toISOString(),
              }
            : {
                id: `error-${Date.now()}`,
                user_name: "Systeme",
                user_email: "",
                content: "Impossible d'envoyer le message pour le moment.",
                created_at: new Date().toISOString(),
              };

        if (teamView === "private") setPrivateMessages((prev) => [...prev, errorMessage]);
        else setProjectMessages((prev) => [...prev, errorMessage]);
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

  const isProjectMode = mode === "team" && teamView === "project";
  const isPrivateMode = mode === "team" && teamView === "private";
  const displayedMessages =
    mode === "team"
      ? isProjectMode
        ? projectMessages.length
          ? projectMessages
          : [teamEmptyState]
        : selectedContact
          ? privateMessages.length
            ? privateMessages
            : [privateEmptyState]
          : [privateEmptyState]
      : messages;

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className={`chatbot-launcher ${open || mounted ? "is-hidden" : "is-visible"}`}
        aria-hidden={open || mounted}
        tabIndex={open || mounted ? -1 : 0}
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: 45,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 18px",
          borderRadius: 999,
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
        {totalUnreadCount > 0 && <span className="chatbot-unread-pill">{totalUnreadCount}</span>}
      </button>

      {mounted && (
        <div
          className={`chatbot-shell ${visible ? "is-open" : "is-closing"}`}
          style={{ position: "fixed", right: 24, bottom: 24, width: 420, maxWidth: "calc(100vw - 24px)", zIndex: 46 }}
        >
          <div className="card chatbot-card" style={{ padding: 0, overflow: "hidden", boxShadow: "0 24px 80px rgba(20, 20, 20, 0.18)" }}>
        <div className="chatbot-head" style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--line-1)" }}>
          <div className="chatbot-head-icon" style={{ width: 34, height: 34, borderRadius: 12, display: "grid", placeItems: "center" }}>
            <MessageSquare size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="chatbot-title" style={{ fontSize: 13, fontWeight: 700 }}>FinAI — Assistant FinDoc</div>
            <div className="chatbot-subtitle" style={{ fontSize: 11.5 }}>
              {mode === "team"
                ? isPrivateMode
                  ? `Conversation privee avec ${selectedContact?.nom || selectedContact?.email || "..." }`
                  : "Canal projet du dossier"
                : "Factures, TVA, ecritures, dossier"}
            </div>
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
              {totalUnreadCount > 0 && <span className="chatbot-tab-badge">{totalUnreadCount}</span>}
            </button>
          </div>

          {mode === "team" && (
            <div className="chatbot-scope-switch">
              <button
                type="button"
                className={`chatbot-scope-btn ${teamView === "project" ? "active" : ""}`}
                onClick={() => setTeamView("project")}
              >
                <Users size={13} />
                Projet
                {projectUnreadCount > 0 && <span className="chatbot-scope-badge">{projectUnreadCount}</span>}
              </button>
              <button
                type="button"
                className={`chatbot-scope-btn ${teamView === "private" ? "active" : ""}`}
                onClick={() => setTeamView("private")}
              >
                <Lock size={13} />
                Prive
                {privateUnreadCount > 0 && <span className="chatbot-scope-badge">{privateUnreadCount}</span>}
              </button>
            </div>
          )}
        </div>

        {isPrivateMode && (
          <div className="chatbot-private-topbar">
            {!selectedContact ? (
              <div className="chatbot-private-topbar-title">Choisis une personne du projet</div>
            ) : (
              <>
                <button type="button" className="chatbot-back-btn" onClick={() => setSelectedContactId(null)}>
                  <ArrowLeft size={13} />
                  Conversations
                </button>
                <div className="chatbot-private-topbar-title">{selectedContact.nom || selectedContact.email}</div>
              </>
            )}
          </div>
        )}

        {isPrivateMode && !selectedContact ? (
          <div className="chatbot-private-list">
            {privateContacts.length === 0 ? (
              <div className="chatbot-empty-panel">Aucun autre membre trouve pour ce dossier.</div>
            ) : (
              contactsWithUnread.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  className="chatbot-contact-item"
                  onClick={() => setSelectedContactId(contact.id)}
                >
                  <div className="chatbot-contact-avatar">{(contact.nom || contact.email || "?").slice(0, 2).toUpperCase()}</div>
                  <div className="chatbot-contact-copy">
                    <div className="chatbot-contact-name">
                      <span>{contact.nom || contact.email}</span>
                      {contact.unread ? <span className="chatbot-contact-badge">Nouveau</span> : null}
                    </div>
                    <div className="chatbot-contact-preview">{contact.last_message || "Ouvrir une conversation privee"}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div ref={bodyRef} className="chatbot-body" style={{ maxHeight: 420, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {displayedMessages.map((message, index) => {
              const isUserMessage = mode === "ai"
                ? message.role === "user"
                : isProjectMode
                  ? message.user_email && user?.email && message.user_email === user.email
                  : message.sender_email && user?.email && message.sender_email === user.email;

              return (
                <div
                  key={`${mode}-${teamView}-${message.id || message.role || "message"}-${index}`}
                  className={`chatbot-message ${isUserMessage ? "user" : "assistant"}`}
                  style={{
                    alignSelf: isUserMessage ? "flex-end" : "flex-start",
                    maxWidth: "92%",
                    padding: "10px 12px",
                    borderRadius: 14,
                    whiteSpace: "pre-wrap",
                    fontSize: 12.5,
                    lineHeight: 1.55,
                  }}
                >
                  {mode === "ai" ? (
                    <>
                      {message.role === "assistant" && index === 0 && <Sparkles size={13} style={{ verticalAlign: "text-bottom", marginRight: 6 }} />}
                      {message.content || (loading ? "Analyse en cours..." : "")}
                    </>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ fontSize: 10.5, opacity: 0.78, fontWeight: 700, letterSpacing: "0.03em" }}>
                        {isProjectMode ? message.user_name || "Equipe" : message.sender_name || selectedContact?.nom || "Prive"}
                      </div>
                      <div>{message.content || ""}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {mode === "ai" && messages.length <= 1 && (
          <div style={{ padding: "8px 14px", borderTop: "1px solid var(--line-1)", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["/tva", "/relance", "/anomalies", "/aide"].map(cmd => (
              <button
                key={cmd}
                className="chip"
                style={{ fontSize: 11.5 }}
                onClick={() => { setInput(cmd); }}
              >
                {cmd}
              </button>
            ))}
          </div>
        )}

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
              disabled={isPrivateMode && !selectedContact}
              placeholder={
                mode === "ai"
                  ? "Posez une question ou tapez /aide pour les commandes"
                  : isProjectMode
                    ? "Ecrire dans le canal projet..."
                    : selectedContact
                      ? `Envoyer un message prive a ${selectedContact.nom || selectedContact.email}...`
                      : "Choisis d'abord une personne"
              }
              style={{ flex: 1, resize: "none", borderRadius: 12, padding: "10px 12px" }}
            />
            <button className="btn btn-primary" onClick={ask} disabled={loading || !input.trim() || (isPrivateMode && !selectedContact)} style={{ alignSelf: "stretch" }}>
              <Send size={14} />
            </button>
          </div>
        </div>
          </div>
        </div>
      )}
    </>
  );
}
