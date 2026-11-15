import { CONFIG } from "./config.js";

function copiesOf(x, y, n, mirror, cx, cy) {
  if (n <= 1) return [[x, y]];
  const ang = Math.atan2(y - cy, x - cx);
  const dist = Math.hypot(x - cx, y - cy);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const a = ang + (Math.PI * 2 * i) / n;
    out.push([cx + Math.cos(a) * dist, cy + Math.sin(a) * dist]);
    if (mirror) {
      const b = -ang + (Math.PI * 2 * i) / n;
      out.push([cx + Math.cos(b) * dist, cy + Math.sin(b) * dist]);
    }
  }
  return out;
}

function mapPaths(points, n, mirror, cx, cy) {
  if (n <= 1) return [points];
  const count = n * (mirror ? 2 : 1);
  const paths = Array.from({ length: count }, () => []);
  points.forEach((point) => {
    copiesOf(point.x, point.y, n, mirror, cx, cy).forEach((copy, index) => {
      paths[index].push({ x: copy[0], y: copy[1], p: point.p });
    });
  });
  return paths;
}

function metalStyle(ctx, kind, w, h) {
  const stops = CONFIG.metals[kind] || CONFIG.metals.gold;
  const g = ctx.createLinearGradient(0, 0, w, h * 0.6);
  stops.forEach((color, index) => g.addColorStop(index / (stops.length - 1), color));
  return g;
}

function traceSmooth(ctx, points, widthOf, draw) {
  if (points.length === 1) {
    draw(ctx, points[0].x, points[0].y, points[0].x, points[0].y, widthOf(points[0]));
    return;
  }
  const mids = points.map((point, index) => {
    const next = points[Math.min(points.length - 1, index + 1)];
    return { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
  });
  draw(ctx, points[0].x, points[0].y, mids[0].x, mids[0].y, widthOf(points[0]));
  for (let i = 1; i < points.length - 1; i += 1) {
    const from = mids[i - 1];
    const to = mids[i];
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(points[i].x, points[i].y, to.x, to.y);
    draw.curve(ctx, widthOf(points[i]));
  }
  const last = points[points.length - 1];
  draw(ctx, mids[mids.length - 2].x, mids[mids.length - 2].y, last.x, last.y, widthOf(last));
}

function reliefDraw(ctx, color, metal, w, h) {
  const style = metal ? metalStyle(ctx, metal, w, h) : color;
  return {
    curve(context, width) {
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "rgba(40,18,22,0.34)";
      context.lineWidth = width + Math.max(1.5, width * 0.18);
      context.save();
      context.translate(width * 0.07, width * 0.1);
      context.stroke();
      context.restore();
      context.strokeStyle = style;
      context.lineWidth = width;
      context.stroke();
      context.strokeStyle = "rgba(255,255,255,0.7)";
      context.lineWidth = Math.max(1, width * 0.2);
      context.save();
      context.translate(-width * 0.05, -width * 0.07);
      context.stroke();
      context.restore();
    }
  };
}

function linePainter(ctx, color, metal, w, h) {
  const relief = reliefDraw(ctx, color, metal, w, h);
  const fn = (context, x0, y0, x1, y1, width) => {
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    relief.curve(context, width);
  };
  fn.curve = (context, width) => relief.curve(context, width);
  return fn;
}

function stamp(ctx, x, y, radius, color, alpha, metal, w, h) {
  const r = Math.max(0.8, radius);
  const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.08, x, y, r);
  if (metal) {
    const stops = CONFIG.metals[metal] || CONFIG.metals.gold;
    g.addColorStop(0, stops[1]);
    g.addColorStop(0.55, stops[2]);
    g.addColorStop(1, stops[0]);
  } else {
    g.addColorStop(0, color);
    g.addColorStop(1, color);
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha * 0.45;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.28, y - r * 0.32, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function walk(points, step, visit) {
  if (!points.length) return;
  let prev = points[0];
  visit(prev);
  let left = step;
  for (let i = 1; i < points.length; i += 1) {
    const next = points[i];
    let dx = next.x - prev.x;
    let dy = next.y - prev.y;
    let dist = Math.hypot(dx, dy) || 1;
    while (dist >= left) {
      const t = left / dist;
      prev = { x: prev.x + dx * t, y: prev.y + dy * t, p: next.p };
      visit(prev);
      dx = next.x - prev.x;
      dy = next.y - prev.y;
      dist = Math.hypot(dx, dy) || 1;
      left = step;
    }
    left -= dist;
    prev = next;
  }
}

function erase(ctx, points, widthOf) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const width = widthOf(points[0] || { p: 0.6 });
  if (points.length < 2) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.stroke();
  }
  ctx.restore();
}

export function renderStroke(outline, paint, stroke) {
  const w = outline.width;
  const h = outline.height;
  let points = stroke.points.map((point) => ({ x: point.x * w, y: point.y * h, p: point.p == null ? 0.65 : point.p }));
  if (!points.length) return;
  if (stroke.straight && points.length > 1) {
    const p = points.reduce((sum, point) => sum + point.p, 0) / points.length;
    points = [points[0], { ...points[points.length - 1], p }];
  }
  const paths = mapPaths(points, stroke.symmetry || 1, !!stroke.mirror, w / 2, h / 2);
  const widthOf = (point) => Math.max(1.2, stroke.size * (0.5 + (point.p || 0.65) * 0.75));
  const tool = stroke.tool;
  paths.forEach((path) => {
    if (path.length < 1) return;
    if (tool === "brush" || tool === "wash" || tool === "flat") {
      const ctx = paint.getContext("2d");
      const soft = tool === "wash";
      const wide = tool === "flat";
      walk(path, Math.max(1.4, stroke.size * (soft ? 0.16 : 0.28)), (point) => {
        const radius = widthOf(point) * (soft ? 1.05 : wide ? 0.7 : 0.55);
        const alpha = (stroke.alpha || 0.8) * (soft ? 0.42 : 1);
        if (!wide) {
          stamp(ctx, point.x, point.y, radius, stroke.color, alpha, null, w, h);
          return;
        }
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate(-0.4);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = stroke.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 1.7, radius * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      return;
    }
    if (tool === "glitter") {
      const ctx = paint.getContext("2d");
      let seed = 1;
      walk(path, Math.max(4, stroke.size * 0.8), (point) => {
        for (let i = 0; i < 3; i += 1) {
          seed += 1;
          const n1 = Math.abs(Math.sin(point.x * 0.17 + seed * 1.7));
          const n2 = Math.abs(Math.cos(point.y * 0.13 + seed * 2.1));
          const jx = point.x + (n1 - 0.5) * stroke.size * 1.6;
          const jy = point.y + (n2 - 0.5) * stroke.size * 1.6;
          stamp(ctx, jx, jy, n1 * stroke.size * 0.18 + 0.8, i === 0 ? "#fffaf6" : stroke.color, 0.85, null, w, h);
        }
      });
      return;
    }
    if (tool === "dots") {
      const ctx = outline.getContext("2d");
      const step = Math.max(stroke.size * 1.15, 6);
      let last = null;
      const put = (point) => {
        if (last && Math.hypot(point.x - last.x, point.y - last.y) < step * 0.8) return;
        last = point;
        const radius = widthOf(point) * 0.45;
        ctx.save();
        ctx.fillStyle = "rgba(40,18,22,0.28)";
        ctx.beginPath();
        ctx.arc(point.x + 1.4, point.y + 1.8, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = stroke.liner || stroke.color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.beginPath();
        ctx.arc(point.x - radius * 0.3, point.y - radius * 0.3, radius * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      if (path.length === 1) put(path[0]);
      else walk(path, step, put);
      return;
    }
    if (tool === "eraser" || tool === "erasePaint") {
      const target = tool === "erasePaint" ? "paint" : (stroke.eraseTarget || "both");
      if (target !== "paint") erase(outline.getContext("2d"), path, widthOf);
      if (target !== "outline") erase(paint.getContext("2d"), path, widthOf);
      return;
    }
    const ctx = outline.getContext("2d");
    const metal = tool === "metal" ? (stroke.metal || "gold") : null;
    const color = metal ? "#e0b44a" : (stroke.liner || "#241816");
    const painter = linePainter(ctx, color, metal, w, h);
    if (path.length === 1) {
      stamp(ctx, path[0].x, path[0].y, widthOf(path[0]) * 0.45, color, 1, metal, w, h);
      return;
    }
    traceSmooth(ctx, path, widthOf, painter);
  });
}

export function symmetryPoints(x, y, n, mirror, w, h) {
  return copiesOf(x, y, n, mirror, w / 2, h / 2).map(([px, py]) => ({ x: px, y: py }));
}
