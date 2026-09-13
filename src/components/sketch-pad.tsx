"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Download, Eraser, RotateCcw, Trash2 } from "lucide-react";
import { sketchFilename } from "@/lib/sketch";

const tools = [
  { name: "Red", color: "#ff3b30" },
  { name: "Green", color: "#34c759" },
  { name: "Blue", color: "#168bff" },
  { name: "White", color: "#ffffff" },
] as const;

type HistoryEntry = { image: ImageData; meaningful: boolean };
export type SketchPadHandle = { hasDrawing(): boolean; saveToDevice(): void };

export const SketchPad = forwardRef<SketchPadHandle, {
  embedded?: boolean;
  inputName?: string;
  onMeaningfulChange?: (value: boolean) => void;
}>(function SketchPad({ embedded = false, inputName, onMeaningfulChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const history = useRef<HistoryEntry[]>([]);
  const drawing = useRef(false);
  const meaningfulRef = useRef(false);
  const [meaningful, setMeaningful] = useState(false);
  const [tool, setTool] = useState<string>("White");

  const context = () => canvasRef.current?.getContext("2d", { willReadFrequently: true }) ?? null;
  const setMeaningfulDrawing = (value: boolean) => {
    meaningfulRef.current = value;
    setMeaningful(value);
    onMeaningfulChange?.(value);
  };
  const fillBlack = () => {
    const canvas = canvasRef.current;
    const drawingContext = context();
    if (canvas && drawingContext) {
      drawingContext.fillStyle="#000";
      drawingContext.fillRect(0, 0, canvas.width, canvas.height);
    }
  };
  const syncFileInput = () => {
    const canvas = canvasRef.current;
    const input = fileRef.current;
    if (!canvas || !input) return;
    const transfer = new DataTransfer();
    if (meaningfulRef.current) {
      const encoded = canvas.toDataURL("image/png").split(",")[1];
      const binary = window.atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      transfer.items.add(new File([bytes], "napkin-sketch.png", { type: "image/png" }));
    }
    input.files = transfer.files;
  };
  const saveToDevice = () => {
    const canvas = canvasRef.current;
    if (!canvas || !meaningfulRef.current) return;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const drawingContext = exportCanvas.getContext("2d");
    if (!drawingContext) return;
    drawingContext.fillStyle="#000";
    drawingContext.fillRect(0, 0, canvas.width, canvas.height);
    drawingContext.drawImage(canvas, 0, 0);
    const anchor = document.createElement("a");
    anchor.download = sketchFilename();
    anchor.href = exportCanvas.toDataURL("image/png");
    anchor.click();
  };

  useImperativeHandle(ref, () => ({ hasDrawing: () => meaningfulRef.current, saveToDevice }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const old = document.createElement("canvas");
      old.width = canvas.width;
      old.height = canvas.height;
      if (old.width && old.height) old.getContext("2d")?.drawImage(canvas, 0, 0);
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      const drawingContext = canvas.getContext("2d", { willReadFrequently: true });
      if (drawingContext) {
        drawingContext.fillStyle="#000";
        drawingContext.fillRect(0, 0, width, height);
      }
      if (old.width && meaningfulRef.current) context()?.drawImage(old, 0, 0, width, height);
      syncFileInput();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const drawingContext = context();
    if (!drawingContext) return;
    history.current.push({ image: drawingContext.getImageData(0, 0, canvas.width, canvas.height), meaningful: meaningfulRef.current });
    if (history.current.length > 30) history.current.shift();
    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    const position = point(event);
    drawingContext.beginPath();
    drawingContext.moveTo(position.x, position.y);
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const drawingContext = context();
    if (!drawingContext) return;
    const position = point(event);
    const scale = canvas.width / 1000;
    drawingContext.lineCap = "round";
    drawingContext.lineJoin = "round";
    drawingContext.strokeStyle = tool === "Eraser" ? "#000" : tools.find((item) => item.name === tool)?.color ?? "#fff";
    drawingContext.lineWidth = (tool === "Eraser" ? 16 : 6) * scale;
    drawingContext.lineTo(position.x, position.y);
    drawingContext.stroke();
    if (tool !== "Eraser" && !meaningfulRef.current) setMeaningfulDrawing(true);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    syncFileInput();
  };
  const undo = () => {
    const drawingContext = context();
    const last = history.current.pop();
    if (!drawingContext || !last) return;
    drawingContext.putImageData(last.image, 0, 0);
    setMeaningfulDrawing(last.meaningful);
    window.setTimeout(syncFileInput, 0);
  };
  const clear = () => {
    const canvas = canvasRef.current;
    const drawingContext = context();
    if (!canvas || !drawingContext || !meaningfulRef.current) return;
    history.current.push({ image: drawingContext.getImageData(0, 0, canvas.width, canvas.height), meaningful: true });
    fillBlack();
    setMeaningfulDrawing(false);
    window.setTimeout(syncFileInput, 0);
  };

  return (
    <div className={`sketch-pad ${embedded ? "sketch-pad--embedded" : ""}`}>
      {embedded && <div className="sketch-pad__heading"><strong>Sketch it</strong><small>Optional — draw directly on this Napkin.</small></div>}
      <div className="sketch-tools" role="toolbar" aria-label="Drawing tools">
        {tools.map((item) => <button type="button" aria-pressed={tool === item.name} onClick={() => setTool(item.name)} key={item.name}><i style={{ background: item.color }} />{item.name}</button>)}
        <button type="button" aria-pressed={tool === "Eraser"} onClick={() => setTool("Eraser")}><Eraser size={16} />Eraser</button>
        <button type="button" onClick={undo} disabled={!history.current.length}><RotateCcw size={16} />Undo</button>
        <button type="button" onClick={clear} disabled={!meaningful}><Trash2 size={16} />Clear</button>
        {!embedded && <button type="button" onClick={saveToDevice} disabled={!meaningful}><Download size={16} />Save</button>}
      </div>
      <canvas ref={canvasRef} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-label="Black sketch canvas" />
      {inputName && <input ref={fileRef} type="file" name={inputName} accept="image/png" hidden readOnly />}
    </div>
  );
});
