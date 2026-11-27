// Load a glTF that carries its data inside the file (data: addresses) without the browser ever fetching those addresses.
// Strict pages (an embedded artifact, for one) refuse data: and blob: requests, and the model would silently fail to load.
// Here the file is fetched normally, its buffers are decoded and packed into an in-memory GLB, and its images are decoded
// straight from memory with createImageBitmap, so nothing but the file itself goes over the network.
// Files whose data lives in separate files load the usual way.
import { Texture, NearestFilter, LinearFilter, NearestMipmapNearestFilter, LinearMipmapNearestFilter, NearestMipmapLinearFilter, LinearMipmapLinearFilter,
  ClampToEdgeWrapping, MirroredRepeatWrapping, RepeatWrapping } from 'three';

const FILTERS = { 9728: NearestFilter, 9729: LinearFilter, 9984: NearestMipmapNearestFilter, 9985: LinearMipmapNearestFilter, 9986: NearestMipmapLinearFilter, 9987: LinearMipmapLinearFilter };
const WRAPS = { 33071: ClampToEdgeWrapping, 33648: MirroredRepeatWrapping, 10497: RepeatWrapping };
const isData = (u) => typeof u === 'string' && u.startsWith('data:');
const bytesOf = (uri) => { const comma = uri.indexOf(','), head = uri.slice(0, comma), body = uri.slice(comma + 1);
  if (!/;base64$/.test(head)) return new TextEncoder().encode(decodeURIComponent(body));
  const bin = atob(body), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };

// textures whose image sits in the binary chunk: decoded in memory, with the glTF sampler's filtering and wrapping
class InMemoryImages {
  constructor(parser) { this.parser = parser; this.name = 'NA_in_memory_images'; this.cache = new Map(); }
  loadTexture(index) {
    const parser = this.parser, json = parser.json, td = json.textures && json.textures[index], img = td && json.images && json.images[td.source];
    if (!img || img.bufferView === undefined || typeof createImageBitmap === 'undefined') return null;
    const key = td.source + ':' + td.sampler;
    if (!this.cache.has(key)) this.cache.set(key, parser.getDependency('bufferView', img.bufferView)
      .then((buf) => createImageBitmap(new Blob([buf], { type: img.mimeType || 'image/png' }), { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }))
      .then((bmp) => { const t = new Texture(bmp), s = (json.samplers || [])[td.sampler] || {};
        t.flipY = false; t.name = img.name || ''; t.magFilter = FILTERS[s.magFilter] || LinearFilter; t.minFilter = FILTERS[s.minFilter] || LinearMipmapLinearFilter;
        t.wrapS = WRAPS[s.wrapS] || RepeatWrapping; t.wrapT = WRAPS[s.wrapT] || RepeatWrapping; t.needsUpdate = true;
        if (parser.associations && parser.associations.set) parser.associations.set(t, { textures: index });
        return t; }));
    return this.cache.get(key);
  }
}

export async function loadPackedGLTF(url, GLTFLoader) {
  const abs = new URL(url, location.href).href, res = await fetch(abs);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const json = await res.json();
  if (!(json.buffers || []).length || !json.buffers.every((b) => isData(b.uri))) return new GLTFLoader().loadAsync(abs);
  const parts = []; let off = 0;
  const push = (u8) => { const at = off; parts.push(u8); off += u8.length; const pad = (4 - (off % 4)) % 4; if (pad) { parts.push(new Uint8Array(pad)); off += pad; } return at; };
  const base = json.buffers.map((b) => push(bytesOf(b.uri)));
  for (const v of json.bufferViews || []) { v.byteOffset = (v.byteOffset || 0) + base[v.buffer]; v.buffer = 0; }
  for (const im of json.images || []) {
    if (!isData(im.uri)) continue;
    const mime = /^data:([^;,]+)/.exec(im.uri); (json.bufferViews = json.bufferViews || []).push({ buffer: 0, byteOffset: 0, byteLength: 0 });
    const v = json.bufferViews[json.bufferViews.length - 1], u8 = bytesOf(im.uri); v.byteOffset = push(u8); v.byteLength = u8.length;
    im.bufferView = json.bufferViews.length - 1; im.mimeType = mime ? mime[1] : 'image/png'; delete im.uri;
  }
  json.buffers = [{ byteLength: off }];
  // WebP textures decode through the same in-memory path (every current browser decodes WebP)
  for (const t of json.textures || []) { const w = t.extensions && t.extensions.EXT_texture_webp; if (w) { t.source = w.source; delete t.extensions.EXT_texture_webp; } }
  const drop = (a) => a && a.filter((e) => e !== 'EXT_texture_webp'); json.extensionsUsed = drop(json.extensionsUsed); json.extensionsRequired = drop(json.extensionsRequired);
  // GLB: header, JSON chunk (space-padded), BIN chunk
  const jb = new TextEncoder().encode(JSON.stringify(json)), jp = (4 - (jb.length % 4)) % 4, total = 12 + 8 + jb.length + jp + 8 + off;
  const glb = new ArrayBuffer(total), dv = new DataView(glb), u8 = new Uint8Array(glb);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jb.length + jp, true); dv.setUint32(16, 0x4e4f534a, true); u8.set(jb, 20); u8.fill(0x20, 20 + jb.length, 20 + jb.length + jp);
  let o = 20 + jb.length + jp; dv.setUint32(o, off, true); dv.setUint32(o + 4, 0x004e4942, true); o += 8;
  for (const p of parts) { u8.set(p, o); o += p.length; }
  const loader = new GLTFLoader(); loader.register((parser) => new InMemoryImages(parser));
  return loader.parseAsync(glb, new URL('.', abs).href);
}
