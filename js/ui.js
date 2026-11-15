import { templatePreview } from "./templates.js";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function btn(text, run, kind) {
  const node = el("button", "btn" + (kind ? " " + kind : ""), text);
  node.type = "button";
  node.addEventListener("click", () => { run(); });
  return node;
}

function slider(label, min, max, step, value, on) {
  const wrap = el("label", "field");
  wrap.append(el("span", "", label));
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener("input", () => on(Number(input.value)));
  wrap.append(input);
  return wrap;
}

function swatches(colors, current, on) {
  const row = el("div", "swatches");
  colors.forEach((color) => {
    const node = el("button", "swatch" + (color === current ? " on" : ""));
    node.type = "button";
    node.style.background = color;
    node.setAttribute("aria-label", color);
    node.addEventListener("click", () => on(color));
    row.append(node);
  });
  return row;
}

function toolsPanel(app) {
  const S = app.S;
  const root = el("div", "stack");
  const names = [
    ["liner", "✒️ " + S.liner],
    ["dots", "🔵 " + S.dots],
    ["brush", "🖌️ " + S.brush],
    ["wash", "🫧 " + S.wash],
    ["flat", "▭ " + S.flat],
    ["fill", "🪣 " + S.fill],
    ["glitter", "✨ " + S.glitter],
    ["metal", "🥇 " + S.metal],
    ["eraser", "🧽 " + S.eraser],
    ["erasePaint", "🧽 " + S.erasePaint],
    ["drop", "💧 " + S.drop],
    ["pan", "✋ " + S.pan],
    ["trace", "🖼️ " + S.traceMove]
  ];
  const grid = el("div", "choice");
  names.forEach(([id, label]) => {
    const node = btn(label, () => app.setTool(id), app.state.tool === id ? "" : "ghost");
    if (app.state.tool === id) node.classList.add("on");
    grid.append(node);
  });
  root.append(grid);
  root.append(slider(S.size, 2, 64, 1, app.state.size, app.setSize));
  if (app.state.tool === "brush" || app.state.tool === "wash" || app.state.tool === "flat" || app.state.tool === "fill" || app.state.tool === "glitter") {
    root.append(slider(S.alpha, 0.45, 0.9, 0.01, app.state.alpha, app.setAlpha));
  }
  if (app.state.tool === "fill") {
    root.append(slider(S.gap, 0, 6, 1, app.state.gap, app.setGap));
    const row = el("div", "row");
    row.append(btn(S.solid, () => app.setFillMode("solid"), app.state.fillMode === "solid" ? "" : "ghost"));
    row.append(btn(S.gradient, () => app.setFillMode("gradient"), app.state.fillMode === "gradient" ? "" : "ghost"));
    root.append(row);
  }
  if (app.state.tool === "liner" || app.state.tool === "dots" || app.state.tool === "metal") {
    const straight = btn(S.straight, app.toggleStraight, app.state.straight ? "" : "ghost");
    if (app.state.straight) straight.classList.add("on");
    root.append(straight);
  }
  root.append(slider(S.axes, 1, 12, 1, app.state.symmetry, app.setSym));
  const mirror = btn(S.mirror, app.toggleMirror, app.state.mirror ? "" : "ghost");
  if (app.state.mirror) mirror.classList.add("on");
  root.append(mirror);
  if (app.state.tool === "eraser") {
    const row = el("div", "row");
    [["both", "هر دو"], ["outline", "فقط خط"], ["paint", "فقط رنگ"]].forEach(([id, label]) => {
      row.append(btn(label, () => app.setEraseTarget(id), app.state.eraseTarget === id ? "" : "ghost"));
    });
    root.append(row);
  }
  if (app.state.tool === "metal") {
    const row = el("div", "row");
    [["gold", S.gold], ["silver", S.silver], ["rose", S.roseGold]].forEach(([id, label]) => {
      row.append(btn(label, () => app.setMetal(id), app.state.metal === id ? "" : "ghost"));
    });
    root.append(row);
  }
  root.append(el("p", "note", S.keys));
  return root;
}

function colorsPanel(app) {
  const S = app.S;
  const root = el("div", "stack");
  root.append(el("h2", "", S.colors));
  root.append(swatches(app.state.swatches, app.state.color, app.setColor));
  const pals = el("div", "row");
  Object.keys(app.CONFIG.paletteNames).forEach((id) => {
    pals.append(btn(app.CONFIG.paletteNames[id], () => app.setPalette(id), "ghost"));
  });
  root.append(pals);
  const extra = el("div", "row");
  extra.append(btn(S.allColors, () => app.setSwatches(app.CONFIG.colors), "ghost"));
  extra.append(btn(S.today, app.randomPalette, "ghost"));
  root.append(extra);
  root.append(el("h2", "", S.recent));
  root.append(swatches(app.state.recent, app.state.color, app.setColor));
  root.append(el("h2", "", S.custom));
  root.append(slider(S.hue, 0, 360, 1, app.state.hue, (value) => app.setHsl("hue", value)));
  root.append(slider(S.sat, 20, 100, 1, app.state.sat, (value) => app.setHsl("sat", value)));
  root.append(slider(S.lit, 25, 85, 1, app.state.lit, (value) => app.setHsl("lit", value)));
  root.append(slider(S.alpha, 0.45, 0.9, 0.01, app.state.alpha, app.setAlpha));
  if (app.state.fillMode === "gradient") root.append(el("p", "note", S.second));
  root.append(el("h2", "", S.linerColors));
  const liners = el("div", "row");
  app.CONFIG.linerColors.forEach((item) => {
    const node = btn(item.name, () => app.setLiner(item.hex), "ghost");
    node.style.borderColor = item.hex;
    liners.append(node);
  });
  root.append(liners);
  const custom = document.createElement("input");
  custom.type = "color";
  custom.value = app.state.liner;
  custom.addEventListener("input", () => app.setLiner(custom.value));
  root.append(custom);
  return root;
}

function plansPanel(app) {
  const S = app.S;
  const root = el("div", "stack");
  root.append(btn(app.dailyText(), app.useDaily, "ghost"));
  const grid = el("div", "plans");
  app.CONFIG.templates.forEach((item) => {
    const card = el("button", "plan");
    card.type = "button";
    const preview = document.createElement("canvas");
    preview.width = 160;
    preview.height = 200;
    if (item.id !== "blank") templatePreview(preview, item.id, { petals: app.state.petals, rings: app.state.rings });
    card.append(preview);
    card.append(el("span", "", item.name));
    card.addEventListener("click", () => app.useTemplate(item.id));
    grid.append(card);
  });
  root.append(grid);
  root.append(slider(S.petals, 6, 16, 1, app.state.petals, app.setPetals));
  root.append(slider(S.rings, 2, 5, 1, app.state.rings, app.setRings));
  root.append(el("h2", "", S.glassSize));
  const sizes = el("div", "row");
  app.CONFIG.sizes.forEach((item) => {
    sizes.append(btn(item.name, () => app.setGlass(item.id), app.state.sizeId === item.id ? "" : "ghost"));
  });
  root.append(sizes);
  root.append(el("h2", "", S.frame));
  const frames = el("div", "row");
  [["gold", S.frameGold], ["wood", S.frameWood], ["rose", S.frameRose]].forEach(([id, label]) => {
    frames.append(btn(label, () => app.setFrame(id), app.state.frame === id ? "" : "ghost"));
  });
  root.append(frames);
  const quality = el("div", "row");
  quality.append(btn(S.full, () => app.setQuality("full"), app.state.quality === "full" ? "" : "ghost"));
  quality.append(btn(S.low, () => app.setQuality("low"), app.state.quality === "low" ? "" : "ghost"));
  root.append(quality);
  root.append(el("h2", "", S.trace));
  const trace = el("div", "row");
  trace.append(btn(S.tracePick, app.pickTrace));
  trace.append(btn(S.traceGone, app.clearTrace, "ghost"));
  root.append(trace);
  if (app.state.ref) root.append(slider(S.traceOpacity, 0.1, 0.6, 0.02, app.state.ref.alpha, app.setTraceAlpha));
  return root;
}

function galleryPanel(app, items) {
  const S = app.S;
  const root = el("div", "stack");
  root.append(el("p", "note", app.CONFIG.storageNote));
  const row = el("div", "row");
  row.append(btn(S.backup, app.backup, "ghost"));
  row.append(btn(S.restore, app.restore, "ghost"));
  root.append(row);
  if (!items.length) {
    root.append(el("p", "note", S.emptyGallery));
    return root;
  }
  const grid = el("div", "gallery");
  items.forEach((item) => {
    const card = el("article", "card drawing");
    if (item.thumbUrl) {
      const img = document.createElement("img");
      img.src = item.thumbUrl;
      img.alt = "";
      card.append(img);
    }
    card.append(el("h2", "", item.name || S.defaultName));
    const actions = el("div", "row");
    actions.append(btn(S.open, () => app.openDrawing(item.id)));
    actions.append(btn(S.rename, () => app.rename(item.id), "ghost"));
    actions.append(btn(S.copy, () => app.copyDrawing(item.id), "ghost"));
    actions.append(btn(S.download, () => app.downloadDrawing(item.id), "ghost"));
    actions.append(btn(S.share, () => app.shareDrawing(item.id), "ghost"));
    actions.append(btn(S.remove, () => app.removeDrawing(item.id), "danger"));
    card.append(actions);
    grid.append(card);
  });
  root.append(grid);
  return root;
}

export function renderDock(dock, app) {
  const S = app.S;
  dock.innerHTML = "";
  [["liner", "✒️", S.liner], ["dots", "●", S.dots], ["brush", "🖌️", S.brush], ["wash", "🫧", S.wash], ["flat", "▭", S.flat], ["fill", "🪣", S.fill], ["glitter", "✨", S.glitter], ["metal", "🥇", S.metal], ["eraser", "🧽", S.eraser], ["erasePaint", "◌", S.erasePaint], ["drop", "💧", S.drop], ["pan", "✋", S.pan]].forEach(([id, icon, label]) => {
    const node = el("button", "tool" + (app.state.tool === id ? " on" : ""));
    node.type = "button";
    node.textContent = icon + " " + label;
    node.addEventListener("click", () => app.setTool(id));
    dock.append(node);
  });
}

export function renderTabs(tabs, app, tab) {
  const S = app.S;
  tabs.innerHTML = "";
  [["tools", S.tools], ["colors", S.colors], ["plans", S.plans], ["gallery", S.mine]].forEach(([id, label]) => {
    const node = el("button", "tab" + (tab === id ? " on" : ""), label);
    node.type = "button";
    node.addEventListener("click", () => app.openTab(id));
    tabs.append(node);
  });
}

export async function renderPanel(panel, tab, app, wide) {
  panel.innerHTML = "";
  if (wide) {
    const tabs = el("div", "tabs inner-tabs");
    renderTabs(tabs, app, tab);
    panel.append(tabs);
  }
  if (tab === "tools") panel.append(toolsPanel(app));
  if (tab === "colors") panel.append(colorsPanel(app));
  if (tab === "plans") panel.append(plansPanel(app));
  if (tab === "gallery") panel.append(galleryPanel(app, await app.gallery()));
}
