import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function OverlayPortal({
  children,
  onClose,
  closeOnEscape = true,
  lockScroll = true,
}) {
  useEffect(() => {
    if (!closeOnEscape || !onClose) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEscape, onClose]);

  useEffect(() => {
    if (!lockScroll) return undefined;

    const body = document.body;
    const previousOverflow = body.style.overflow;
    const currentCount = Number(body.dataset.overlayLockCount || "0");

    body.dataset.overlayLockCount = String(currentCount + 1);
    body.style.overflow = "hidden";

    return () => {
      const nextCount = Math.max(0, Number(body.dataset.overlayLockCount || "1") - 1);

      if (nextCount === 0) {
        delete body.dataset.overlayLockCount;
        body.style.overflow = previousOverflow;
        return;
      }

      body.dataset.overlayLockCount = String(nextCount);
    };
  }, [lockScroll]);

  if (typeof document === "undefined") return null;

  return createPortal(children, document.body);
}
