// Night Arcade graphics switch: every game can run as the Original or in 3D.
// Load early with <script src="../shared/gfx.js" data-game="<id>"></script>. The choice is kept per game;
// ?gfx=3d or ?gfx=orig in the address picks one, and the hub can set every game at once.
(function () {
  var me = document.currentScript, id = (me && me.getAttribute('data-game')) || 'game', KEY = 'na.gfx.' + id, mode = 'orig';
  try {
    var q = new URLSearchParams(location.search).get('gfx');
    if (q === '3d' || q === 'orig') { mode = q; localStorage.setItem(KEY, q); }
    else mode = localStorage.getItem(KEY) || localStorage.getItem('na.gfx') || 'orig';
  } catch (e) {}
  if (mode !== '3d') mode = 'orig';
  document.documentElement.setAttribute('data-gfx', mode);
  var CSS = '.gfx-switch{display:inline-flex;align-items:center;gap:10px;font:800 12px/1 Jost,"Avenir Next","Segoe UI",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#cfc7ef;pointer-events:auto}' +
    '.gfx-switch .gfx-pill{display:inline-flex;padding:3px;border-radius:999px;background:rgba(6,2,26,.85);border:1px solid rgba(255,255,255,.18)}' +
    '.gfx-switch button{appearance:none;-webkit-appearance:none;border:0;background:transparent;color:#b3aad8;font:inherit;letter-spacing:.12em;padding:9px 14px;border-radius:999px;cursor:pointer;min-height:38px;min-width:48px;touch-action:manipulation}' +
    '.gfx-switch button[aria-pressed="true"]{background:linear-gradient(90deg,#ff2bd6,#8a2bff 55%,#00e5ff);color:#fff}' +
    '.gfx-switch button[data-gfx="orig"][aria-pressed="true"]{background:#f3f0ff;color:#1a1030}' +
    '.gfx-switch button:focus-visible{outline:2px solid #00e5ff;outline-offset:2px}' +
    '.gfx-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px 12px;max-width:100%}' +
    '.gfx-switch.gfx-compact .gfx-pill{padding:2px}.gfx-switch.gfx-compact button{min-height:34px;padding:7px 12px}' +
    '@media (max-width:540px){.gfx-row{gap:8px 8px}.gfx-switch.gfx-compact .gfx-label{display:none}.gfx-switch.gfx-compact button{padding:7px 8px;min-width:40px;font-size:11px;letter-spacing:.06em}}' +
    '.gfx-note{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:99999;padding:10px 16px;border-radius:999px;background:rgba(6,2,26,.9);border:1px solid rgba(255,255,255,.18);color:#f3f0ff;font:700 13px/1.2 Jost,system-ui,sans-serif;letter-spacing:.06em;pointer-events:none}';
  function css() { if (document.getElementById('gfx-css')) return; var s = document.createElement('style'); s.id = 'gfx-css'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s); }
  var stop = function (e) { e.stopPropagation(); };
  var api = {
    id: id, mode: mode, is3D: mode === '3d',
    // switching reloads the game into the other renderer (back to its menu)
    set: function (m) {
      if (m !== '3d') m = 'orig';
      if (m === api.mode) return;
      try { localStorage.setItem(KEY, m); } catch (e) {}
      try { var u = new URL(location.href); if (u.searchParams.has('gfx')) { u.searchParams.delete('gfx'); location.replace(u.href); return; } } catch (e) {}
      location.reload();
    },
    mount: function (where, opts) {
      css(); opts = opts || {};
      var host = typeof where === 'string' ? document.querySelector(where) : where; if (!host) return null;
      var w = document.createElement('div'); w.className = 'gfx-switch' + (opts.className ? ' ' + opts.className : '');
      var label = opts.label === undefined ? 'Graphics' : opts.label;
      w.innerHTML = (label ? '<span class="gfx-label">' + label + '</span>' : '') + '<span class="gfx-pill" role="group" aria-label="Graphics"><button type="button" data-gfx="orig">Original</button><button type="button" data-gfx="3d">3D</button></span>';
      ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'keydown'].forEach(function (t) { w.addEventListener(t, stop); });
      Array.prototype.forEach.call(w.querySelectorAll('button'), function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-gfx') === api.mode));
        b.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); api.set(b.getAttribute('data-gfx')); });
      });
      host.appendChild(w); return w;
    },
    // the switch on the same row as the menu's Music & sound button, so it adds no height to the menu (phones on their side
    // have no room for another row); on narrow screens the row drops the "Graphics" caption so both fit side by side
    mountRow: function (where, opts) {
      var host = typeof where === 'string' ? document.querySelector(where) : where; if (!host) return null;
      var w = api.mount(host, opts); if (!w) return null;
      var mus = host.querySelector('.cta[data-am-open], button.music[data-am-open]') || host.querySelector('button[data-am-open]');
      if (!mus) return w;
      var row = document.createElement('div'); row.className = 'gfx-row';
      mus.parentNode.insertBefore(row, mus); row.appendChild(mus); row.appendChild(w); w.classList.add('gfx-compact');
      return w;
    },
    // a short message at the bottom of the screen (used when 3D can't start and the game falls back)
    note: function (text, ms) { css(); var n = document.createElement('div'); n.className = 'gfx-note'; n.textContent = text; document.body.appendChild(n); setTimeout(function () { n.remove(); }, ms || 4000); },
    // the game calls this when its 3D renderer can't run here; it plays the Original instead
    fallback: function (why) { api.is3D = false; api.failed = why || true; document.documentElement.setAttribute('data-gfx', 'orig'); api.note('3D isn’t available on this device, so this is the Original.'); },
  };
  window.NAGFX = api;
})();
