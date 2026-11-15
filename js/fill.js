export function parseHex(hex) {
  const raw = String(hex || "#e84a7f").replace("#", "");
  const h = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw.padEnd(6, "0");
  return {
    r: parseInt(h.slice(0, 2), 16) || 0,
    g: parseInt(h.slice(2, 4), 16) || 0,
    b: parseInt(h.slice(4, 6), 16) || 0
  };
}

function dilate(mask, w, h, radius) {
  const r = Math.max(0, Math.min(8, radius | 0));
  if (!r) return mask;
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!mask[y * w + x]) continue;
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(h - 1, y + r);
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      for (let yy = y0; yy <= y1; yy += 1) out.fill(1, yy * w + x0, yy * w + x1 + 1);
    }
  }
  return out;
}

function flood(mask, w, h, x, y) {
  if (x < 0 || y < 0 || x >= w || y >= h || mask[y * w + x]) return null;
  const filled = new Uint8Array(w * h);
  const stack = [x, y];
  let count = 0;
  const limit = Math.floor(w * h * 0.72);
  while (stack.length) {
    const cy = stack.pop();
    let cx = stack.pop();
    while (cx > 0 && !mask[cy * w + cx - 1] && !filled[cy * w + cx - 1]) cx -= 1;
    let up = false;
    let down = false;
    while (cx < w && !mask[cy * w + cx] && !filled[cy * w + cx]) {
      filled[cy * w + cx] = 1;
      count += 1;
      if (count > limit) return null;
      if (cy > 0) {
        const i = (cy - 1) * w + cx;
        if (!mask[i] && !filled[i]) {
          if (!up) { stack.push(cx, cy - 1); up = true; }
        } else up = false;
      }
      if (cy + 1 < h) {
        const i = (cy + 1) * w + cx;
        if (!mask[i] && !filled[i]) {
          if (!down) { stack.push(cx, cy + 1); down = true; }
        } else down = false;
      }
      cx += 1;
    }
  }
  return count ? filled : null;
}

function blend(data, i, r, g, b, a) {
  const sa = a;
  const dr = data[i];
  const dg = data[i + 1];
  const db = data[i + 2];
  const da = data[i + 3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0.001) return;
  data[i] = (r * sa + dr * da * (1 - sa)) / outA;
  data[i + 1] = (g * sa + dg * da * (1 - sa)) / outA;
  data[i + 2] = (b * sa + db * da * (1 - sa)) / outA;
  data[i + 3] = Math.max(0, Math.min(255, outA * 255));
}

export function glassFill(outline, paint, x, y, style) {
  const w = outline.width;
  const h = outline.height;
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= w || iy >= h) return { ok: false, reason: "outside" };
  const walls = outline.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < mask.length; i += 1, p += 4) {
    if (walls[p + 3] > 36) mask[i] = 1;
  }
  const thick = dilate(mask, w, h, style.gap == null ? 2 : style.gap);
  const region = flood(thick, w, h, ix, iy);
  if (!region) return { ok: false, reason: "leak" };
  const ctx = paint.getContext("2d", { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  const c1 = style.c1;
  const c2 = style.c2 || style.c1;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i < region.length; i += 1) {
    if (!region[i]) continue;
    const px = i % w;
    const py = (i / w) | 0;
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  const span = Math.max(1, maxX - minX);
  for (let i = 0; i < region.length; i += 1) {
    if (!region[i]) continue;
    const px = i % w;
    const py = (i / w) | 0;
    const t = style.mode === "gradient" ? (px - minX) / span : 0;
    const streak = 0.84 + 0.16 * (0.5 + 0.5 * Math.sin(px * 0.07 + py * 0.025));
    const dx = px - (minX + maxX) / 2;
    const dy = py - (minY + maxY) / 2;
    const spec = Math.exp(-(dx * dx + dy * dy) / (2 * 90 * 90));
    const r = (c1.r * (1 - t) + c2.r * t) * streak + 255 * spec * 0.22;
    const g = (c1.g * (1 - t) + c2.g * t) * streak + 244 * spec * 0.18;
    const b = (c1.b * (1 - t) + c2.b * t) * streak + 236 * spec * 0.16;
    blend(data, i * 4, Math.min(255, r), Math.min(255, g), Math.min(255, b), (style.alpha || 0.8) * (0.9 + spec * 0.1));
  }
  ctx.putImageData(image, 0, 0);
  return { ok: true, pixels: maxX - minX + maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}
