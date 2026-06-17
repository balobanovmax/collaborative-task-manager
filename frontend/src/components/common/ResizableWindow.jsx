import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ResizableWindow.module.css';

const MIN_WIDTH = 300;
const MIN_HEIGHT = 320;
const VIEWPORT_MARGIN = 12;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const clampWindowToViewport = (position, size) => {
  if (typeof window === 'undefined') {
    return { position, size };
  }

  const maxWidth = window.innerWidth - VIEWPORT_MARGIN * 2;
  const maxHeight = window.innerHeight - VIEWPORT_MARGIN * 2;
  const nextSize = {
    width: clamp(size.width, MIN_WIDTH, maxWidth),
    height: clamp(size.height, MIN_HEIGHT, maxHeight)
  };

  const maxX = window.innerWidth - nextSize.width - VIEWPORT_MARGIN;
  const maxY = window.innerHeight - nextSize.height - VIEWPORT_MARGIN;

  return {
    size: nextSize,
    position: {
      x: clamp(position.x, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, maxX)),
      y: clamp(position.y, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, maxY))
    }
  };
};

function ResizableWindow({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  defaultPosition = { x: 96, y: 80 },
  defaultSize = { width: 380, height: 560 },
  zIndex = 1000,
  onFocus,
  ariaLabel,
  headerActions = null
}) {
  const [{ position, size }, setWindowState] = useState(() => {
    const clamped = clampWindowToViewport(defaultPosition, defaultSize);
    return { position: clamped.position, size: clamped.size };
  });
  const dragRef = useRef(null);
  const resizeRef = useRef(null);

  const applyWindowState = useCallback((nextPosition, nextSize) => {
    const clamped = clampWindowToViewport(nextPosition, nextSize);
    setWindowState({ position: clamped.position, size: clamped.size });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleResize = () => {
      setWindowState((current) => {
        const clamped = clampWindowToViewport(current.position, current.size);
        return { position: clamped.position, size: clamped.size };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (dragRef.current) {
        const { startX, startY, originX, originY, originWidth, originHeight } = dragRef.current;
        applyWindowState(
          {
            x: originX + (event.clientX - startX),
            y: originY + (event.clientY - startY)
          },
          { width: originWidth, height: originHeight }
        );
        return;
      }

      if (resizeRef.current) {
        const { startX, startY, originX, originY, originWidth, originHeight } = resizeRef.current;
        applyWindowState(
          { x: originX, y: originY },
          {
            width: originWidth + (event.clientX - startX),
            height: originHeight + (event.clientY - startY)
          }
        );
      }
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [applyWindowState]);

  const handleFocus = useCallback(() => {
    onFocus?.();
  }, [onFocus]);

  const handleDragStart = (event) => {
    if (event.button !== 0 || event.target.closest('button')) {
      return;
    }

    event.preventDefault();
    handleFocus();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      originWidth: size.width,
      originHeight: size.height
    };
  };

  const handleResizeStart = (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleFocus();
    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      originWidth: size.width,
      originHeight: size.height
    };
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={styles.window}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex
      }}
      role="dialog"
      aria-label={ariaLabel || title}
      onMouseDown={handleFocus}
    >
      <div className={styles.header} onMouseDown={handleDragStart}>
        <div className={styles.headerText}>
          <h3 className={styles.title}>{title}</h3>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        <div className={styles.headerActions}>
          {headerActions}
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            ×
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {children}
      </div>

      <div
        className={styles.resizeHandle}
        onMouseDown={handleResizeStart}
        aria-hidden="true"
      />
    </div>
  );
}

export default ResizableWindow;
