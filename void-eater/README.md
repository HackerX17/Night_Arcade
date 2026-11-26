# Void Eater

You're a hungry little void in a neon city. Anything smaller than you falls in. Grow until you can swallow the city.

- **Drag** anywhere to move (the further you drag, the faster you go). On a keyboard: arrows or WASD.
- Things fall in when they're smaller than your void: start with cones, hydrants and people; grow into cars and taxis, then trucks and buses, shops, whole buildings, and finally the spire in the central plaza. Too-big things just rock over the edge.
- **Battle**: two minutes against three rival voids (NOVA, ECLIPSE, ABYSS). The void that has eaten the most when time's up wins. A void 15% bigger than another can swallow it; the swallowed void comes back small a few seconds later.
- **Solo**: just you and the city. How much of it can you eat in two minutes?
- Power-ups on the streets: **Magnet** pulls nearby things in, **Boost** speeds you up, **Mega** makes your void bigger for a while (so you can bite things early).
- Your best scores (Battle and Solo) and your Battle wins stay on your device.

The note button (and Music & sound on the pause screen) picks the music: the game's own electro house soundtrack, your own songs or music app, or none, with a separate switch for sound effects.

## Graphics

Void Eater draws the city in real 3D with [three.js](https://threejs.org) (r160, vendored in `vendor/`, MIT): instanced towers with lit windows and neon rooftop edges, traffic, people, trees, street lamps and the spire on neon streets. Every void is a real hole cut in the ground with a glowing pit and a slow swirl, and whatever it swallows tumbles down into it (`js/world3d.js`). The camera pulls back as you grow. Without WebGL the game falls back to its 2D drawing.

Open it from a web server (it loads JavaScript modules), or play it on the Night Arcade site.
