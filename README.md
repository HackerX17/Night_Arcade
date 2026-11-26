# Night Arcade

Twelve original neon browser games. They run on phones and computers with nothing to install.

**Play:** https://hackerx17.github.io/Night_Arcade/

| Game | What it is | Folder |
| --- | --- | --- |
| Redline Nights | Street racer in 3D: free-roam a neon city at night, win sprints, circuits, drift battles and speed traps, run from the police (heat, roadblocks, spike strips, a helicopter) and beat the Redline Ten for their cars. Tilt, touch, keyboard or gamepad. | [`redline-nights/`](redline-nights/) |
| Prism Breaker | Block breaker: aim and fire a stream of light at numbered blocks before they cross the line. Lasers, prisms, bombs, and ball colours to unlock. | [`prism-breaker/`](prism-breaker/) |
| Void Eater | City swallower: a tiny void that grows by swallowing everything smaller, from cones to whole buildings. Two-minute battles against three rival voids, or solo. | [`void-eater/`](void-eater/) |
| Nova Strike | Vertical space shooter: waves of invaders, five gun levels, lasers and homing missiles, and three bosses with three phases each. | [`nova-strike/`](nova-strike/) |
| Glowline | Light-trail arena: four riders, glowing trails, first to 10 points. Orbs that help you or hurt everyone else; AI rivals or two players on one keyboard. | [`glowline/`](glowline/) |
| Pulse Runner | Endless runner: dodge, jump and slide down a neon highway, ride on the trains, fly the jetpack, and spend orbs on longer power-ups. | [`pulse-runner/`](pulse-runner/) |
| Sandblade | Hill rider: dive down neon hills, ramp from island to island (each with its own colour scheme), and outrun the storm. 11 power-ups. | [`sandblade/`](sandblade/) |
| Skyline Leap | Wall climber: leap between two towers, dodge window hazards and smash drones mid-air. 7 power-ups, and a Christmas version. | [`skyline-leap/`](skyline-leap/) |
| Sandblade Legion | Crowd runner: steer your army down a neon road through multiplier gates, blast through walls to the big bonus, and charge the horde. Every fight is one for one, so only the bigger army wins. Each level has its own colour scheme. | [`sandblade-legion/`](sandblade-legion/) |
| Sandblade Siege | Army flood in 3D: a huge horde pours in through portals and charges your gate, with giants on some levels; aim a cannon of riders through multiplier gates and mow it down one for one. Each level wears one of Sandblade's neon colour schemes. | [`sandblade-siege/`](sandblade-siege/) |
| Chopper Cave | Hold-to-climb cave flyer through a neon tunnel that changes colour every 250 m. Shield, Wide Cave and Slow-Mo power-ups, and portals to Hyperspace, a synthwave bonus world. | [`chopper-cave/`](chopper-cave/) |
| Iron Sector | First-person wave-survival shooter with an armory, attachments and air support. Neon night city by default; Settings → Style → Classic brings back the original look. | [`iron-sector/`](iron-sector/) |

## Music & sound

Every game, and the home page, has a **Music & sound** button. Pick the music you want:

- **Game music**: each game's own soundtrack, synthesised live in the browser (no audio files): house in Sandblade Legion, deep house in Sandblade, electro house in Skyline Leap (Christmas house in its Christmas version) and Void Eater, battle techno in Sandblade Siege, techno in Chopper Cave (electro in Hyperspace) and Glowline, outrun in Redline Nights (battle techno in pursuits) and Pulse Runner, chill house in Prism Breaker, trance in Nova Strike, and Iron Sector's own score. It starts when you start playing, pauses with the game, and has its own volume.
- **My music**: your own songs or your music app (below).
- **Off**: no music.

**Sound effects** has its own on/off switch, so you can have music without effects or effects without music. The choices are shared by every game. Each game's mute button still silences that game, music included. The soundtrack engine lives in the same shared file as the player (`shared/arcade-music.html`).

In **My music**, buttons at the top that open your music app (on iPhone: Apple Music, Spotify or YouTube Music; on Android: YouTube Music, Spotify or Apple Music): start a song there and come back, and it keeps playing under the game. A web page can't reach the phone's music library itself, and streaming songs are copy-protected, so this is the way to use them. Below that you can add music files from your phone or computer; they play while you game and carry on when you switch to another game. The files stay in your own browser (IndexedDB) and are never uploaded. The player lives in `shared/arcade-music.html`; after editing it, run `python3 tools/sync-music.py` to copy it into every page, so each game stays one self-contained page.

## Running locally

From this folder, run `python3 -m http.server 8000` and open http://localhost:8000/. Most games also work when opened directly as a file. Iron Sector and Redline Nights need the local server because they load JavaScript modules.

## Design

[`DESIGN.md`](DESIGN.md) is the house style every game shares: colours, type, components, layout, motion, sound and the game shell (menu, play, pause, results). The vetted **web-design-guidelines** skill in `.claude/skills/` reviews a page against Vercel's Web Interface Guidelines before it ships.

## Hosting

GitHub Pages serves the `main` branch from the repository root. The empty `.nojekyll` file tells Pages to publish the files as they are, without running them through Jekyll.

Best scores and settings are saved in each player's own browser.
