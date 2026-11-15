import { CONFIG } from "./config.js";
import { createSurface } from "./canvas.js";
import { renderStroke, symmetryPoints } from "./tools.js";
import { glassFill, parseHex } from "./fill.js";
import { drawTemplate } from "./templates.js";
import { createAudio } from "./audio.js";
import { exportLibrary, getDrawing, importLibrary, listDrawings, newId, removeDrawing, saveDrawing } from "./storage.js";
import { pickMime, recordTimelapse, renderPNG, saveBlob, shareBlob, videoSupported } from "./export.js";
import { paintScene } from "./glass.js";
import { renderDock, renderPanel, renderTabs } from "./ui.js";

const S = CONFIG.strings;
const audio = createAudio();
const view = document.querySelector("#view");
const surface = createSurface(view);
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = {
  tool: "liner",
  color: "#e84a7f",
  color2: "#ffd27a",
  alpha: 0.8,
  size: 14,
  liner: "#241816",
  metal: "gold",
  symmetry: 1,
  mirror: true,
  straight: false,
  mode: "back",
  gap: 2,
  fillMode: "solid",
  quality: "full",
  frame: "gold",
  sizeId: "medium",
  eraseTarget: "both",
  hue: 336,
  sat: 72,
  lit: 64,
  swatches: CONFIG.colors.slice(),
  recent: [],
  petals: 10,
  rings: 3,
  ref: null,
  sound: true
};

let docId = null;
let docName = S.defaultName;
let createdAt = Date.now();
let history = [];
let undo = [];
let redo = [];
let redoHist = [];
let dirty = true;
let dirtyDoc = false;
let stroke = null;
let lx = 0.34;
let ly = 0.3;
let tilt = { x: 0, y: 0 };
let flash = null;
let fills = 0;
let tab = "tools";
let wide = window.matchMedia("(min-width: 1000px)").matches;
let space = false;
let musicReady = false;
let saving = false;
const pointers = new Map();
let pinch = null;
let panning = null;
let refDrag = null;
let holdTimer = 0;
let lastTime = 0;
let cheerTimer = 0;
let cheerAt = 4;
let toastTimer = 0;
let panelToken = 0;

const welcome = document.querySelector("#welcome");
const appEl = document.querySelector("#app");
const panel = document.querySelector("#panel");
const dock = document.querySelector("#dock");
const tabs = document.querySelector("#tabs");
const modal = document.querySelector("#modal");
const toast = document.querySelector("#toast");
const cheerBox = document.querySelector("#cheer");
const sizeRange = document.querySelector("#sizeRange");
const quickColor = document.querySelector("#quickColor");
const btnLight = document.querySelector("#btnLight");

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function hslToHex(h, s, l) {
  const sat = s / 100;
  const lit = l / 100;
  const a = sat * Math.min(lit, 1 - lit);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return lit - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  const hex = (n) => Math.round(255 * f(n)).toString(16).padStart(2, "0");
  return "#" + hex(0) + hex(8) + hex(4);
}

function toastMsg(text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function cheer() {
  cheerBox.textContent = CONFIG.cheers[cheerAt % CONFIG.cheers.length];
  cheerAt += 1;
  cheerBox.hidden = false;
  clearTimeout(cheerTimer);
  cheerTimer = setTimeout(() => { cheerBox.hidden = true; }, 3200);
}

function bloom() {
  const layer = document.querySelector("#bloom");
  layer.innerHTML = "";
  layer.hidden = false;
  for (let i = 0; i < 14; i += 1) {
    const bit = document.createElement("i");
    bit.textContent = i % 2 ? "💗" : "🌸";
    bit.style.left = (8 + Math.random() * 84) + "%";
    bit.style.animationDelay = (Math.random() * 0.4) + "s";
    layer.append(bit);
  }
  setTimeout(() => { layer.hidden = true; layer.innerHTML = ""; }, 2700);
}

function scene() {
  return {
    mode: state.mode,
    frame: state.frame,
    lx: clamp(lx, 0.06, 0.94),
    ly: clamp(ly, 0.06, 0.94),
    quality: state.quality,
    ref: state.ref,
    showRef: !!state.ref,
    guides: state.symmetry > 1 ? state.symmetry : 0,
    flash
  };
}

function paintQuick() {
  quickColor.style.background = state.color;
  sizeRange.value = String(state.size);
  btnLight.textContent = state.mode === "back" ? "☀️ " + S.light : "🪟 " + S.table;
  document.querySelector("#sizeLabel").textContent = S.size;
}

function dayPick() {
  const index = Math.floor(Date.now() / 86400000) % CONFIG.daily.length;
  return CONFIG.daily[index];
}

const app = {
  state,
  S,
  CONFIG,
  setTool(id) { state.tool = id; paintChrome(); refresh(); },
  setColor(color) {
    state.color = color;
    state.recent = [color, ...state.recent.filter((item) => item !== color)].slice(0, 8);
    paintQuick();
    if (tab === "colors") refresh();
  },
  setLiner(color) { state.liner = color; paintQuick(); },
  setMetal(id) { state.metal = id; refresh(); },
  setPalette(id) { state.swatches = CONFIG.palettes[id].slice(); refresh(); },
  setSwatches(colors) { state.swatches = colors.slice(); refresh(); },
  randomPalette() {
    const hue = Math.random() * 360;
    state.swatches = Array.from({ length: 8 }, (_, i) => hslToHex((hue + i * 16) % 360, 62, 58 + (i % 3) * 8));
    refresh();
  },
  setSize(value) { state.size = value; paintQuick(); },
  setAlpha(value) { state.alpha = value; },
  setGap(value) { state.gap = value; },
  toggleStraight() { state.straight = !state.straight; refresh(); },
  setSym(value) { state.symmetry = value; dirty = true; refresh(); },
  toggleMirror() { state.mirror = !state.mirror; dirty = true; refresh(); },
  setFillMode(mode) { state.fillMode = mode; refresh(); },
  setEraseTarget(id) { state.eraseTarget = id; refresh(); },
  setHsl(key, value) {
    state[key] = value;
    state.color = hslToHex(state.hue, state.sat, state.lit);
    paintQuick();
  },
  setFrame(id) { state.frame = id; dirty = true; refresh(); },
  setPetals(value) { state.petals = value; },
  setRings(value) { state.rings = value; },
  setGlass(id) { applySize(id, true); },
  setQuality(id) { state.quality = id; applySize(state.sizeId, true); },
  async setTraceAlpha(value) { if (state.ref) { state.ref.alpha = value; dirty = true; } },
  pickTrace() { document.querySelector("#fileTrace").click(); },
  clearTrace() { state.ref = null; dirty = true; refresh(); },
  useTemplate(id) { applyTemplate(id); },
  useDaily() { const pick = dayPick(); state.swatches = CONFIG.palettes[pick.palette].slice(); applyTemplate(pick.template); },
  dailyText() { return dayPick().text; },
  openTab(id) { tab = id; panel.classList.remove("closed"); refresh(); },
  gallery() { return loadGallery(); },
  openDrawing(id) { openDrawing(id); },
  rename(id) { renameDrawing(id); },
  copyDrawing(id) { copyDrawing(id); },
  removeDrawing(id) { deleteDrawing(id); },
  downloadDrawing(id) { downloadStored(id, false); },
  shareDrawing(id) { downloadStored(id, true); },
  backup() { backup(); },
  restore() { document.querySelector("#fileBackup").click(); }
};

function paintChrome() {
  renderDock(dock, app);
  renderTabs(tabs, app, tab);
  paintQuick();
}

async function refresh() {
  const token = ++panelToken;
  paintChrome();
  await renderPanel(panel, tab, app, wide);
  if (token !== panelToken) return;
  if (wide) panel.classList.remove("closed");
}

function pixelSize() {
  const preset = CONFIG.sizes.find((item) => item.id === state.sizeId) || CONFIG.sizes[1];
  const scale = state.quality === "low" ? 0.62 : 1;
  let w = Math.round(preset.w * scale);
  let h = Math.round(preset.h * scale);
  const long = Math.max(w, h);
  if (long > 2048) {
    w = Math.round(w * 2048 / long);
    h = Math.round(h * 2048 / long);
  }
  return { w, h };
}

function applySize(id, keep) {
  state.sizeId = id;
  const next = pixelSize();
  surface.setInternal(next.w, next.h, keep);
  undo = [];
  redo = [];
  redoHist = [];
  dirty = true;
  if (keep) toastMsg(S.sizeReset);
  refresh();
}

function before() {
  undo.push(surface.snapshot());
  redo = [];
  redoHist = [];
  const limit = surface.width * surface.height > 1400 * 1400 ? 5 : (state.quality === "low" ? 6 : 10);
  while (undo.length > limit) undo.shift();
}

function undoAction() {
  if (stroke || !undo.length) return;
  redo.push(surface.snapshot());
  redoHist.push(history.pop() || null);
  surface.restore(undo.pop());
  dirty = true;
  dirtyDoc = true;
}

function redoAction() {
  if (stroke || !redo.length) return;
  undo.push(surface.snapshot());
  const command = redoHist.pop();
  if (command) history.push(command);
  surface.restore(redo.pop());
  dirty = true;
  dirtyDoc = true;
}

function strokeCommand() {
  return {
    type: "stroke",
    tool: stroke.tool,
    straight: !!stroke.straight,
    color: stroke.color,
    color2: stroke.color2,
    alpha: stroke.alpha,
    size: stroke.size,
    liner: stroke.liner,
    metal: stroke.metal,
    symmetry: stroke.symmetry,
    mirror: stroke.mirror,
    eraseTarget: stroke.eraseTarget,
    points: stroke.points.map((point) => ({
      x: point.x / surface.width,
      y: point.y / surface.height,
      p: point.p
    }))
  };
}

function redrawStroke() {
  if (!stroke || !undo.length) return;
  surface.restore(undo[undo.length - 1]);
  renderStroke(surface.outline, surface.paint, strokeCommand());
  dirty = true;
}

function pressure(event, dist, dt) {
  const speed = dt > 0 ? dist / dt : 0;
  if (event.pointerType === "pen" && event.pressure > 0 && event.pressure < 0.99) return event.pressure;
  return clamp(0.9 - Math.min(1, speed / 1.6) * 0.5, 0.35, 1);
}

function pointerDown(event) {
  try { pointerDownBody(event); } catch (error) { toastMsg(error && error.message ? error.message : "خط کشیدن باز نشد"); }
}

function pointerDownBody(event) {
  if (event.cancelable) event.preventDefault();
  try { view.setPointerCapture(event.pointerId); } catch (error) { /* already captured */ }
  const local = surface.clientPoint(event);
  if (event.pointerType === "pen") {
    for (const [id, item] of pointers) if (item.kind === "touch") pointers.delete(id);
  }
  if (event.pointerType === "touch" && [...pointers.values()].some((item) => item.kind === "pen")) return;
  pointers.set(event.pointerId, { x: local.x, y: local.y, kind: event.pointerType });
  if (pointers.size >= 2) {
    cancelStroke();
    const pts = [...pointers.values()];
    pinch = {
      dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
      cx: (pts[0].x + pts[1].x) / 2,
      cy: (pts[0].y + pts[1].y) / 2,
      zoom: surface.zoom
    };
    return;
  }
  if (space || state.tool === "pan" || event.button === 1) {
    panning = { id: event.pointerId, x: local.x, y: local.y };
    return;
  }
  if (state.tool === "trace") {
    if (!state.ref) { toastMsg(S.tracePick); return; }
    refDrag = { id: event.pointerId, x: local.x, y: local.y, ox: state.ref.x, oy: state.ref.y };
    return;
  }
  const world = surface.screenToInternal(local.x, local.y);
  if (!world.inside) return;
  if (state.tool === "drop") { sample(world.x, world.y); return; }
  if (state.tool === "fill") { doFill(world.x, world.y); return; }
  before();
  stroke = {
    tool: state.tool,
    points: [],
    straight: state.straight,
    color: state.color,
    color2: state.color2,
    alpha: state.alpha,
    size: state.size,
    liner: state.liner,
    metal: state.metal,
    symmetry: state.symmetry,
    mirror: state.mirror && state.symmetry > 1,
    eraseTarget: state.eraseTarget
  };
  pushPoint(event, world);
  if (!stroke.straight) {
    holdTimer = setTimeout(() => {
      if (!stroke) return;
      stroke.straight = true;
      redrawStroke();
    }, 560);
  }
  if (state.sound && (state.tool === "liner" || state.tool === "metal" || state.tool === "dots")) audio.tick();
  redrawStroke();
}

function pushPoint(event, world) {
  const now = performance.now();
  const last = stroke.points[stroke.points.length - 1];
  const dist = last ? Math.hypot(world.x - last.x, world.y - last.y) : 0;
  if (dist > 8) clearTimeout(holdTimer);
  if (last && dist < 0.5) return;
  stroke.points.push({ x: world.x, y: world.y, p: pressure(event, dist, now - lastTime || 16) });
  lastTime = now;
}

function pointerMove(event) {
  try { pointerMoveBody(event); } catch (error) { toastMsg(error && error.message ? error.message : "خط کشیدن باز نشد"); }
}

function pointerMoveBody(event) {
  if (!pointers.has(event.pointerId)) return;
  const local = surface.clientPoint(event);
  pointers.set(event.pointerId, { x: local.x, y: local.y, kind: event.pointerType });
  if (pointers.size >= 2 && pinch) {
    const pts = [...pointers.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    const cx = (pts[0].x + pts[1].x) / 2;
    const cy = (pts[0].y + pts[1].y) / 2;
    surface.setZoom(pinch.zoom * (dist / pinch.dist));
    surface.panBy(cx - pinch.cx, cy - pinch.cy);
    pinch = { dist, cx, cy, zoom: surface.zoom };
    dirty = true;
    return;
  }
  if (panning && panning.id === event.pointerId) {
    surface.panBy(local.x - panning.x, local.y - panning.y);
    panning.x = local.x;
    panning.y = local.y;
    dirty = true;
    return;
  }
  if (refDrag && refDrag.id === event.pointerId && state.ref) {
    const start = surface.screenToInternal(refDrag.x, refDrag.y);
    const now = surface.screenToInternal(local.x, local.y);
    state.ref.x = refDrag.ox + (now.x - start.x) / surface.width;
    state.ref.y = refDrag.oy + (now.y - start.y) / surface.height;
    dirty = true;
    return;
  }
  if (!stroke) return;
  const list = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
  (list.length ? list : [event]).forEach((sample) => {
    const point = surface.clientPoint(sample);
    pushPoint(sample, surface.screenToInternal(point.x, point.y));
  });
  redrawStroke();
}

function cancelStroke() {
  clearTimeout(holdTimer);
  if (!stroke) return;
  if (undo.length) surface.restore(undo.pop());
  stroke = null;
  dirty = true;
}

function pointerUp(event) {
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinch = null;
  if (panning && panning.id === event.pointerId) panning = null;
  if (refDrag && refDrag.id === event.pointerId) refDrag = null;
  if (!stroke) return;
  clearTimeout(holdTimer);
  if (stroke.points.length) {
    redrawStroke();
    history.push(strokeCommand());
    if (history.length > 2500) history.shift();
    dirtyDoc = true;
  } else if (undo.length) surface.restore(undo.pop());
  stroke = null;
  dirty = true;
}

function sample(x, y) {
  const px = clamp(Math.round(x), 0, surface.width - 1);
  const py = clamp(Math.round(y), 0, surface.height - 1);
  const paint = surface.paint.getContext("2d", { willReadFrequently: true }).getImageData(px, py, 1, 1).data;
  const source = paint[3] > 18 ? paint : surface.outline.getContext("2d", { willReadFrequently: true }).getImageData(px, py, 1, 1).data;
  if (source[3] < 12) return;
  const hex = "#" + [source[0], source[1], source[2]].map((n) => n.toString(16).padStart(2, "0")).join("");
  app.setColor(hex);
}

function doFill(x, y) {
  before();
  const style = {
    c1: parseHex(state.color),
    c2: parseHex(state.color2),
    alpha: state.alpha,
    gap: state.gap,
    mode: state.fillMode
  };
  let ok = false;
  let spot = null;
  symmetryPoints(x, y, state.symmetry, state.mirror && state.symmetry > 1, surface.width, surface.height).forEach((point) => {
    const result = glassFill(surface.outline, surface.paint, point.x, point.y, style);
    if (result.ok) { ok = true; spot = result; }
  });
  if (!ok) {
    surface.restore(undo.pop());
    toastMsg(S.leak);
    dirty = true;
    return;
  }
  history.push({
    type: "fill",
    x: x / surface.width,
    y: y / surface.height,
    color: state.color,
    color2: state.color2,
    alpha: state.alpha,
    gap: state.gap,
    fillMode: state.fillMode,
    symmetry: state.symmetry,
    mirror: state.mirror && state.symmetry > 1
  });
  fills += 1;
  if (spot) flash = { x: spot.cx, y: spot.cy, life: 1 };
  if (state.sound) audio.chime();
  if (fills % 3 === 0) cheer();
  dirty = true;
  dirtyDoc = true;
}

function applyTemplate(id) {
  if (id === "blank") { clearAll(); return; }
  before();
  drawTemplate(surface.outline.getContext("2d"), id, surface.width, surface.height, state.liner, { petals: state.petals, rings: state.rings });
  history.push({ type: "template", name: id, color: state.liner, opts: { petals: state.petals, rings: state.rings } });
  dirty = true;
  dirtyDoc = true;
  if (state.sound) audio.tick();
}

async function clearAll() {
  if (!(await confirmBox(S.confirmClear))) return;
  before();
  surface.clear();
  history.push({ type: "clear" });
  dirty = true;
  dirtyDoc = true;
}

function toBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

async function makeThumb() {
  const canvas = document.createElement("canvas");
  canvas.width = 280;
  canvas.height = Math.max(80, Math.round(280 * surface.height / surface.width));
  const ctx = canvas.getContext("2d");
  const pad = Math.round(Math.min(surface.width, surface.height) * 0.06);
  const scale = canvas.width / (surface.width + pad * 2);
  ctx.scale(scale, scale);
  ctx.translate(pad, pad);
  paintScene(ctx, surface.width, surface.height, { ...scene(), outline: surface.outline, paint: surface.paint, showRef: false, guides: 0, flash: null });
  return toBlob(canvas);
}

async function saveNow(celebrate) {
  if (saving) return;
  saving = true;
  try {
    if (!docId) { docId = newId(); createdAt = Date.now(); }
    await saveDrawing({
      id: docId,
      name: docName,
      createdAt,
      updatedAt: Date.now(),
      w: surface.width,
      h: surface.height,
      mode: state.mode,
      frame: state.frame,
      sizeId: state.sizeId,
      quality: state.quality,
      outline: await toBlob(surface.outline),
      paint: await toBlob(surface.paint),
      thumb: await makeThumb(),
      strokes: history
    });
    dirtyDoc = false;
    if (celebrate) {
      if (state.sound) audio.chord();
      bloom();
      cheer();
      toastMsg(S.saved);
    }
    if (tab === "gallery") refresh();
  } catch (error) {
    toastMsg(S.noSave);
  } finally {
    saving = false;
  }
}

async function blobImage(blob) {
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function openDrawing(id) {
  try {
    const item = await getDrawing(id);
    if (!item) return;
    const outline = await blobImage(item.outline);
    const paint = await blobImage(item.paint);
    surface.setInternal(item.w || surface.width, item.h || surface.height, false);
    if (outline) surface.outline.getContext("2d").drawImage(outline, 0, 0, surface.width, surface.height);
    if (paint) surface.paint.getContext("2d").drawImage(paint, 0, 0, surface.width, surface.height);
    history = Array.isArray(item.strokes) ? item.strokes : [];
    docId = item.id;
    docName = item.name || S.defaultName;
    createdAt = item.createdAt || Date.now();
    state.mode = item.mode || state.mode;
    state.frame = item.frame || state.frame;
    undo = [];
    redo = [];
    redoHist = [];
    dirty = true;
    dirtyDoc = false;
    paintQuick();
    toastMsg(docName);
  } catch (error) {
    toastMsg(S.noSave);
  }
}

async function loadGallery() {
  try {
    const items = await listDrawings();
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      thumbUrl: item.thumb ? URL.createObjectURL(item.thumb) : ""
    }));
  } catch (error) {
    toastMsg(S.noSave);
    return [];
  }
}

async function renameDrawing(id) {
  const item = await getDrawing(id);
  if (!item) return;
  const name = await askName(item.name || S.defaultName);
  if (!name) return;
  item.name = name;
  if (id === docId) docName = name;
  await saveDrawing(item);
  refresh();
}

async function copyDrawing(id) {
  const item = await getDrawing(id);
  if (!item) return;
  item.id = newId();
  item.name = (item.name || S.defaultName) + " ۲";
  item.createdAt = Date.now();
  item.updatedAt = Date.now();
  await saveDrawing(item);
  refresh();
}

async function deleteDrawing(id) {
  if (!(await confirmBox(S.confirmDelete))) return;
  await removeDrawing(id);
  if (id === docId) docId = null;
  refresh();
}

async function downloadStored(id, share) {
  const item = await getDrawing(id);
  if (!item || !item.paint) { toastMsg(S.nothing); return; }
  const outline = document.createElement("canvas");
  const paint = document.createElement("canvas");
  const o = await blobImage(item.outline);
  const p = await blobImage(item.paint);
  outline.width = item.w; outline.height = item.h;
  paint.width = item.w; paint.height = item.h;
  if (o) outline.getContext("2d").drawImage(o, 0, 0);
  if (p) paint.getContext("2d").drawImage(p, 0, 0);
  const blob = await renderPNG(outline, paint, { mode: item.mode || "back", frame: item.frame || "gold", lx: 0.34, ly: 0.3, quality: "full" }, "light");
  if (share) {
    try {
      const shared = await shareBlob(blob, (item.name || "niyayesh") + ".png", CONFIG.brand);
      if (!shared) { saveBlob(blob, (item.name || "niyayesh") + ".png"); toastMsg(S.noShare); }
    } catch (error) {
      if (!error || error.name !== "AbortError") toastMsg(S.noShare);
    }
    return;
  }
  saveBlob(blob, (item.name || "niyayesh") + ".png");
}

async function backup() {
  try {
    const data = await exportLibrary();
    saveBlob(new Blob([JSON.stringify(data)], { type: "application/json" }), "niyayesh-glass-backup.json");
  } catch (error) {
    toastMsg(S.noSave);
  }
}

async function exportKind(kind) {
  try {
    const blob = await renderPNG(surface.outline, surface.paint, scene(), kind);
    const file = (docName || "niyayesh") + ".png";
    saveBlob(blob, file);
    toastMsg(S.exported);
    return blob;
  } catch (error) {
    toastMsg(S.noSave);
    return null;
  }
}

async function shareCurrent(kind) {
  const blob = await renderPNG(surface.outline, surface.paint, scene(), kind);
  try {
    const shared = await shareBlob(blob, (docName || "niyayesh") + ".png", CONFIG.brand);
    if (!shared) { saveBlob(blob, (docName || "niyayesh") + ".png"); toastMsg(S.noShare); }
  } catch (error) {
    if (!error || error.name !== "AbortError") toastMsg(S.noShare);
  }
}

async function makeVideo() {
  if (!history.length) { toastMsg(S.noStrokes); return; }
  if (!videoSupported() || !pickMime()) { toastMsg(S.noVideo); return; }
  toastMsg(S.videoBusy);
  try {
    const blob = await recordTimelapse(history, { w: surface.width, h: surface.height }, scene(), () => {});
    const url = URL.createObjectURL(blob);
    openModal(S.video, (body, actions) => {
      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.src = url;
      body.append(video);
      actions.append(btn(S.download, () => saveBlob(blob, (docName || "niyayesh") + ".webm")));
      actions.append(btn(S.share, async () => {
        try {
          const shared = await shareBlob(blob, (docName || "niyayesh") + ".webm", CONFIG.brand);
          if (!shared) toastMsg(S.noShare);
        } catch (error) {
          if (!error || error.name !== "AbortError") toastMsg(S.noShare);
        }
      }, "ghost"));
    });
  } catch (error) {
    toastMsg(S.noVideo);
  }
}

function closeModal() {
  modal.hidden = true;
  modal.innerHTML = "";
}

function openModal(title, build) {
  closeModal();
  modal.hidden = false;
  const card = document.createElement("div");
  card.className = "card";
  const heading = document.createElement("h2");
  heading.textContent = title;
  const body = document.createElement("div");
  const actions = document.createElement("div");
  actions.className = "row";
  card.append(heading, body, actions);
  modal.append(card);
  build(body, actions);
}

function btn(text, run, kind) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = "btn" + (kind ? " " + kind : "");
  node.textContent = text;
  node.addEventListener("click", () => { run(); });
  return node;
}

function confirmBox(text) {
  return new Promise((resolve) => {
    openModal(text, (body, actions) => {
      actions.append(btn(S.yes, () => { closeModal(); resolve(true); }));
      actions.append(btn(S.no, () => { closeModal(); resolve(false); }, "ghost"));
    });
  });
}

function askName(value) {
  return new Promise((resolve) => {
    openModal(S.rename, (body, actions) => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = value || "";
      body.append(input);
      actions.append(btn(S.save, () => { closeModal(); resolve(input.value.trim()); }));
      actions.append(btn(S.no, () => { closeModal(); resolve(""); }, "ghost"));
    });
  });
}

function openMenu() {
  openModal(S.menu, (body, actions) => {
    const stack = document.createElement("div");
    stack.className = "stack";
    stack.append(btn(S.newGlass, () => { closeModal(); newDoc(); }));
    stack.append(btn(S.pngClear, () => exportKind("clear"), "ghost"));
    stack.append(btn(S.pngLight, () => exportKind("light")));
    stack.append(btn(S.pngTable, () => exportKind("table"), "ghost"));
    stack.append(btn(S.share, () => shareCurrent("light"), "ghost"));
    const video = btn("🎬 " + S.video, () => { closeModal(); makeVideo(); }, "ghost");
    if (!videoSupported()) video.disabled = true;
    stack.append(video);
    stack.append(btn(S.backup, () => { closeModal(); backup(); }, "ghost"));
    stack.append(btn(S.restore, () => { closeModal(); document.querySelector("#fileBackup").click(); }, "ghost"));
    stack.append(btn(S.tracePick, () => { closeModal(); document.querySelector("#fileTrace").click(); }));
    stack.append(btn(state.sound ? S.sound + " ✓" : S.sound, () => { state.sound = !state.sound; audio.setOn(state.sound); openMenu(); }, "ghost"));
    if (musicReady) stack.append(btn(S.music, () => { audio.unlock(); audio.toggleMusic(); }, "ghost"));
    if (window.DeviceOrientationEvent) stack.append(btn(S.tilt, () => enableTilt(), "ghost"));
    stack.append(btn(S.help, () => openModal(S.help, (inner) => { const p = document.createElement("p"); p.textContent = S.helpText; inner.append(p); }), "ghost"));
    stack.append(elNote(CONFIG.storageNote));
    body.append(stack);
    actions.append(btn(S.no, closeModal, "ghost"));
  });
}

function elNote(text) {
  const node = document.createElement("p");
  node.className = "note";
  node.textContent = text;
  return node;
}

async function enableTilt() {
  try {
    const orientation = window.DeviceOrientationEvent;
    if (orientation && typeof orientation.requestPermission === "function") {
      const result = await orientation.requestPermission();
      if (result !== "granted") { toastMsg(S.noTilt); return; }
    }
    window.addEventListener("deviceorientation", (event) => {
      if (event.gamma == null) return;
      tilt.x = clamp(event.gamma / 70, -0.28, 0.28);
      tilt.y = clamp((event.beta - 45) / 90, -0.22, 0.22);
    });
    toastMsg(S.tiltOn);
  } catch (error) {
    toastMsg(S.noTilt);
  }
}

async function newDoc() {
  if (dirtyDoc && !(await confirmBox(S.confirmClear))) return;
  docId = null;
  docName = S.defaultName;
  createdAt = Date.now();
  history = [];
  undo = [];
  redo = [];
  redoHist = [];
  surface.clear();
  dirty = true;
  dirtyDoc = false;
}

function fillChrome() {
  document.querySelector("#welcomeTitle").textContent = CONFIG.welcomeTitle;
  document.querySelector("#welcomeText").textContent = CONFIG.welcomeText;
  document.querySelector("#startBtn").textContent = CONFIG.startLabel;
  document.querySelector("#daily").textContent = dayPick().text;
  document.querySelector("#brand").textContent = CONFIG.brand;
  document.title = CONFIG.brand;
  document.querySelector("#btnMenu").textContent = S.menu;
  document.querySelector("#btnUndo").textContent = S.undo;
  document.querySelector("#btnRedo").textContent = S.redo;
  document.querySelector("#btnSave").textContent = S.save;
  document.querySelector("#btnFit").textContent = S.fit;
  document.querySelector("#btnLove").setAttribute("aria-label", S.love);
  paintSweet();
  paintQuick();
}

function paintSweet() {
  const line = CONFIG.cheers[cheerAt % CONFIG.cheers.length];
  document.querySelectorAll(".sweet").forEach((node) => { node.textContent = line; });
}

view.addEventListener("pointerdown", pointerDown, { passive: false });
view.addEventListener("pointermove", pointerMove, { passive: false });
view.addEventListener("pointerup", pointerUp);
view.addEventListener("pointercancel", pointerUp);
view.addEventListener("lostpointercapture", pointerUp);
view.addEventListener("wheel", (event) => {
  event.preventDefault();
  surface.setZoom(surface.zoom * (event.deltaY < 0 ? 1.08 : 0.92));
  dirty = true;
}, { passive: false });

window.addEventListener("keydown", (event) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (event.code === "Space") { event.preventDefault(); space = true; return; }
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "z") {
    event.preventDefault();
    if (event.shiftKey) redoAction(); else undoAction();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === "y") { event.preventDefault(); redoAction(); return; }
  const tools = { l: "liner", b: "brush", g: "fill", e: "eraser", i: "drop", d: "dots", m: "metal" };
  if (!event.ctrlKey && !event.metaKey && tools[key]) { state.tool = tools[key]; paintChrome(); refresh(); }
  if (event.key === "[") app.setSize(Math.max(2, state.size - 2));
  if (event.key === "]") app.setSize(Math.min(64, state.size + 2));
});
window.addEventListener("keyup", (event) => { if (event.code === "Space") space = false; });

document.querySelector("#startBtn").addEventListener("click", () => {
  try { audio.unlock(); } catch (error) { /* صدا بعد از شروع هم می‌آید */ }
  welcome.hidden = true;
  appEl.hidden = false;
  requestAnimationFrame(() => {
    surface.resizeView();
    dirty = true;
  });
  toastMsg(CONFIG.hint);
});
document.querySelector("#btnMenu").addEventListener("click", openMenu);
document.querySelector("#btnUndo").addEventListener("click", undoAction);
document.querySelector("#btnRedo").addEventListener("click", redoAction);
document.querySelector("#btnSave").addEventListener("click", () => saveNow(true));
document.querySelector("#btnLight").addEventListener("click", () => {
  state.mode = state.mode === "back" ? "table" : "back";
  dirty = true;
  paintQuick();
});
document.querySelector("#btnFit").addEventListener("click", () => { surface.resetView(); dirty = true; });
document.querySelector("#btnLove").addEventListener("click", () => {
  openModal("💌", (body) => {
    const text = document.createElement("p");
    text.textContent = CONFIG.loveNote;
    body.append(text);
  });
});
sizeRange.addEventListener("input", () => { state.size = Number(sizeRange.value); });
quickColor.addEventListener("click", () => app.openTab("colors"));
document.querySelector("#fileTrace").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    const image = await blobImage(file);
    state.ref = { img: image, x: 0.12, y: 0.12, scale: 0.76, alpha: 0.35 };
    state.tool = "trace";
    dirty = true;
    refresh();
  } catch (error) {
    toastMsg(S.noSave);
  }
});
document.querySelector("#fileBackup").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    await importLibrary(JSON.parse(await file.text()));
    toastMsg(S.restored);
    if (tab === "gallery") refresh();
  } catch (error) {
    toastMsg(S.noSave);
  }
});

new ResizeObserver(() => { surface.resizeView(); dirty = true; }).observe(document.querySelector(".stage"));
window.matchMedia("(min-width: 1000px)").addEventListener("change", (event) => {
  wide = event.matches;
  if (wide) panel.classList.remove("closed");
  refresh();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") audio.resume();
  else if (dirtyDoc) saveNow(false);
});
window.addEventListener("pagehide", () => { if (dirtyDoc) saveNow(false); });
setInterval(() => { if (dirtyDoc && !stroke) saveNow(false); }, 10000);
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

function frame(now) {
  const t = now / 1000;
  if (state.mode === "back" && !reduced) {
    lx = 0.36 + Math.sin(t * 0.16) * 0.12 + tilt.x;
    ly = 0.32 + Math.cos(t * 0.12) * 0.08 + tilt.y;
    dirty = true;
  }
  if (flash) {
    flash.life -= reduced ? 1 : 0.018;
    if (flash.life <= 0) flash = null;
    dirty = true;
  }
  if (dirty) {
    surface.draw(scene());
    dirty = false;
  }
  requestAnimationFrame(frame);
}

fillChrome();
applySize("medium", false);
refresh();
requestAnimationFrame(frame);
setInterval(() => { cheerAt += 1; paintSweet(); }, 8000);
fetch("assets/music.mp3").then((response) => {
  if (!response.ok) return null;
  return audio.loadMusic("assets/music.mp3");
}).then((ok) => { musicReady = !!ok; }).catch(() => { musicReady = false; });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
