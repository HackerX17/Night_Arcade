# Skyline Leap

A mobile-first neon wall-jumping climber. A ninja runs up the gap between two towers; tap to leap to the other wall.

## Play
Open `index.html` in any browser. On a phone, "Add to Home Screen" makes it feel like an app.

## Controls
- **Tap** (or Space / Up arrow): leap to the other wall. A tap just before you land is remembered.

## Rules
- Window hazards (flower pots, AC units, neon signs) end your run if you run into them on the wall.
- Drones and falling junk: smash them **in mid-air** for points (combos multiply up to x5); touching them on the wall ends your run.
- Coins along the walls are worth 5 points each.
- Every 250 m you enter a new district with its own colours.

## Power-ups
Power-ups float in the middle of the gap, so you grab them mid-leap. Each one shows under your height with a ring that runs down as it wears off.
- **Shield**: survives one hit
- **Magnet**: pulls in coins for 8 seconds
- **Rocket**: blasts you straight up for about 3 seconds, smashing everything
- **Fury** (new): for 6 seconds, whatever you touch gets smashed for points, even running up the wall
- **Freeze** (new): for 5 seconds drones and falling junk stop dead, and touching a frozen one shatters it for points (window hazards still count)
- **Gold Rush** (new): window hazards on the way turn into stacks of gold; run into one for 5 coins instead of falling
- **Slow-Mo** (new): for 6 seconds the whole world runs at about half speed, and smashes score double

## Christmas version
Pick **Christmas** on the menu (the game remembers your choice). Same game, all dressed up: snow falling, northern lights, strings of Christmas lights down both towers, wreaths and snowy window sills, a Santa hat and candy-cane headband on the ninja, baubles instead of coins, presents for power-ups, potted Christmas trees, frosty AC units with icicles, JOY and NOEL signs, reindeer drones, falling icicles, and sleigh bells. Five districts: Candy Cane Lane, Evergreen Heights, Frost Spires, Gingerbread Row and Tinsel Tower.

**Music & sound** (on the menu, pause and game-over screens): the game's own electro-house soundtrack (Christmas house in the Christmas version), your own music, or none, and a separate switch for sound effects.

Single file, no dependencies: HTML5 canvas and Web Audio. Bloom and afterimages switch off automatically on slow devices.
