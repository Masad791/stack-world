// All copy here comes from the portfolio (m-asad-portfolio.netlify.app); keep the two in sync.
export const PORTFOLIO = 'https://m-asad-portfolio.netlify.app';

export const CONTACT = [
  ['Email', 'mailto:muhammadasaddev31@gmail.com'],
  ['WhatsApp', 'https://wa.me/+923047767415?text=Hi%20Muhammad%20Asad%2C%20I%20played%20Stack%20World%20and%20would%20like%20to%20connect.'],
  ['LinkedIn', 'https://www.linkedin.com/in/asaddevco/'],
  ['GitHub', 'https://github.com/Masad791'],
];

// Districts. x/z = center on the island, r = radius that counts as "inside".
export const ZONES = [
  {
    id: 'plaza', name: 'Welcome Plaza', x: 0, z: 0, r: 9, color: '#ff4a1c',
    title: 'Hi, I am Muhammad Asad',
    text: 'Software engineer. I build Laravel backends, real-time tools and interfaces people remember. Every district on this island is a part of my stack. Go explore it.',
    tags: ['Collect 14 stack orbs', 'Visit 7 districts'],
  },
  {
    id: 'backend', name: 'Backend Castle', x: -34, z: -26, r: 13, color: '#ff2d20',
    title: 'Backend: PHP + Laravel',
    text: 'Modular Laravel APIs: nwidart modules, Sanctum tokens, permission middleware per route group, queued jobs and cached lookups. The Finance System, Task Management API and CineBook were built here.',
    tags: ['PHP', 'Laravel 12', 'Sanctum', 'Queues', 'REST'],
  },
  {
    id: 'frontend', name: 'Frontend Garden', x: 34, z: -26, r: 13, color: '#20a4d8',
    title: 'Frontend: React, Vue, JavaScript',
    text: 'Interfaces in React and Vue, motion with GSAP, WebGL with Three.js, and plain JavaScript when a dependency is not worth it, like the BookmarkPanels Chrome extension.',
    tags: ['React', 'Vue', 'JavaScript', 'Three.js', 'GSAP'],
  },
  {
    id: 'data', name: 'Data Docks', x: -34, z: 28, r: 13, color: '#336791',
    title: 'Data: SQL, documents and Redis',
    text: 'Postgres and MySQL hold the truth, MongoDB stores documents, and Redis does caching and atomic seat holds with Lua scripts so two people can never book the same seat.',
    tags: ['Postgres', 'MySQL', 'MongoDB', 'Redis'],
  },
  {
    id: 'lab', name: 'AI & Desktop Lab', x: 34, z: 28, r: 13, color: '#e0a800',
    title: 'Lab: Python, Electron, Docker',
    text: 'Real-time AI voice conversion on a laptop CPU (Python + ONNX inside an Electron app), an offline video upscaler on GPU shaders, and Docker for local infrastructure.',
    tags: ['Python', 'Electron', 'Node.js', 'Docker', 'ONNX'],
  },
  {
    id: 'projects', name: 'Projects Avenue', x: 0, z: 54, r: 17, color: '#7c4dff',
    title: 'Projects Avenue',
    text: 'Eight real projects on eight billboards. Walk up to one to read about it and open its full case study.',
    tags: ['8 projects'],
  },
  {
    id: 'hire', name: 'Hire HQ', x: 0, z: -52, r: 10, color: '#ff4a1c',
    title: 'Let\'s build something',
    text: 'Available for freelance work and open to full-time roles. Average response time is about two hours.',
    tags: [],
    contact: true,
  },
];

export const PROJECTS = [
  { id: 'voice-changer', num: '01', title: 'Voice Changer', img: '/projects/vc-cover.webp', text: 'A Windows app that changes your voice live in Zoom, Meet and Discord with neural voice conversion running on a laptop CPU.' },
  { id: 'bookmark-panels', num: '02', title: 'BookmarkPanels', img: '/projects/bookmark-floating.webp', text: 'A Chrome extension that keeps your bookmarks in floating glass panels and a slide-in sidebar on any page. Alt+B to open, stored locally.' },
  { id: 'finance-system', num: '03', title: 'Finance Management System', img: '/projects/fms-cover.webp', text: 'A modular Laravel 12 API with role-based permissions, Google sign-in, OTP reset and a queued WebP image pipeline on Cloudinary.' },
  { id: 'devpulse', num: '04', title: 'DevPulse', img: '/projects/devpulse-news.webp', text: 'An open-source tech news aggregator that merges 54 sources into one ranked feed, plus trending repos and issues to contribute to.' },
  { id: 'cinebook', num: '05', title: 'CineBook', img: '/projects/cinebook-cover.webp', text: 'Cinema booking where seats are held atomically in Redis and every viewer sees holds appear on the seat map live.' },
  { id: 'video-upscaler', num: '06', title: 'Video Upscaler', img: '/projects/upscaler-cover.webp', text: 'A one-click offline upscaler for movies and anime that runs neural shaders on a laptop iGPU.' },
  { id: 'task-management-api', num: '07', title: 'Task Management API', img: '/projects/taskflow-cover.webp', text: 'A modular Laravel 12 API for teams: projects, task assignment, comments and permission-guarded user management.' },
  { id: 'singularity', num: '08', title: 'Singularity Engine', img: '/projects/singularity-cover.webp', text: 'An interactive WebGL black hole where your cursor becomes a second one, with real-time gravitational lensing.' },
];

// Stack orbs to collect. Positions are rough; the world nudges them out of any building.
export const ORBS = [
  ['PHP', 'php', -22, -12], ['Laravel', 'laravel', -31, -22],
  ['JavaScript', 'javascript', 22, -12], ['React', 'react', 41, -31], ['Vue', 'vuejs', 27, -32], ['Three.js', 'threejs', 30, -39],
  ['MySQL', 'mysql', -22, 16], ['Postgres', 'postgresql', -43, 22], ['MongoDB', 'mongodb', -29, 38], ['Redis', 'redis', -42, 36],
  ['Python', 'python', 22, 16], ['Electron', 'electron', 43, 21], ['Node.js', 'nodejs', 44, 35], ['Docker', 'docker', 26, 39],
];

// ---------- Helper bots ----------
// role decides what talking to them does (see main.js). home = where they hang out.
export const HELPERS = [
  { id: 'scout', name: 'Scout', role: 'guide', home: [3.5, 6.5], wander: 4, shell: 0xffd166, accent: 0x1b1b1f,
    greet: 'Hi, I\'m Scout! I know every corner of this island. Want me to walk you somewhere?' },
  { id: 'bugsy', name: 'Bugsy', role: 'bugs', home: [-12, -28], wander: 2.5, shell: 0x9be15d, accent: 0xe53935,
    greet: 'Bugs escaped into my arena! Squash as many as you can in 30 seconds. Fifteen earns the Debugger badge.' },
  { id: 'quizzy', name: 'Quizzy', role: 'quiz', home: [30, -17], wander: 2.5, shell: 0xc792ea, accent: 0xffffff,
    greet: 'Think you know Asad\'s work? Five quick questions about his real projects. Get all five for Quiz Master.' },
  { id: 'dash', name: 'Dash', role: 'race', home: [-24, 22], wander: 2.5, shell: 0x61dafb, accent: 0xff4a1c,
    greet: 'Ship it! Run through 7 deploy rings in order. Finish under 25 seconds for the Speedrunner badge.' },
  { id: 'hiro', name: 'Hiro', role: 'hire', home: [6, -46], wander: 2, shell: 0x2b2b31, accent: 0xff4a1c,
    greet: 'Asad replies in about two hours and is open to freelance and full-time work. Want his details?' },
];

// Small drones roam the whole island and share these when you get close.
export const FACTS = [
  'The Voice Changer\'s AI engine idles at about 0% CPU while you are silent.',
  'CineBook holds a seat for exactly 420 seconds in Redis.',
  'BookmarkPanels asks Chrome for only 4 permissions.',
  'DevPulse merges 54 news sources and needs no database.',
  'Every image uploaded to the Finance System is re-encoded to WebP.',
  'Singularity Engine pushes 112,000 particles around two black holes.',
  'This island has zero 3D model files. Everything is built in code.',
  'The Video Upscaler resumes long jobs in 60 second segments.',
];

// ---------- Minigames ----------
export const ARENA = { x: -12, z: -38, r: 9 };

// Deploy race: rings sit on the paths, so the route stays clear of buildings.
export const RINGS = [[-17, 14], [-17, -13], [0, -26], [17, -13], [17, 14], [0, 27], [0, 10]];
export const RACE_PAR = 25;

// Quiz answers come straight from the projects' case studies. The first option is correct.
export const QUIZ = [
  ['Where does CineBook keep its temporary seat holds?', 'Redis', 'MySQL', 'MongoDB'],
  ['What runs the Voice Changer\'s AI voices?', 'RVC models on ONNX Runtime', 'A cloud API', 'WebGPU in the browser'],
  ['Which shortcut opens BookmarkPanels?', 'Alt+B', 'Ctrl+K', 'Shift+P'],
  ['The Finance System converts every upload to...', 'WebP', 'PNG', 'GIF'],
  ['How many news sources does DevPulse merge?', '54', '12', '200'],
  ['How long does a CineBook seat hold last?', '7 minutes', '30 seconds', '1 hour'],
  ['Which shader powers the Upscaler\'s Balanced mode?', 'FSRCNNX', 'Bloom', 'SSAO'],
  ['How many black holes are in Singularity Engine?', '2', '1', '5'],
  ['How many Laravel modules does the Finance System have?', '5', '1', '12'],
];

export const BADGES = [
  ['explorer', 'Explorer', 'Visit all 7 districts'],
  ['collector', 'Collector', 'Collect all 14 stack orbs'],
  ['debugger', 'Debugger', 'Squash 15 bugs in one round'],
  ['speedrunner', 'Speedrunner', `Finish the deploy race under ${RACE_PAR} s`],
  ['quiz', 'Quiz Master', 'Score 5 of 5 in the Stack Quiz'],
  ['social', 'Social Bot', 'Talk to all 5 helper bots'],
];

// Music Grove: a quiet clearing east of the plaza where the waltz plays. Not a district.
export const GROVE = { x: 46, z: 0, r: 10, name: 'Music Grove' };
