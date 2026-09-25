// Recipe photos. Each recipe can have one photo, stored as two small JPEGs in
// their own rows so the recipe list stays fast:
//   recipethumb_<id>  ~160px, for the list
//   recipephoto_<id>  ~1000px, for the recipe screen
// The recipe itself only carries photoAt (when the photo last changed).

import { useEffect, useState } from "react";
import { sbGetMany, sbSet } from "./supabaseClient";

export const photoKey = (id, size = "full") => `${size === "thumb" ? "recipethumb" : "recipephoto"}_${id}`;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("MOE can't read that file. Try a JPG or PNG photo.")); };
    img.src = url;
  });
}

function toJpeg(img, max, quality) {
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const g = canvas.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

// Phone photo → { full, thumb } data URLs.
export async function preparePhoto(file) {
  const img = await loadImage(file);
  return { full: toJpeg(img, 1000, 0.74), thumb: toJpeg(img, 160, 0.7) };
}

const cache = {}; // `${group}|${size}|${id}|${photoAt}` → data URL or null

export async function savePhoto(group, id, photo, photoAt) {
  const a = await sbSet(group, photoKey(id, "full"), photo ? photo.full : null);
  if (!a.ok) return a;
  const b = await sbSet(group, photoKey(id, "thumb"), photo ? photo.thumb : null);
  if (!b.ok) return b;
  if (photo && photoAt) {
    cache[`${group}|full|${id}|${photoAt}`] = photo.full;
    cache[`${group}|thumb|${id}|${photoAt}`] = photo.thumb;
  }
  return { ok: true };
}

// { [recipeId]: dataUrl | null } for recipes that have a photo.
export function usePhotos(group, recipes, size = "thumb") {
  const sig = (recipes || []).filter((r) => r && r.photoAt).map((r) => `${r.id}::${r.photoAt}`).join("\n");
  const [, bump] = useState(0);

  useEffect(() => {
    if (!group || !sig) return undefined;
    const wanted = sig.split("\n").map((s) => { const [id, at] = s.split("::"); return { id, key: `${group}|${size}|${id}|${at}` }; });
    const missing = wanted.filter((w) => !(w.key in cache));
    if (!missing.length) return undefined;
    let alive = true;
    sbGetMany(group, missing.map((w) => photoKey(w.id, size))).then((res) => {
      if (!res.ok) return;
      missing.forEach((w) => {
        const v = res.values[photoKey(w.id, size)];
        cache[w.key] = typeof v === "string" && v.startsWith("data:image/") ? v : null;
      });
      if (alive) bump((x) => x + 1);
    });
    return () => { alive = false; };
  }, [group, sig, size]);

  const out = {};
  (recipes || []).forEach((r) => {
    if (r && r.photoAt) out[r.id] = cache[`${group}|${size}|${r.id}|${r.photoAt}`] || null;
  });
  return out;
}
