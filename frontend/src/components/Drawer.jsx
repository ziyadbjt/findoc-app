import OverlayPortal from "./OverlayPortal";

export default function Drawer({
  open,
  onClose,
  title,
  icon = null,
  header = null,
  footer = null,
  width = 420,
  placement = "right",
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
      <div className="overlay-root" data-ui-overlay="drawer">
        <div className="scrim" onClick={handleBackdropClick} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === "string" ? title : undefined}
          className={`overlay-panel drawer drawer-shell drawer-shell--${placement} ${className}`.trim()}
          style={placement === "right" ? { width } : undefined}
          onClick={(event) => event.stopPropagation()}
          {...props}
        >
          {(header || title) && (
            <div className={`drawer-head ${contentClassName}`.trim()}>
              {header || (
                <>
                  {icon}
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
                </>
              )}
            </div>
          )}
          <div className={`drawer-body ${contentClassName} ${bodyClassName}`.trim()}>
            {children}
          </div>
          {footer ? <div className={`drawer-foot ${contentClassName}`.trim()}>{footer}</div> : null}
        </div>
      </div>
    </OverlayPortal>
  );
}
