# Glowline

Four riders, glowing trails, one arena. Don't touch the light.

- Your rider never stops. **Hold left or right** to curve: touch the left or right half of the screen, or use the arrow keys.
- Every rider leaves a glowing trail. Hit any trail (your own too) or the wall and you're out. Each time someone goes out, everyone still riding scores a point.
- Trails break for a moment every couple of seconds; slip through the gaps.
- First to **10 points**, at least two clear, wins the match.
- Orbs: **green** ones help you (Speed, Slow, Thin trail, Phase through trails), **red** ones hit everyone else (Fast, Fat trails, Square turns, Reversed controls), **blue** ones change the arena (Wrap the walls, Clear every trail).
- Three AI rivals at Easy, Normal or Hard. On a keyboard, **2 players** can share it: P1 on the arrow keys, P2 on A and D, with two AI riders.
- Matches you've won stay on your device.

The note button (and Music & sound on the pause screen) picks the music: the game's own techno soundtrack, your own songs or music app, or none, with a separate switch for sound effects.

## Graphics

Glowline draws the arena in real 3D with [three.js](https://threejs.org) (r160, vendored in `vendor/`, MIT): every trail rises as a glowing light wall behind its rider, riders are neon light-cycles, orbs float and pulse, crashes ring out across the floor, and the whole arena sits on a neon grid that runs to the horizon (`js/world3d.js`). Without WebGL the game falls back to its 2D drawing.

Open it from a web server (it loads JavaScript modules), or play it on the Night Arcade site.
