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
  const pad = Math.min(w, h) * 0.04;
  const radius = Math.min(w, h) * 0.035;
  ctx.save();
  if (scene.mode === "table") {
    ctx.fillStyle = "rgba(120, 55, 75, 0.16)";
    roundRect(ctx, -pad + w * 0.015, -pad + h * 0.02, w + pad * 2, h + pad * 2, radius * 1.4);
    ctx.fill();
  }
  ctx.lineWidth = Math.max(12, pad * 0.72);
  ctx.strokeStyle = frameStyle(ctx, -pad, -pad, w + pad * 2, h + pad * 2, scene.frame);
  roundRect(ctx, -pad * 0.15, -pad * 0.15, w + pad * 0.3, h + pad * 0.3, radius);
  ctx.stroke();

  roundRect(ctx, 0, 0, w, h, radius * 0.85);
  ctx.save();
  ctx.clip();
  if (scene.mode === "back") {
    const glow = ctx.createRadialGradient(scene.lx * w, scene.ly * h, w * 0.05, w * 0.5, h * 0.45, w * 0.85);
    glow.addColorStop(0, "#fff1cf");
    glow.addColorStop(0.45, "#ffd0b0");
    glow.addColorStop(1, "#f3b7d4");
    ctx.fillStyle = glow;
  } else {
    ctx.fillStyle = "rgba(255, 250, 246, 0.42)";
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
  if (scene.mode === "back") {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.85;
    ctx.drawImage(scene.paint, 0, 0);
    ctx.restore();
  }
  ctx.drawImage(scene.paint, 0, 0);
  ctx.drawImage(scene.outline, 0, 0);

  const sheen = ctx.createLinearGradient(0, 0, w * 0.85, h);
  sheen.addColorStop(0, "rgba(255,255,255,0.3)");
  sheen.addColorStop(0.28, "rgba(255,255,255,0.06)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);

  const lx = scene.lx * w;
  const ly = scene.ly * h;
  const blob = ctx.createRadialGradient(lx, ly, 0, lx, ly, Math.min(w, h) * 0.27);
  blob.addColorStop(0, "rgba(255,255,255,0.34)");
  blob.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = blob;
  ctx.fillRect(0, 0, w, h);
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
