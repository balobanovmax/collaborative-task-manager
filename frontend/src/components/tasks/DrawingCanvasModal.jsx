import { useEffect, useRef, useState } from 'react';
import styles from './DrawingCanvasModal.module.css';

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 520;

const COLORS = ['#111827', '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c'];

function DrawingCanvasModal({ isOpen, onClose, onSave, isSaving }) {
  const canvasRef = useRef(null);
  const [color, setColor] = useState('#111827');
  const [brushSize, setBrushSize] = useState(4);
  const [isEraser, setIsEraser] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [hasStrokes, setHasStrokes] = useState(false);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setTitle('');
    setError('');
    setHasStrokes(false);
    setIsEraser(false);
    setColor('#111827');
    setBrushSize(4);

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [isOpen]);

  const getCoords = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (event) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoords(event);

    isDrawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (event) => {
    if (!isDrawingRef.current) {
      return;
    }

    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoords(event);

    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : color;
    ctx.lineWidth = isEraser ? brushSize * 2 : brushSize;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasStrokes(true);
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    setHasStrokes(false);
    setError('');
  };

  const handleSave = () => {
    if (!hasStrokes) {
      setError('Draw something before saving.');
      return;
    }

    const canvas = canvasRef.current;
    canvas.toBlob((blob) => {
      if (!blob) {
        setError('Failed to export drawing.');
        return;
      }

      const file = new File([blob], `drawing-${Date.now()}.png`, { type: 'image/png' });
      onSave(file, title.trim() || 'Drawing');
    }, 'image/png');
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Create Drawing</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} disabled={isSaving}>
            ×
          </button>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.toolGroup}>
            {COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={`${styles.colorSwatch} ${!isEraser && color === swatch ? styles.colorSwatchActive : ''}`}
                style={{ backgroundColor: swatch }}
                onClick={() => {
                  setColor(swatch);
                  setIsEraser(false);
                }}
                aria-label={`Use color ${swatch}`}
              />
            ))}
          </div>

          <div className={styles.toolGroup}>
            <label className={styles.toolLabel}>
              Size
              <input
                type="range"
                min="1"
                max="24"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className={styles.rangeInput}
              />
            </label>
            <button
              type="button"
              className={`${styles.toolButton} ${isEraser ? styles.toolButtonActive : ''}`}
              onClick={() => setIsEraser(true)}
            >
              Eraser
            </button>
            <button type="button" className={styles.toolButton} onClick={handleClear}>
              Clear
            </button>
          </div>
        </div>

        <div className={styles.canvasWrapper}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>

        <div className={styles.footer}>
          <input
            type="text"
            className={styles.titleInput}
            placeholder="Drawing title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
            disabled={isSaving}
          />

          {error && <div className={styles.errorMessage}>{error}</div>}

          <div className={styles.footerActions}>
            <button type="button" className={styles.cancelButton} onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="button" className={styles.saveButton} onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Drawing'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DrawingCanvasModal;
