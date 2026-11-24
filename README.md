# Night Arcade

Six original browser games. They run on phones and computers with nothing to install.

**Play:** https://hackerx17.github.io/Night_Arcade/

| Game | What it is | Folder |
| --- | --- | --- |
| Sandblade | Hill rider: dive down neon hills, ramp from island to island (each with its own colour scheme), and outrun the storm. 11 power-ups. | [`sandblade/`](sandblade/) |
| Skyline Leap | Wall climber: leap between two towers, dodge window hazards and smash drones mid-air. 7 power-ups, and a Christmas version. | [`skyline-leap/`](skyline-leap/) |
| Sandblade Legion | Crowd runner: steer your army down a neon road through multiplier gates, blast through walls to the big bonus, and crush the horde. Each level has its own colour scheme. | [`sandblade-legion/`](sandblade-legion/) |
| Sandblade Siege | Army flood in 3D: a huge horde charges your gate; aim a cannon of riders through multiplier gates and mow it down. Each level wears one of Sandblade's neon colour schemes. | [`sandblade-siege/`](sandblade-siege/) |
| Chopper Cave | Hold-to-climb cave flyer through a neon tunnel that changes colour every 250 m. | [`chopper-cave/`](chopper-cave/) |
| Iron Sector | First-person wave-survival shooter with an armory, attachments and air support. | [`iron-sector/`](iron-sector/) |

## Music & sound

Every game, and the home page, has a **Music & sound** button. Pick the music you want:

- **Game music**: each game's own soundtrack, synthesised live in the browser (no audio files): house in Sandblade Legion, deep house in Sandblade, electro house in Skyline Leap (Christmas house in its Christmas version), battle techno in Sandblade Siege, techno in Chopper Cave, and Iron Sector's own score. It starts when you start playing, pauses with the game, and has its own volume.
- **My music**: your own songs or your music app (below).
- **Off**: no music.

**Sound effects** has its own on/off switch, so you can have music without effects or effects without music. The choices are shared by every game. Each game's mute button still silences that game, music included. The soundtrack engine lives in the same shared file as the player (`shared/arcade-music.html`).

In **My music**, buttons at the top that open your music app (on iPhone: Apple Music, Spotify or YouTube Music; on Android: YouTube Music, Spotify or Apple Music): start a song there and come back, and it keeps playing under the game. A web page can't reach the phone's music library itself, and streaming songs are copy-protected, so this is the way to use them. Below that you can add music files from your phone or computer; they play while you game and carry on when you switch to another game. The files stay in your own browser (IndexedDB) and are never uploaded. The player lives in `shared/arcade-music.html`; after editing it, run `python3 tools/sync-music.py` to copy it into every page, so each game stays one self-contained page.

## Running locally

From this folder, run `python3 -m http.server 8000` and open http://localhost:8000/. Most games also work when opened directly as a file. Iron Sector needs the local server because it loads JavaScript modules.

## Hosting

GitHub Pages serves the `main` branch from the repository root. The empty `.nojekyll` file tells Pages to publish the files as they are, without running them through Jekyll.

Best scores and settings are saved in each player's own browser.
