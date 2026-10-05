# Stack World

A tiny 3D game inside [Muhammad Asad's portfolio](https://m-asad-portfolio.netlify.app). Drive Byte the robot around an island built from the stack: visit 7 districts, read about 8 real projects on Projects Avenue, and collect all 14 stack orbs.

Live: https://mad-stack-world.netlify.app

- Three.js + Vite, no model files: every building, the bot and the props are built from primitives in code.
- Top-down Clash of Clans style camera; WASD/arrows, Shift to run, Space to jump, click or tap the ground to walk.
- Progress is saved in localStorage.

```bash
npm install
npm run dev     # http://localhost:3200
npm run build   # dist/
```

Content lives in `src/data.js` (keep it in sync with the portfolio). Logos are devicon (MIT).
