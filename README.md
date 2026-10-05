# Stack World

A tiny 3D game inside [Muhammad Asad's portfolio](https://m-asad-portfolio.netlify.app). Drive Byte the robot around an island built from the stack, meet the helper bots, play their minigames, and switch moods to watch the island change.

Live: https://mad-stack-world.netlify.app

## What's on the island

- **7 districts** made from the stack (Backend Castle, Frontend Garden, Data Docks, AI & Desktop Lab, Projects Avenue, Hire HQ, Welcome Plaza) and **14 stack orbs** to collect.
- **Helper bots**: Scout gives guided walks and an orb compass; Bugsy, Quizzy and Dash run minigames; Hiro shares contact details. Drones roam the island telling real facts about the projects.
- **Minigames**: Bug Squash (30 s), Deploy Race (7 rings against a 25 s par) and a Stack Quiz about the real projects.
- **6 badges**, saved between visits.
- **Moods**: Morning, Golden hour, Starry night (fireflies, glowing lamps, stars) and Sakura (falling petals), cross-faded live.
- **Music Grove**: a procedural 3/4 waltz (Web Audio, no audio files) fades in as you approach.
- **Camera views**: Follow, Cinematic (letterboxed slow orbit, HUD hidden) and Bird's-eye.

## Controls

WASD/arrows to move, Shift to run, Space to jump, click or tap to walk, E to talk, M for mood, V for camera, scroll or +/- to zoom.

## Tech

Three.js + Vite. No model, texture or audio files besides the project screenshots and stack logos: every building, bot, bird and blade of grass is built in code. Grass sways in a custom vertex shader, and bloom comes from `UnrealBloomPass` (off on touch devices).

```bash
npm install
npm run dev     # http://localhost:3200
npm run build   # dist/
```

Content lives in `src/data.js` (keep it in sync with the portfolio). Logos are devicon (MIT).
