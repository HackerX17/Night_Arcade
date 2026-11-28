# Night Arcade design system

The house style every game and the hub share: a neon city at night. Use this when you add a game, a menu or a page, and keep each new thing looking like it belongs to the same arcade.

## Principles

1. **Night first.** Deep violet-black backgrounds, light only where it means something: the player, the danger, the next thing to do.
2. **One bright idea per screen.** A title, a score, a big number or a call to action glows; everything around it stays quiet.
3. **Readable over pretty.** Text sits on dark backing (a pill, a panel or a gradient), never straight on a busy scene.
4. **Phones first, then everything.** Every screen is checked in portrait (390 × 844), landscape (844 × 390) and desktop (1280 × 720). No horizontal scrolling, no control under a notch.
5. **Original only.** Names, cars, characters, brands and music are our own. Genres and mechanics are fair game; another game's name, art or look is not.

## Colour

| Token | Value | Use |
|---|---|---|
| `--bg` | `#05002a` | Page and canvas background |
| `--cream` | `#f3f0ff` | Body text |
| `--accent` | `#00e5ff` | Cyan: the player, focus rings, primary highlights |
| `--glow` | `#ff2bd6` | Magenta: titles' second glow, links, energy |
| violet | `#8a2bff` | The middle of the call-to-action gradient |
| `--gold` | `#ffd23f` | Rewards: stars, coins, bounty, NEW BEST |
| `--ember` | `#ff2e4d` | Danger, losses, police red |
| lime | `#b6ff00` | Go, gains, drift, positive power-ups |

Levels and stages cycle through a shared set of fourteen night palettes (Neon Bay, Lime District, Magenta Heights, Sunset Strip, Golden Mile, Crimson Ridge, Cyan Grid, Coral Coast, Ultraviolet, Acid Pier, Frost Palace, Ember Fields, Jade Temple, Midnight Orchid). Each palette has an accent `a`, a second accent `b`, three sky stops and two city tones; see `THEMES` in `chopper-cave/index.html` or `sandblade/index.html`.

Neon on canvas: draw the glow as a wide, low-alpha stroke under a thin bright one (about 3× width at 25–35% alpha). Use `globalCompositeOperation = "lighter"` for particles and light. Avoid `shadowBlur` inside per-object loops (it's slow on phones). In three.js, give emissive things colours above 1.0 so the bloom pass catches them.

## Type

- **Display**: Audiowide (`--display`), for titles, big numbers, banners. Letter-spaced a little (`.04–.06em`).
- **Body and UI**: Jost 400–800 (`--body`). Buttons are 800 weight, uppercase, `.12em` spacing.
- **Labels**: small caps style, 11–13 px, uppercase, `.14–.16em` spacing.
- **Numbers**: `font-variant-numeric: tabular-nums` anywhere a number changes; thousands separators with `toLocaleString()`.
- Fonts load from Google Fonts with system fallbacks (`"Arial Black"`, `"Avenir Next"`, `"Segoe UI"`, `system-ui`), so a blocked font still looks intentional.

## Components

- **Call to action**: a pill with the magenta → violet → cyan gradient and a soft magenta/cyan glow. One per screen.
- **Ghost button**: the same pill, dark translucent fill with a 2 px light inset border. Secondary actions.
- **Icon buttons**: 40–42 px circles, top right in this order: music (opens Music & sound), pause, mute. Always `aria-label`; pressed state turns soft red.
- **Overlays**: full-screen, centred column, radial dark gradient. Result and pause overlays are more opaque (about 0.9) so text never fights the scene behind.
- **HUD**: top left for score and status, top right for the icon row. Chips and readouts sit on dark pills (`rgba(6,2,26,.6–.8)` with a 1 px border). Timers and big numbers in Audiowide.
- **Toasts**: short uppercase messages on a dark pill, colour-coded (gold reward, red danger, cyan info, lime gain); they slide in and fade out in about 3 s.
- **Banners**: big Audiowide words that scale in from 1.5× ("WAVE 5", "GO!", "BUSTED"), gone in about 1.5 s.
- **Stats grids**: two columns, label left, value right in the accent colour.

## Layout

- Respect `env(safe-area-inset-*)` on every edge; the viewport meta uses `viewport-fit=cover`.
- Fixed play fields letterbox to fit (Prism Breaker 7 columns, Nova Strike 360 × 640, Chopper Cave 560 × 360) and use the spare space on wide screens like an arcade cabinet: the game's world (space, the neon floor) carries on to the screen edges, the field sits in a glowing frame, and big-type readouts (wave, score, lives…) go beside it when there's room (Nova Strike).
- Short screens (`max-height: 500–560px`, phones on their side) get a smaller logo and tighter gaps so nothing overlaps.
- Touch targets are at least 40 px; game buttons (gas, brake, bomb) 64–92 px.

## Motion and feel

- Impacts: brief screen shake that decays in under a second, a white flash for big moments, particle bursts in the thing's own colour.
- Pickups and wins: a rising chime; losses: a short falling phrase. Sound effects are rate-limited so streams of hits don't stack.
- Animations are tied to game time, not frame count, so 120 Hz screens run at the same speed.
- **Reduced motion**: the shared shell sets `window.ARCADE_CALM` from `prefers-reduced-motion`; every game multiplies its screen shake and white flashes by `(window.ARCADE_CALM ? 0.15 : 1)`. CSS motion (hover lifts, the hub's neon flicker) turns off under the same media query.
- **Haptics**: crashes and game overs call `navigator.vibrate` (phones), and the shared shell turns the same calls into controller rumble.
- **Your record in the world**: games measured in distance or height draw your best as a dashed gold line or gate in the level itself (Skyline Leap's towers, Chopper Cave's cave) with the number on it; passing it fires a "New record" moment and the line turns green or slips behind you.

## Sound

Every page includes the shared player (`shared/arcade-music.html`, copied in by `tools/sync-music.py`). Each game picks a soundtrack with `ArcadeSound.style(name)`, starts it from the tap that starts play, and pauses it with the game:

| Game | Style |
|---|---|
| Sandblade | deep |
| Skyline Leap | electro (Christmas house in the Christmas version) |
| Sandblade Legion | house |
| Sandblade Siege | battle |
| Iron Sector | its own score (Music & sound still switches it off or to your music) |
| Chopper Cave | techno (electro in Hyperspace) |
| Prism Breaker | chill |
| Redline Nights | outrun (battle in pursuits) |
| Void Eater | electro |
| Nova Strike | trance |
| Glowline | techno |
| Grid Viper | electro |
| Pulse Runner | outrun |
| Night Reef | reef (deep dub) |

Sound effects check `ArcadeSound.sfx` and the game's own mute. Visuals can move in time with the soundtrack: `ArcadeSound.beat` is where the music is in its beat (0 on the kick, rising toward 1), or -1 when the game's music isn't playing, so fall back to a gentle free-running pulse (Chopper Cave's 3D edges, crystals and sky grid pulse on the kick). Opening Music & sound (`arcademusicpanel`) or leaving the tab (`visibilitychange`) pauses the game.

## Controllers

Every page includes the **Arcade Pad** layer (in `shared/arcade-music.html`, so it syncs with the music player). It turns a standard gamepad into the keys each game already handles: stick or D-pad = arrow keys, A = Space, B = B, X = Shift, Start = Escape (pause), Y = Music & sound. Wherever buttons are on screen (menus, pause, results, level select, the hub) the D-pad moves a cyan highlight between them and A presses it, so the whole arcade works from the couch.

A game tunes it with `window.ArcadePad = { … }` after the shared block: `a`, `b`, `x`, `lt`, `rt` remap buttons to key codes; `repeat: [codes]` repeats held keys (Prism Breaker's aim); `pads: [null, { ArrowLeft: "KeyA", … }]` gives a second controller to player 2; `menuOnly: true` keeps the pad to menus for a game that reads the controller itself (Redline Nights' driving, Glowline's point-the-stick steering), and `menu: "selector"` swaps in its own list of pickable buttons (Glowline adds its skins); `off: true` for a game with full controller support of its own (Iron Sector). Anything a player can pick needs `.cta`, `.seg`, `.mode`, `.shopbtn`, `a.play`, `button.music` or a `data-pad` attribute.

## The game shell

Every game has the same skeleton, so players never hunt for a button:

1. **Menu**: logo, one call to action, best score, a short "how to play", Music & sound.
2. **Play**: HUD, the icon row, Escape or P to pause.
3. **Pause**: Resume, Restart (or New game), Main menu, Music & sound. Results screens also offer Main menu.
   Runners can add **missions** (Pulse Runner): three goals at a time on the menu with progress bars, paid in the game's currency, the next one dealt a tier harder; results sum up what was completed next to the score and keep the primary button in view.
   Level-based games add a **Levels** screen from the menu: a grid of every level reached, coloured by its palette, showing stars or best result; locked levels dimmed; Back, Escape or B to return.
4. **Results**: the outcome in one big word or number, a stats grid, NEW BEST when earned, Play again, Main menu.
5. **Storage**: `localStorage` under a game prefix (`prism-`, `void-`, `nova-`, `glow-`, `pulse-`, `redline-`…), every read and write wrapped in `try/catch` so a blocked store never breaks the game.
6. **Testing**: add `#debug` to the address for a test hook (`window.__XX`) with `sim()` and `draw()`; Playwright bots in the audit scripts play whole games, check the numbers and take screenshots.

## 3D versions

Every game has an Original and a 3D version that play identically. Keep the Original untouched when you work on the 3D version, and the other way round.

- **The switch**: `shared/gfx.js`, loaded first in each page with `data-game="<id>"`. It reads `?gfx=3d|orig`, then the game's own choice (`na.gfx.<id>`), then the hub's choice for every game (`na.gfx`), defaulting to the Original. `NAGFX.mountRow(menu)` puts the **Original | 3D** switch on the same row as the menu's Music & sound button, so menus keep their height on phones (check 844 × 390 and 390 × 844); `NAGFX.mount(el)` adds it anywhere else. Switching reloads the page into its menu. If WebGL 2 is missing, call `NAGFX.fallback(why)`: the player sees a short note and gets the Original.
- **The kit**: `shared/na3d/kit.js` (three.js r160 through an import map, plus the addons in `shared/na3d/addons/`). It provides the night-city environment light, Poly Haven textures (`pbr`, `tex`), a real planar reflection any material can sample (`mirror`, `WET_GLSL`, `wetStandard`), rain, neon signs, light beams, glow sprites, soft puffs, contact shadows, and the post chain (bloom, tone mapping, then the grade: vignette, violet shadows, grain, flash, speed blur).
- **A 2D game's 3D version** lives in `<game>/js/hd.js`, loaded with a dynamic `import()` only in 3D mode. The game exposes a read-only bridge (`window.XXS`, getters only) and its draw function hands the frame to `XX3D.render()`. The 3D canvas sits under the game's canvas, which keeps the HUD, numbers, pop-ups and screen effects. Fit the 3D camera to the 2D layout (the same mapping or the same projection) so everything on the 2D layer lands on its 3D object.
- **Materials**: neon is emissive with colours above 1.0 so bloom catches it; keep large surfaces below the bloom threshold so they don't wash out. Use sine-free hashes for procedural noise on big world coordinates. A material without normals that is lit renders black (NaN): give every lit mesh normals.
- **Performance**: desktops get the high tier, touch devices the medium one (smaller reflections, lower pixel ratio). Keep the number of lights fixed (switch a light off with intensity 0, never by hiding it, or every material recompiles). When frames stay slow, drop the reflections and the pixel ratio.
- **Testing**: capture the menu and gameplay in both looks at the three viewports, and play with the console open: no errors, no NaN-black pixels, numbers on the right objects.

## Copy

- Plain words, sentence case for sentences, uppercase only for short labels and banners.
- Say what to do ("Drag to aim, let go to fire"), not how the code works.
- Numbers the player sees match the numbers the game uses: what the HUD shows is what the results screen counts.

## Reviewing UI

- The vetted **web-design-guidelines** skill lives in `.claude/skills/` (Vercel's Web Interface Guidelines, pinned and hash-checked, no hooks, no network). Run it on a page before shipping: accessibility, focus states, forms, motion, layout, copy.
- Check every new screen against this file in the three viewports above.
- Run the **anti-slop-web-design** review too: one focal point per screen, real product shots (the hub's covers are captured from the games), quiet hover/press motion, 44 px targets, reduced motion respected.
- Hub covers live in `shared/covers/` (640 × 360 WebP, about 10–40 KB each) plus `share.jpg` (1200 × 630) for link previews. Re-capture them when a game's look changes.
