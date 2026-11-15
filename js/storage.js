const DB = "niyayesh-glass";

function openDb() {
  if (!window.indexedDB) return Promise.reject(new Error("no-idb"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("drawings")) db.createObjectStore("drawings", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function listDrawings() {
  const db = await openDb();
  const items = await new Promise((resolve, reject) => {
    const request = db.transaction("drawings").objectStore("drawings").getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function saveDrawing(drawing) {
  const db = await openDb();
  const tx = db.transaction("drawings", "readwrite");
  tx.objectStore("drawings").put(drawing);
  await done(tx);
  db.close();
  return drawing;
}

export async function removeDrawing(id) {
  const db = await openDb();
  const tx = db.transaction("drawings", "readwrite");
  tx.objectStore("drawings").delete(id);
  await done(tx);
  db.close();
}

export async function getDrawing(id) {
  const db = await openDb();
  const item = await new Promise((resolve, reject) => {
    const request = db.transaction("drawings").objectStore("drawings").get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return item;
}

export function newId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function blobToData(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(blob);
  });
}

function dataToBlob(text) {
  if (!text) return null;
  const parts = text.split(",");
  const mime = (parts[0].match(/:(.*?);/) || [])[1] || "image/png";
  const binary = atob(parts[1] || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportLibrary() {
  const drawings = await listDrawings();
  const packed = [];
  for (const drawing of drawings) {
    packed.push({
      ...drawing,
      outline: drawing.outline ? await blobToData(drawing.outline) : "",
      paint: drawing.paint ? await blobToData(drawing.paint) : "",
      thumb: drawing.thumb ? await blobToData(drawing.thumb) : ""
    });
  }
  return { version: 1, drawings: packed };
}

export async function importLibrary(data) {
  const drawings = Array.isArray(data) ? data : (data && data.drawings) || [];
  let count = 0;
  for (const drawing of drawings) {
    if (!drawing || !drawing.id) continue;
    await saveDrawing({
      ...drawing,
      outline: typeof drawing.outline === "string" ? dataToBlob(drawing.outline) : drawing.outline,
      paint: typeof drawing.paint === "string" ? dataToBlob(drawing.paint) : drawing.paint,
      thumb: typeof drawing.thumb === "string" ? dataToBlob(drawing.thumb) : drawing.thumb
    });
    count += 1;
  }
  return count;
}
