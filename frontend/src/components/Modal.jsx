import OverlayPortal from "./OverlayPortal";

export default function Modal({
  open,
  onClose,
  title,
  icon = null,
  header = null,
  footer = null,
  size = "md",
  className = "",
  bodyClassName = "",
  contentClassName = "",
  closeOnBackdrop = true,
  closeOnEscape = true,
  lockScroll = true,
  children,
  ...props
}) {
  if (!open) return null;

  const handleBackdropClick = () => {
    if (closeOnBackdrop) onClose?.();
  };

  return (
    <OverlayPortal onClose={onClose} closeOnEscape={closeOnEscape} lockScroll={lockScroll}>
      <div className="overlay-root" data-ui-overlay="modal">
        <div className="scrim" onClick={handleBackdropClick} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === "string" ? title : undefined}
          className={`overlay-panel modal modal-shell modal-shell--${size} ${className}`.trim()}
          onClick={(event) => event.stopPropagation()}
          {...props}
        >
          {(header || title) && (
            <div className={`modal-head ${contentClassName}`.trim()}>
              {header || (
                <>
                  {icon}
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{title}</div>
                </>
              )}
            </div>
          )}
          <div className={`modal-body ${contentClassName} ${bodyClassName}`.trim()}>
            {children}
          </div>
          {footer ? <div className={`modal-foot ${contentClassName}`.trim()}>{footer}</div> : null}
        </div>
      </div>
    </OverlayPortal>
  );
}
