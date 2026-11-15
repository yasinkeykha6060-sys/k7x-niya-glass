import { paintScene } from "./glass.js";

export function createSurface(view) {
  const outline = document.createElement("canvas");
  const paint = document.createElement("canvas");
  let iw = 1000;
  let ih = 1250;
  let cssW = 1;
  let cssH = 1;
  let dpr = 1;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let paneScale = 1;

  function fit() {
    const pad = 24;
    paneScale = Math.min(Math.max(10, cssW - pad) / iw, Math.max(10, cssH - pad) / ih);
  }

  function resizeView() {
    const rect = view.getBoundingClientRect();
    cssW = Math.max(1, rect.width);
    cssH = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.width = Math.max(1, Math.floor(cssW * dpr));
    view.height = Math.max(1, Math.floor(cssH * dpr));
    fit();
  }

  function blank(canvas, w, h) {
    canvas.width = w;
    canvas.height = h;
  }

  function setInternal(w, h, keep) {
    const prev = keep ? snapshot() : null;
    iw = Math.max(32, Math.round(w));
    ih = Math.max(32, Math.round(h));
    blank(outline, iw, ih);
    blank(paint, iw, ih);
    if (prev) {
      outline.getContext("2d").drawImage(prev.o, 0, 0, iw, ih);
      paint.getContext("2d").drawImage(prev.p, 0, 0, iw, ih);
    }
    fit();
  }

  function snapshot() {
    const o = document.createElement("canvas");
    const p = document.createElement("canvas");
    o.width = iw;
    o.height = ih;
    p.width = iw;
    p.height = ih;
    o.getContext("2d").drawImage(outline, 0, 0);
    p.getContext("2d").drawImage(paint, 0, 0);
    return { o, p };
  }

  function restore(snap) {
    const oc = outline.getContext("2d");
    const pc = paint.getContext("2d");
    oc.clearRect(0, 0, iw, ih);
    pc.clearRect(0, 0, iw, ih);
    if (!snap) return;
    oc.drawImage(snap.o, 0, 0, iw, ih);
    pc.drawImage(snap.p, 0, 0, iw, ih);
  }

  function screenToInternal(sx, sy) {
    const scale = paneScale * zoom;
    const x = (sx - cssW / 2 - panX) / scale + iw / 2;
    const y = (sy - cssH / 2 - panY) / scale + ih / 2;
    return { x, y, inside: x >= 0 && y >= 0 && x <= iw && y <= ih };
  }

  function draw(scene) {
    const ctx = view.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.save();
    const scale = paneScale * zoom;
    ctx.translate(cssW / 2 + panX, cssH / 2 + panY);
    ctx.scale(scale, scale);
    ctx.translate(-iw / 2, -ih / 2);
    paintScene(ctx, iw, ih, {
      mode: scene.mode,
      frame: scene.frame,
      lx: scene.lx,
      ly: scene.ly,
      quality: scene.quality,
      outline,
      paint,
      ref: scene.ref,
      showRef: scene.showRef,
      guides: scene.guides
    });
    ctx.restore();
  }

  setInternal(iw, ih, false);

  return {
    view,
    outline,
    paint,
    get width() { return iw; },
    get height() { return ih; },
    get zoom() { return zoom; },
    setZoom(value) { zoom = Math.max(0.45, Math.min(6, value)); },
    panBy(dx, dy) { panX += dx; panY += dy; },
    resetView() { zoom = 1; panX = 0; panY = 0; },
    resizeView,
    setInternal,
    snapshot,
    restore,
    screenToInternal,
    clientPoint(event) {
      const rect = view.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    },
    draw,
    clear() {
      outline.getContext("2d").clearRect(0, 0, iw, ih);
      paint.getContext("2d").clearRect(0, 0, iw, ih);
    }
  };
}
