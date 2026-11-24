# Night Arcade

Six original browser games. They run on phones and computers with nothing to install.

**Play:** https://hackerx17.github.io/Night_Arcade/

| Game | What it is | Folder |
| --- | --- | --- |
| Sandblade | Hill rider: dive down neon hills, launch off giant ramps from island to island, and outrun the storm. | [`sandblade/`](sandblade/) |
| Skyline Leap | Wall climber: leap between two towers, dodge window hazards and smash drones mid-air. | [`skyline-leap/`](skyline-leap/) |
| Sandblade Legion | Crowd runner: steer your army through multiplier gates, blast through walls to the big bonus, and crush the horde. | [`sandblade-legion/`](sandblade-legion/) |
| Sandblade Siege | Army flood: aim a cannon of soldiers through multiplier gates and flood a huge horde. | [`sandblade-siege/`](sandblade-siege/) |
| Chopper Cave | Retro hold-to-climb cave flyer. | [`chopper-cave/`](chopper-cave/) |
| Iron Sector | First-person wave-survival shooter with an armory, attachments and air support. | [`iron-sector/`](iron-sector/) |

## Running locally

From this folder, run `python3 -m http.server 8000` and open http://localhost:8000/. Most games also work when opened directly as a file. Iron Sector needs the local server because it loads JavaScript modules.

## Hosting

GitHub Pages serves the `main` branch from the repository root. The empty `.nojekyll` file tells Pages to publish the files as they are, without running them through Jekyll.

Best scores and settings are saved in each player's own browser.
