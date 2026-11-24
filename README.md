# Night Arcade

Six original browser games. They run on phones and computers with nothing to install.

**Play:** https://hackerx17.github.io/Night_Arcade/

| Game | What it is | Folder |
| --- | --- | --- |
| Sandblade | Hill rider: dive down neon hills, ramp from island to island (each with its own colour scheme), and outrun the storm. 11 power-ups. | [`sandblade/`](sandblade/) |
| Skyline Leap | Wall climber: leap between two towers, dodge window hazards and smash drones mid-air. 7 power-ups, and a Christmas version. | [`skyline-leap/`](skyline-leap/) |
| Sandblade Legion | Crowd runner: steer your army through multiplier gates, blast through walls to the big bonus, and crush the horde. | [`sandblade-legion/`](sandblade-legion/) |
| Sandblade Siege | Army flood in 3D: a huge horde charges your gate; aim a cannon of riders through multiplier gates and mow it down. Each level wears one of Sandblade's neon colour schemes. | [`sandblade-siege/`](sandblade-siege/) |
| Chopper Cave | Retro hold-to-climb cave flyer. | [`chopper-cave/`](chopper-cave/) |
| Iron Sector | First-person wave-survival shooter with an armory, attachments and air support. | [`iron-sector/`](iron-sector/) |

## My music

Every game, and the home page, has a **My music** button. At the top are buttons that open your music app (on iPhone: Apple Music, Spotify or YouTube Music; on Android: YouTube Music, Spotify or Apple Music): start a song there and come back, and it keeps playing under the game. A web page can't reach the phone's music library itself, and streaming songs are copy-protected, so this is the way to use them. Below that you can add music files from your phone or computer; they play while you game and carry on when you switch to another game. The files stay in your own browser (IndexedDB) and are never uploaded. The player lives in `shared/arcade-music.html`; after editing it, run `python3 tools/sync-music.py` to copy it into every page, so each game stays one self-contained page.

## Running locally

From this folder, run `python3 -m http.server 8000` and open http://localhost:8000/. Most games also work when opened directly as a file. Iron Sector needs the local server because it loads JavaScript modules.

## Hosting

GitHub Pages serves the `main` branch from the repository root. The empty `.nojekyll` file tells Pages to publish the files as they are, without running them through Jekyll.

Best scores and settings are saved in each player's own browser.
