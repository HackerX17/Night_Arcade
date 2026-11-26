# Pulse Runner

Ride the beat down an endless neon highway: dodge, jump, slide, and never stop.

- **Swipe** left or right to change lanes, **up** to jump (a quick tap jumps too), **down** to slide (or drop fast out of a jump). On a keyboard: arrows or WASD, Space to jump.
- **Low barriers**: jump them. **Gates**: slide under them. **Walls**: change lanes. **Trains**: change lanes, or run up a **ramp** (or time a jump) onto the roof and ride along the top. You can't swerve into the side of a train you're below.
- The highway gets faster the further you go.
- Grab **orbs** for score. Power-ups on the road: **Magnet** pulls orbs in, **Shield** takes one hit, **×2** doubles your orbs, **Jetpack** flies you over everything along a trail of orbs in the sky.
- **Missions**: three goals at a time on the main menu (run 600 m, collect 80 orbs, ride 150 m on train roofs, jump, slide, score, grab power-ups). Finishing one pays orbs into your bank and deals the next mission, a tier harder. Train-roof and power-up missions add up across runs.
- Orbs you collect go into your bank: spend them on the main menu to make each power-up last longer (five levels each). Your best score and your orbs stay on your device.

The note button (and Music & sound on the pause screen) picks the music: the game's own outrun soundtrack, your own songs or music app, or none, with a separate switch for sound effects.

## Graphics

Pulse Runner draws in real 3D with [three.js](https://threejs.org) (r160, vendored in `vendor/`, MIT): a lit neon city that keeps coming, a synthwave sun, light pylons, subway trains with lit windows and headlights, laser gates, hazard hurdles, chevron ramps, spinning gems, bloom and neon reflections (`js/world3d.js`). The runner is **RobotExpressive** by Tomás Laulhé ([Quaternius](https://www.patreon.com/quaternius)), CC0 1.0, from the three.js examples, recoloured for the arcade, with its own Running, Jump and Death animations (`models/`). If a device has no WebGL, the game falls back to its 2D drawing.

Open it from a web server (it loads JavaScript modules), or play it on the Night Arcade site.
