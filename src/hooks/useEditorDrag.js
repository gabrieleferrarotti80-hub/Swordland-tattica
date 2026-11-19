import { useState, useEffect, useRef } from 'react';

export function useEditorDrag(isOpen) {
  const [editorPos, setEditorPos] = useState({ x: 100, y: 50 });
  const [isDraggingEditor, setIsDraggingEditor] = useState(false);
  const editorDragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
       setEditorPos({ x: Math.max(20, window.innerWidth - 520), y: 40 });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingEditor) return;
      setEditorPos({
        x: e.clientX - editorDragOffset.current.x,
        y: e.clientY - editorDragOffset.current.y
      });
    };
    const handleMouseUp = () => setIsDraggingEditor(false);

    if (isDraggingEditor) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingEditor]);

  const handleEditorMouseDown = (e) => {
    if (e.target.closest('button') || e.target.tagName.toLowerCase() === 'input') return;
    setIsDraggingEditor(true);
    editorDragOffset.current = {
      x: e.clientX - editorPos.x,
      y: e.clientY - editorPos.y
    };
  };

  return { editorPos, isDraggingEditor, handleEditorMouseDown };
}