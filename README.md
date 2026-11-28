# Night Arcade

Fourteen original neon browser games. They run on phones and computers with nothing to install.

**Play:** https://hackerx17.github.io/Night_Arcade/

**Watch:** the 45-second commercial is on the home page ([`media/night-arcade-commercial.mp4`](media/night-arcade-commercial.mp4), with captions).

| Game | What it is | Folder |
| --- | --- | --- |
| Redline Nights | Street racer in 3D: free-roam a neon city at night, win sprints, circuits, drift battles and speed traps, run from the police (heat, roadblocks, spike strips, a helicopter) and beat the Redline Ten for their cars. Tilt, touch, keyboard or gamepad. | [`redline-nights/`](redline-nights/) |
| Night Reef | Eat-and-grow fish game on a reef that glows like paint under a black light: eat anything smaller, avoid anything bigger, dash in before the puffers puff up, and grow through six sizes to become the apex of each of 14 dives (one per colour scheme). Jellies, eels, a lurejaw, rays and the Gloomjaw shark; power-up pearls, Feast streaks, unlockable fish. In 3D every creature is modelled and the reef rolls away into the dark. | [`night-reef/`](night-reef/) |
| Prism Breaker | Block breaker: aim and fire a stream of light at numbered blocks before they cross the line. Lasers, prisms, bombs, and ball colours to unlock. | [`prism-breaker/`](prism-breaker/) |
| Void Eater | City swallower in 3D: a tiny void that grows by swallowing everything smaller, from cones to whole buildings. Two-minute battles against three rival voids, or solo. | [`void-eater/`](void-eater/) |
| Nova Strike | Vertical space shooter: waves of invaders, five gun levels, lasers and homing missiles, and three bosses with three phases each. | [`nova-strike/`](nova-strike/) |
| Glowline | Neon snake arena: steer toward your pointer, eat glowing light to grow, boost to cut off the 22 rival snakes, and burst anyone whose head hits you. Sixteen skins, leaderboard, minimap. | [`glowline/`](glowline/) |
| Grid Viper | Classic snake on a neon grid: eat the dot, grow, never bite your own tail. Classic, No walls and Maze modes, three speeds, golden stars, skins to unlock. Swipe, keys, D-pad or controller. | [`grid-viper/`](grid-viper/) |
| Pulse Runner | Endless runner in 3D: an animated robot dodges, jumps and slides down a neon highway, ride on the trains, fly the jetpack, complete missions for orbs, and spend them on longer power-ups. | [`pulse-runner/`](pulse-runner/) |
| Sandblade | Hill rider: dive down neon hills, ramp from island to island (each with its own colour scheme), and outrun the storm. 11 power-ups. | [`sandblade/`](sandblade/) |
| Skyline Leap | Wall climber: leap between two towers, dodge window hazards and smash drones mid-air. 7 power-ups, and a Christmas version. | [`skyline-leap/`](skyline-leap/) |
| Sandblade Legion | Crowd runner: steer your army down a neon road through multiplier gates, blast through walls to the big bonus, and charge the horde. Every fight is one for one, so only the bigger army wins. Each level has its own colour scheme. | [`sandblade-legion/`](sandblade-legion/) |
| Sandblade Siege | Army flood in 3D: a huge horde pours in through portals and charges your gate, with giants on some levels; aim a cannon of riders through multiplier gates and mow it down one for one. Each level wears one of Sandblade's neon colour schemes; a level select shows your stars. | [`sandblade-siege/`](sandblade-siege/) |
| Chopper Cave | Hold-to-climb cave flyer through a neon tunnel that changes colour every 250 m. Shield, Wide Cave and Slow-Mo power-ups, and portals to Hyperspace, a synthwave bonus world. In 3D, a lightning storm rolls through the cavern behind the tunnel, arcs crackle between the crystals, every new colour zone opens with a thunder strike, and the neon pulses with the beat. | [`chopper-cave/`](chopper-cave/) |
| Iron Sector | First-person wave-survival shooter with an armory, attachments and air support. Neon night city by default; Settings → Style → Classic brings back the original look. | [`iron-sector/`](iron-sector/) |

## Original and 3D

Every game comes in two looks: the **Original** and a **3D** version. The games play exactly the same in both; only the graphics change. Switch between them on any game's title screen or pause menu (the **Original | 3D** switch next to Music & sound), or set every game at once with the switch on the home page. Each game remembers its own choice, and a link can pick one with `?gfx=3d` or `?gfx=orig`. Switching reloads the game into its menu.

- The 3D versions use real-time WebGL 2 graphics: real geometry and lighting, reflections in wet streets, glass and water, bloom and a film grade, built on the shared kit in [`shared/na3d/`](shared/na3d/) (three.js r160).
- Phones get a lighter 3D setting, and if a game's frame rate drops it turns off the costliest effects (reflections first) on its own.
- If a device can't run WebGL 2, the game says so and plays the Original instead.
- The 3D camera is fitted to each game's own layout, so the HUD, the numbers and the pop-ups are where they are in the Original.

## Music & sound

Every game, and the home page, has a **Music & sound** button. Pick the music you want:

- **Game music**: each game's own soundtrack, synthesised live in the browser (no audio files): house in Sandblade Legion, deep house in Sandblade, electro house in Skyline Leap (Christmas house in its Christmas version), Void Eater and Grid Viper, battle techno in Sandblade Siege, techno in Chopper Cave (electro in Hyperspace) and Glowline, outrun in Redline Nights (battle techno in pursuits) and Pulse Runner, chill house in Prism Breaker, trance in Nova Strike, deep dub in Night Reef, and Iron Sector's own score. It starts when you start playing, pauses with the game, and has its own volume.
- **My music**: your own songs or your music app (below).
- **Off**: no music.

**Sound effects** has its own on/off switch, so you can have music without effects or effects without music. The choices are shared by every game. Each game's mute button still silences that game, music included. The soundtrack engine lives in the same shared file as the player (`shared/arcade-music.html`).

In **My music**, buttons at the top that open your music app (on iPhone: Apple Music, Spotify or YouTube Music; on Android: YouTube Music, Spotify or Apple Music): start a song there and come back, and it keeps playing under the game. A web page can't reach the phone's music library itself, and streaming songs are copy-protected, so this is the way to use them. Below that you can add music files from your phone or computer; they play while you game and carry on when you switch to another game. The files stay in your own browser (IndexedDB) and are never uploaded. The player lives in `shared/arcade-music.html`; after editing it, run `python3 tools/sync-music.py` to copy it into every page, so each game stays one self-contained page.

## Controllers

Plug in or pair a game controller and every game plays with it, menus included: the stick or D-pad moves, **A** presses the highlighted button (or jumps, dives, fires), **B** backs out, **Start** pauses, **Y** opens Music & sound. In Glowline the stick points where your snake goes and A, B or a trigger boosts. Redline Nights and Iron Sector use their own controller layouts (see their READMEs). Crashes rumble the controller where the browser supports it.

## Running locally

From this folder, run `python3 -m http.server 8000` and open http://localhost:8000/. The 3D versions load JavaScript modules, so they need the local server, as do Iron Sector, Redline Nights, Pulse Runner and Void Eater in either look. The Originals of the other games also work when opened directly as a file.

## Design

[`DESIGN.md`](DESIGN.md) is the house style every game shares: colours, type, components, layout, motion, sound and the game shell (menu, play, pause, results). The vetted **web-design-guidelines** skill in `.claude/skills/` reviews a page against Vercel's Web Interface Guidelines before it ships.

## Hosting

GitHub Pages serves the `main` branch from the repository root. The empty `.nojekyll` file tells Pages to publish the files as they are, without running them through Jekyll.

Best scores and settings are saved in each player's own browser.

## Credits

- [three.js](https://threejs.org/) r160 (MIT licence, `shared/na3d/LICENSE-three.txt`) renders the 3D versions and the 3D games.
- Textures (asphalt, brick, concrete, metal, rock and shutters) are from [Poly Haven](https://polyhaven.com/) under CC0.
- "CarConcept" by Eric Chadwick, Darmstadt Graphics Group, from the Khronos glTF Sample Assets, under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), simplified and recompressed for the web; it is the base of the 3D cars in Redline Nights' 3D version. The Khronos and glTF logos are not used.
- "RobotExpressive" by Tomas Laulhe (Quaternius), modifications by Don McCurdy, under CC0, from the three.js examples: the runner in Pulse Runner.
- The commercial: every shot is footage captured from the games. The narration is an original voice made with Qwen3-TTS (Apache 2.0), and the score is an original track generated with ACE-Step 1.5 (MIT), cut to picture with synthesized sound design.
- Everything else (games, characters, cars, levels, art, music and sound) is original to Night Arcade.
