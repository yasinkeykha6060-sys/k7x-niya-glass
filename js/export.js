import { paintScene } from "./glass.js";
import { renderStroke } from "./tools.js";
import { glassFill, parseHex } from "./fill.js";
import { drawTemplate } from "./templates.js";
import { symmetryPoints } from "./tools.js";

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function saveBlob(blob, filename) {
  download(blob, filename);
}

export async function shareBlob(blob, filename, title) {
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title });
    return true;
  }
  return false;
}

export function renderPNG(outline, paint, scene, kind) {
  const w = outline.width;
  const h = outline.height;
  const canvas = document.createElement("canvas");
  if (kind === "clear") {
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(paint, 0, 0);
    ctx.drawImage(outline, 0, 0);
  } else {
    const pad = Math.round(Math.min(w, h) * 0.06);
    canvas.width = w + pad * 2;
    canvas.height = h + pad * 2;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = kind === "table" ? "#f6f3ee" : "#f3d5e4";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(pad, pad);
    paintScene(ctx, w, h, {
      ...scene,
      outline,
      paint,
      showRef: false,
      guides: 0,
      mode: kind === "table" ? "table" : "back"
    });
  }
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("blob"))), "image/png"));
}

export function videoSupported() {
  return !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);
}

export function pickMime() {
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return "";
  const types = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return types.find((type) => {
    try { return MediaRecorder.isTypeSupported(type); } catch (error) { return false; }
  }) || "";
}

function applyCommand(outline, paint, command) {
  const w = outline.width;
  const h = outline.height;
  if (command.type === "clear") {
    outline.getContext("2d").clearRect(0, 0, w, h);
    paint.getContext("2d").clearRect(0, 0, w, h);
    return;
  }
  if (command.type === "template") {
    drawTemplate(outline.getContext("2d"), command.name, w, h, command.color, command.opts);
    return;
  }
  if (command.type === "fill") {
    const style = {
      c1: parseHex(command.color),
      c2: parseHex(command.color2 || command.color),
      alpha: command.alpha,
      gap: command.gap,
      mode: command.fillMode
    };
    symmetryPoints(command.x * w, command.y * h, command.symmetry || 1, command.mirror, w, h).forEach((point) => {
      glassFill(outline, paint, point.x, point.y, style);
    });
    return;
  }
  if (command.type === "stroke") renderStroke(outline, paint, command);
}

export async function recordTimelapse(commands, size, scene, onProgress) {
  const mime = pickMime();
  if (!mime || !videoSupported()) throw new Error("no-recorder");
  const outline = document.createElement("canvas");
  const paint = document.createElement("canvas");
  outline.width = size.w;
  outline.height = size.h;
  paint.width = size.w;
  paint.height = size.h;
  const view = document.createElement("canvas");
  const pad = Math.round(Math.min(size.w, size.h) * 0.06);
  view.width = Math.max(480, Math.min(720, size.w + pad * 2));
  view.height = Math.round(view.width * ((size.h + pad * 2) / (size.w + pad * 2)));
  const ctx = view.getContext("2d");
  const draw = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, view.width, view.height);
    const scale = view.width / (size.w + pad * 2);
    ctx.scale(scale, scale);
    ctx.translate(pad, pad);
    paintScene(ctx, size.w, size.h, { ...scene, outline, paint, showRef: false, guides: 0 });
  };
  const stream = view.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks = [];
  recorder.ondataavailable = (event) => { if (event.data && event.data.size) chunks.push(event.data); };
  const stopped = new Promise((resolve) => { recorder.onstop = () => resolve(new Blob(chunks, { type: mime })); });
  recorder.start();
  const total = Math.max(1, commands.length);
  for (let i = 0; i < commands.length; i += 1) {
    applyCommand(outline, paint, commands[i]);
    draw();
    if (onProgress) onProgress((i + 1) / total);
    await new Promise((resolve) => setTimeout(resolve, 70));
  }
  draw();
  await new Promise((resolve) => setTimeout(resolve, 400));
  recorder.stop();
  stream.getTracks().forEach((track) => track.stop());
  return stopped;
}
