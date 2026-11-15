function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function frameStyle(ctx, x, y, w, h, kind) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  if (kind === "wood") {
    g.addColorStop(0, "#f3dfc8");
    g.addColorStop(0.45, "#e2c4a4");
    g.addColorStop(1, "#c9a27c");
  } else if (kind === "rose") {
    g.addColorStop(0, "#f8d5df");
    g.addColorStop(0.5, "#e7a0ad");
    g.addColorStop(1, "#c97b8b");
  } else {
    g.addColorStop(0, "#f8e7b0");
    g.addColorStop(0.42, "#e0b44a");
    g.addColorStop(1, "#a67c2d");
  }
  return g;
}

export function paintScene(ctx, w, h, scene) {
  const pad = Math.min(w, h) * 0.045;
  const radius = Math.max(10, Math.min(w, h) * 0.018);
  ctx.save();
  if (scene.mode === "table") {
    ctx.fillStyle = "rgba(20, 8, 14, 0.28)";
    roundRect(ctx, -pad + w * 0.012, -pad + h * 0.02, w + pad * 2, h + pad * 2, radius + 8);
    ctx.fill();
  }
  ctx.lineWidth = Math.max(14, pad * 0.85);
  ctx.strokeStyle = frameStyle(ctx, -pad, -pad, w + pad * 2, h + pad * 2, scene.frame);
  roundRect(ctx, -pad * 0.2, -pad * 0.2, w + pad * 0.4, h + pad * 0.4, radius + 4);
  ctx.stroke();
  ctx.lineWidth = Math.max(3, pad * 0.16);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  roundRect(ctx, pad * 0.08, pad * 0.08, w - pad * 0.16, h - pad * 0.16, radius);
  ctx.stroke();

  roundRect(ctx, 0, 0, w, h, radius);
  ctx.save();
  ctx.clip();
  if (scene.mode === "back") {
    const glow = ctx.createRadialGradient(scene.lx * w, scene.ly * h, w * 0.02, w * 0.5, h * 0.5, w * 0.9);
    glow.addColorStop(0, "#fff6df");
    glow.addColorStop(0.4, "#ffd7b0");
    glow.addColorStop(1, "#e7a0c4");
    ctx.fillStyle = glow;
  } else {
    const linen = ctx.createLinearGradient(0, 0, 0, h);
    linen.addColorStop(0, "#fff9f4");
    linen.addColorStop(1, "#f0ddd2");
    ctx.fillStyle = linen;
  }
  ctx.fillRect(0, 0, w, h);

  if (scene.ref && scene.ref.img && scene.showRef) {
    ctx.save();
    ctx.globalAlpha = scene.ref.alpha;
    const rw = w * scene.ref.scale;
    const rh = rw * (scene.ref.img.naturalHeight || scene.ref.img.height) / Math.max(1, scene.ref.img.naturalWidth || scene.ref.img.width);
    ctx.drawImage(scene.ref.img, scene.ref.x * w, scene.ref.y * h, rw, rh);
    ctx.restore();
  }

  if (scene.mode === "table" && scene.quality !== "low") {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.drawImage(scene.paint, w * 0.008, h * 0.012);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.drawImage(scene.paint, w * 0.004, h * 0.003);
  ctx.restore();
  if (scene.mode === "back") {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.72;
    ctx.drawImage(scene.paint, 0, 0);
    ctx.restore();
  }
  ctx.drawImage(scene.paint, 0, 0);
  ctx.drawImage(scene.outline, 0, 0);

  const pane = ctx.createLinearGradient(0, 0, 0, h);
  pane.addColorStop(0, "rgba(255,255,255,0.2)");
  pane.addColorStop(0.2, "rgba(255,255,255,0.03)");
  pane.addColorStop(0.8, "rgba(255,255,255,0)");
  pane.addColorStop(1, "rgba(40, 16, 24, 0.12)");
  ctx.fillStyle = pane;
  ctx.fillRect(0, 0, w, h);

  const streak = ctx.createLinearGradient(w * 0.08, 0, w * 0.4, 0);
  streak.addColorStop(0, "rgba(255,255,255,0)");
  streak.addColorStop(0.5, "rgba(255,255,255,0.2)");
  streak.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = streak;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(scene.lx * w, scene.ly * h);
  ctx.rotate(-0.6);
  const spec = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.min(w, h) * 0.2);
  spec.addColorStop(0, "rgba(255,255,255,0.72)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.min(w, h) * 0.16, Math.min(w, h) * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();

  if (scene.flash && scene.flash.life > 0) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, scene.flash.life) * 0.5;
    const rad = (1.15 - scene.flash.life) * Math.min(w, h) * 0.22;
    const glow = ctx.createRadialGradient(scene.flash.x, scene.flash.y, 0, scene.flash.x, scene.flash.y, Math.max(8, rad));
    glow.addColorStop(0, "rgba(255,255,255,0.95)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(scene.flash.x, scene.flash.y, Math.max(8, rad), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (scene.guides && scene.guides > 1) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.strokeStyle = "rgba(255, 133, 173, 0.35)";
    ctx.lineWidth = Math.max(1, w * 0.002);
    const n = scene.guides;
    for (let i = 0; i < n; i += 1) {
      const a = (Math.PI * i) / n;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * -w, Math.sin(a) * -h);
      ctx.lineTo(Math.cos(a) * w, Math.sin(a) * h);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}
