import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';
import './Whiteboard.css';

const socket = io('http://localhost:4000');

const Whiteboard = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [current, setCurrent] = useState({ x: 0, y: 0 });
  const [color, setColor] = useState('#000000');
  const [tool, setTool] = useState('pen');
  const [brushSize, setBrushSize] = useState(2);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    socket.on('drawing', onDrawingEvent);

    return () => {
      socket.off('drawing', onDrawingEvent);
    };
  }, []);

  const onDrawingEvent = (data) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    drawLine(context, data.x0, data.y0, data.x1, data.y1, data.color, data.brushSize, false);
  };

  const drawLine = (context, x0, y0, x1, y1, color, brushSize, emit) => {
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = color;
    context.lineWidth = brushSize;
    context.stroke();
    context.closePath();

    if (!emit) return;

    socket.emit('drawing', { x0, y0, x1, y1, color, brushSize });
  };

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    setCurrent({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDrawing(true);
    setRedoStack([]);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    setHistory([...history, canvas.toDataURL()]); // Save canvas state for undo
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const newX = e.clientX - rect.left;
    const newY = e.clientY - rect.top;

    drawLine(context, current.x, current.y, newX, newY, tool === 'eraser' ? 'white' : color, brushSize, true);
    setCurrent({ x: newX, y: newY });
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const lastImage = history[history.length - 1];

    const img = new Image();
    img.src = lastImage;
    img.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0);
    };

    setRedoStack([...redoStack, history.pop()]);
    setHistory([...history]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const nextImage = redoStack[redoStack.length - 1];

    const img = new Image();
    img.src = nextImage;
    img.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0);
    };

    setHistory([...history, redoStack.pop()]);
    setRedoStack([...redoStack]);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('clearCanvas'); // Broadcast clear canvas event
  };

  const saveCanvas = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'whiteboard.png';
    link.click();
  };

  useEffect(() => {
    socket.on('clearCanvas', () => {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
    });
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <button onClick={() => setTool('pen')}>Pen</button>
        <button onClick={() => setTool('eraser')}>Eraser</button>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          disabled={tool === 'eraser'}
          style={{ marginLeft: '10px' }}
        />
        <input
          type="range"
          min="1"
          max="20"
          value={brushSize}
          onChange={(e) => setBrushSize(e.target.value)}
          style={{ marginLeft: '10px' }}
        />
        <button onClick={handleUndo} style={{ marginLeft: '10px' }}>Undo</button>
        <button onClick={handleRedo} style={{ marginLeft: '10px' }}>Redo</button>
        <button onClick={clearCanvas} style={{ marginLeft: '10px' }}>Clear</button>
        <button onClick={saveCanvas} style={{ marginLeft: '10px' }}>Save as Image</button>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        style={{ border: '1px solid #000', marginTop: '20px', cursor: tool === 'eraser' ? 'crosshair' : 'pointer' }}
      />
    </div>
  );
};

export default Whiteboard;
