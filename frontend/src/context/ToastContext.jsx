import { createContext, useContext, useState, useCallback } from "react";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, variant = "accent") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((ts) => [...ts, { id, msg, variant }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 3000);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.variant}`}>
            <span className="dot" />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
