function strokePath(ctx, build, width, color) {
  const run = (dx, dy, lw, style) => {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.lineWidth = lw;
    ctx.strokeStyle = style;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    build(ctx);
    ctx.stroke();
    ctx.restore();
  };
  run(2.4, 3.1, width + 3.2, "rgba(40, 18, 22, 0.38)");
  run(0, 0, width, color);
  run(-1.3, -1.6, Math.max(1.4, width * 0.22), "rgba(255,255,255,0.72)");
}

function ellipsePath(x, y, rx, ry, rot) {
  return (ctx) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
  };
}

function heartPath(x, y, s) {
  return (ctx) => {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.32);
    ctx.bezierCurveTo(x - s * 0.62, y - 0.05 * s, x - s * 0.52, y - s * 0.72, x, y - s * 0.28);
    ctx.bezierCurveTo(x + s * 0.52, y - s * 0.72, x + s * 0.62, y - 0.05 * s, x, y + s * 0.32);
    ctx.closePath();
  };
}

function starPath(x, y, r, inner, n) {
  return (ctx) => {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i += 1) {
      const rad = i % 2 ? inner : r;
      const a = -Math.PI / 2 + (i * Math.PI) / n;
      const px = x + Math.cos(a) * rad;
      const py = y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
}

function punchOutside(ctx, cx, cy, rx, ry) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.rect(-80, -80, 1160, 1460);
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill("evenodd");
  ctx.restore();
}

function diamond(x, y, dw, dh) {
  return (ctx) => {
    ctx.beginPath();
    ctx.moveTo(x, y - dh / 2);
    ctx.lineTo(x + dw / 2, y);
    ctx.lineTo(x, y + dh / 2);
    ctx.lineTo(x - dw / 2, y);
    ctx.closePath();
  };
}

const painters = {
  pineapple(ctx, color, width) {
    const cx = 500;
    const cy = 760;
    const rx = 250;
    const ry = 300;
    const dw = 78;
    const dh = 64;
    for (let row = 0; row < 12; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        const x = cx - 4 * dw + col * dw + (row % 2 ? dw / 2 : 0);
        const y = cy - 5 * (dh / 2) + row * (dh / 2);
        strokePath(ctx, diamond(x, y, dw, dh), width * 0.72, color);
      }
    }
    punchOutside(ctx, cx, cy, rx, ry);
    strokePath(ctx, ellipsePath(cx, cy, rx, ry), width, color);
    [[-150, -0.5], [-70, -0.2], [0, 0], [70, 0.2], [150, 0.5]].forEach(([dx, rot], i) => {
      strokePath(ctx, ellipsePath(cx + dx * 0.45, 390 - (i === 2 ? 30 : 0), 34, 92, rot), width * 0.8, color);
    });
  },
  heart(ctx, color, width) {
    strokePath(ctx, heartPath(500, 690, 340), width, color);
    strokePath(ctx, heartPath(500, 700, 180), width * 0.8, color);
  },
  rose(ctx, color, width) {
    for (let ring = 0; ring < 3; ring += 1) {
      const count = 5 + ring * 2;
      const dist = 70 + ring * 78;
      for (let i = 0; i < count; i += 1) {
        const a = (Math.PI * 2 * i) / count + ring;
        strokePath(ctx, ellipsePath(500 + Math.cos(a) * dist, 640 + Math.sin(a) * dist, 36 + ring * 8, 78 + ring * 10, a), width * 0.75, color);
      }
    }
    strokePath(ctx, ellipsePath(500, 640, 42, 42), width, color);
  },
  tulip(ctx, color, width) {
    strokePath(ctx, (c) => {
      c.beginPath();
      c.moveTo(500, 430);
      c.bezierCurveTo(300, 430, 280, 760, 500, 820);
      c.bezierCurveTo(720, 760, 700, 430, 500, 430);
      c.closePath();
    }, width, color);
    strokePath(ctx, (c) => {
      c.beginPath();
      c.moveTo(500, 430);
      c.lineTo(500, 760);
    }, width * 0.7, color);
    strokePath(ctx, (c) => {
      c.beginPath();
      c.moveTo(470, 980);
      c.lineTo(530, 980);
      c.lineTo(520, 1120);
      c.lineTo(480, 1120);
      c.closePath();
    }, width * 0.8, color);
    strokePath(ctx, ellipsePath(390, 980, 70, 28, -0.8), width * 0.75, color);
  },
  butterfly(ctx, color, width) {
    strokePath(ctx, ellipsePath(360, 560, 150, 90, -0.5), width, color);
    strokePath(ctx, ellipsePath(640, 560, 150, 90, 0.5), width, color);
    strokePath(ctx, ellipsePath(390, 760, 110, 80, 0.4), width, color);
    strokePath(ctx, ellipsePath(610, 760, 110, 80, -0.4), width, color);
    strokePath(ctx, ellipsePath(500, 660, 28, 150), width, color);
    strokePath(ctx, ellipsePath(360, 540, 22, 22), width * 0.6, color);
    strokePath(ctx, ellipsePath(640, 540, 22, 22), width * 0.6, color);
  },
  bird(ctx, color, width) {
    strokePath(ctx, ellipsePath(520, 700, 150, 90, -0.2), width, color);
    strokePath(ctx, ellipsePath(390, 640, 90, 48, -0.6), width, color);
    strokePath(ctx, ellipsePath(680, 660, 46, 40), width, color);
    strokePath(ctx, (c) => {
      c.beginPath();
      c.moveTo(300, 720);
      c.lineTo(180, 640);
      c.lineTo(190, 780);
      c.closePath();
    }, width, color);
    strokePath(ctx, ellipsePath(700, 650, 8, 8), width * 0.5, color);
  },
  moon(ctx, color, width) {
    strokePath(ctx, ellipsePath(430, 620, 180, 180), width, color);
    strokePath(ctx, starPath(720, 420, 90, 40, 5), width, color);
    strokePath(ctx, starPath(760, 780, 36, 16, 5), width * 0.7, color);
    strokePath(ctx, starPath(250, 360, 28, 12, 5), width * 0.7, color);
  },
  sunflower(ctx, color, width) {
    for (let i = 0; i < 14; i += 1) {
      const a = (Math.PI * 2 * i) / 14;
      strokePath(ctx, ellipsePath(500 + Math.cos(a) * 210, 640 + Math.sin(a) * 210, 42, 100, a + Math.PI / 2), width * 0.75, color);
    }
    strokePath(ctx, ellipsePath(500, 640, 120, 120), width, color);
    strokePath(ctx, ellipsePath(500, 640, 48, 48), width * 0.7, color);
  },
  hearts(ctx, color, width) {
    strokePath(ctx, heartPath(390, 700, 230), width, color);
    strokePath(ctx, heartPath(610, 700, 230), width, color);
  },
  mandala(ctx, color, width, opts) {
    const petals = Math.max(6, Math.min(16, (opts && opts.petals) || 10));
    const rings = Math.max(2, Math.min(5, (opts && opts.rings) || 3));
    strokePath(ctx, ellipsePath(500, 640, 250, 250), width * 0.7, color);
    for (let ring = 1; ring <= rings; ring += 1) {
      const dist = 60 + ring * 58;
      for (let i = 0; i < petals; i += 1) {
        const a = (Math.PI * 2 * i) / petals + ring * 0.2;
        strokePath(ctx, ellipsePath(500 + Math.cos(a) * dist, 640 + Math.sin(a) * dist, 16 + ring * 4, 36 + ring * 8, a), width * 0.62, color);
      }
      strokePath(ctx, ellipsePath(500, 640, dist * 0.55, dist * 0.55), width * 0.5, color);
    }
  },
  blank() {}
};

export function drawTemplate(ctx, name, w, h, color, opts) {
  const paint = painters[name] || painters.blank;
  const temp = document.createElement("canvas");
  temp.width = Math.max(1, w);
  temp.height = Math.max(1, h);
  const local = temp.getContext("2d");
  local.save();
  local.scale(w / 1000, h / 1250);
  paint(local, color || "#241816", 22, opts || {});
  local.restore();
  ctx.drawImage(temp, 0, 0);
}

export function templatePreview(canvas, name, opts) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff5f8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawTemplate(ctx, name, canvas.width, canvas.height, "#6b2748", opts);
}
