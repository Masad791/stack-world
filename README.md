# Stack World

A tiny 3D game inside [Muhammad Asad's portfolio](https://m-asad-portfolio.netlify.app). Drive Byte the robot around an island built from the stack, meet the helper bots, play their minigames, and switch moods to watch the island change.

Live: https://mad-stack-world.netlify.app

## What's on the island

- **7 districts** made from the stack (Backend Castle, Frontend Garden, Data Docks, AI & Desktop Lab, Projects Avenue, Hire HQ, Welcome Plaza) and **14 stack orbs** to collect.
- **Helper bots**: Scout gives guided walks and an orb compass; Bugsy, Quizzy and Dash run minigames; Hiro shares contact details. Drones roam the island telling real facts about the projects.
- **Minigames**: Bug Squash (30 s), Deploy Race (7 rings against a 25 s par) and a Stack Quiz about the real projects.
- **8 badges**, saved between visits, and **4 secret places** with their own art styles.
- **Day cycle** (default): a 5 minute day where the sun and moon cross the sky and shadows move. Or pick a fixed mood: Morning, Golden hour, Starry night or Sakura.
- **Weather** (auto or pick one):
  - Rain: GPU raindrops that land with splash rings and spray, puddles that grow as the ground soaks and ripple under every drop, wet glossy ground, lightning and thunder. Byte splashes through puddles.
  - Snow: drifting flakes, snow that settles on every upward surface (ground, roofs, tree tops), grass bending under it, and footprints that slowly fill in.
- **Guestbook**: a notice board by the plaza shows the latest notes; anyone can pin one.
- **Music Grove**: a procedural 3/4 waltz (Web Audio, no audio files) fades in as you approach.
- **Camera views**: Follow, Cinematic (letterboxed slow orbit, HUD hidden) and Bird's-eye.

## Controls

WASD/arrows to move, Shift to run, Space to jump, click or tap to walk, E to talk (or sign the guestbook), M for mood, R for weather, V for camera, scroll or +/- to zoom.

## Tech

Three.js + Vite. No model, texture or audio files besides the project screenshots and stack logos: every building, bot, bird and blade of grass is built in code. Grass sways in a custom vertex shader, and bloom comes from `UnrealBloomPass` (off on touch devices).

```bash
npm install
npm run dev     # http://localhost:3200
npm run build   # dist/
node tests/guestbook.test.mjs
```

The guestbook API is a Netlify Function (`netlify/functions/guestbook.mjs`, served at `/api/guestbook`) that keeps notes in Netlify Blobs. It validates input, blocks links, rate-limits to one note per visitor every 30 s (IPs are stored only as hashes) and has a honeypot field for bots. To remove a note, delete it from the `guestbook` store's `entries` list in the Netlify dashboard (Blobs). `npm run dev` has no function server, so the guestbook shows as resting locally.

Content lives in `src/data.js` (keep it in sync with the portfolio). Logos are devicon (MIT).
