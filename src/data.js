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
  // palette + outfit: each helper dresses for its corner of the island (see OUTFITS in bot.js).
  { id: 'scout', name: 'Scout', role: 'guide', home: [3.5, 6.5], wander: 4, outfit: 'explorer',
    palette: { shell: 0xf6efdf, body: 0xe9dcbc, dark: 0x3d4a2a, accent: 0x6b7f3a, glow: 0xffd58a },
    greet: 'Hi, I\'m Scout! I know every corner of this island. Want me to walk you somewhere?' },
  { id: 'bugsy', name: 'Bugsy', role: 'bugs', home: [-12, -28], wander: 2.5, outfit: 'exterminator',
    palette: { shell: 0xe8f5dc, body: 0xa5d67a, dark: 0x1f4d2b, accent: 0xe53935, glow: 0xb9ff8a },
    greet: 'Bugs escaped into my arena! Squash as many as you can in 30 seconds. Fifteen earns the Debugger badge.' },
  { id: 'quizzy', name: 'Quizzy', role: 'quiz', home: [30, -17], wander: 2.5, outfit: 'scholar',
    palette: { shell: 0xf4efff, body: 0xc9b6f2, dark: 0x2e1f5e, accent: 0x6b4fbf, glow: 0xd7c2ff },
    greet: 'Think you know Asad\'s work? Five quick questions about his real projects. Get all five for Quiz Master.' },
  { id: 'dash', name: 'Dash', role: 'race', home: [-24, 22], wander: 2.5, outfit: 'racer',
    palette: { shell: 0xf2fbff, body: 0x8fdcf7, dark: 0x0c2d5e, accent: 0xff4a1c, glow: 0x9fe8ff },
    greet: 'Ship it! Run through 7 deploy rings in order. Finish under 25 seconds for the Speedrunner badge.' },
  { id: 'hiro', name: 'Hiro', role: 'hire', home: [6, -46], wander: 2, outfit: 'suit',
    palette: { shell: 0xeef2f8, body: 0x15305e, dark: 0x0b1d3d, accent: 0x2f6fe4, glow: 0x9cc8ff },
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
  'Rumour: four secret places are hidden around the edge of the island.',
  'I heard the trees in the far west whisper at night.',
  'Somewhere south, koi have been circling a pond for ages.',
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
  ['wanderer', 'Wanderer', 'Find all 5 secret places'],
  ['guest', 'Guest', 'Pin a note on the guestbook'],
  ['naturalist', 'Naturalist', 'Spot 3 rare animals'],
  ['traveller', 'Traveller', 'Visit all three worlds through the Sky Gate'],
];

// Guestbook notice board, just off the plaza between the Projects and Data paths (in view at spawn).
export const GUESTBOOK = { x: -5.3, z: 11.6 };

// Sunset Point: a bench on the eastern rim, facing open sky where the sun goes down (angle 0 = +x).
export const BENCH = { x: 72.2, z: 8, angle: 0 };

// Sky Gate: at the end of its own path west of the plaza. It leads to other worlds, each a separate
// floating island far out in the sky (only the one you're on is drawn and updated).
export const GATE = { x: -63, z: -20, name: 'Sky Gate' };
export const REALMS = {
  home: { name: 'Home Island', x: 0, z: 0, blurb: 'Back to Byte\'s island and the portfolio.' },
  rome: { name: 'Roman Forum', x: 1400, z: 0, blurb: 'Marble ruins, the Colosseum, an aqueduct, and a philosopher living in a jar.' },
  peaks: { name: 'Karakoram Peaks', x: -1400, z: 0, blurb: 'A base camp below K2, a glacier, a frozen lake and the markhor.' },
  coast: { name: 'Coral Coast', x: 0, z: 1400, blurb: 'Palm trees, a lighthouse, crabs, and the rare hawksbill turtle.' },
};

// Highland Forest: dense woods on the south-east rim where rare animals sometimes show themselves.
export const FOREST = { x: 29, z: 57, r: 13, name: 'Highland Forest' };

// Rare animals. `chance` is the odds of seeing one on a visit (it grows each time you miss it), and
// some only come out at night. Facts follow the IUCN Red List; population figures are estimates.
export const ANIMALS = [
  { id: 'panda', name: 'Giant Panda', latin: 'Ailuropoda melanoleuca', status: 'Vulnerable', chance: 0.55, when: 'any',
    text: 'About 1,860 live in the wild, in the misty bamboo forests of Sichuan, Shaanxi and Gansu in China. They eat bamboo for up to 14 hours a day, gripping stalks with a "pseudo-thumb", an enlarged wrist bone. Protected reserves helped move them from Endangered to Vulnerable in 2016.' },
  { id: 'redpanda', name: 'Red Panda', latin: 'Ailurus fulgens', status: 'Endangered', chance: 0.4, when: 'any',
    text: 'Possibly fewer than 10,000 remain, in the Eastern Himalayas and south-west China. Despite the name it is not a bear and not a close relative of the giant panda: it is the only living member of its own family. It spends most of its life in trees and wraps its ringed tail around itself like a blanket.' },
  { id: 'leopard', name: 'Snow Leopard', latin: 'Panthera uncia', status: 'Vulnerable', chance: 0.22, when: 'any',
    text: 'Only a few thousand are left (estimates range from about 2,700 to 6,500) across the high mountains of Central and South Asia, including Pakistan\'s Karakoram and Hindu Kush. Its thick tail is almost as long as its body, for balance on cliffs and as a scarf against the cold. Unlike other big cats, it cannot roar.' },
  { id: 'kakapo', name: 'Kakapo', latin: 'Strigops habroptilus', status: 'Critically Endangered', chance: 0.5, when: 'night',
    text: 'Only about 250 exist, all on predator-free islands in New Zealand, and every one has a name. It is the world\'s heaviest parrot, cannot fly, comes out at night and has a sweet, musty smell. It only breeds in years when the rimu trees fruit heavily.' },
  { id: 'pangolin', name: 'Chinese Pangolin', latin: 'Manis pentadactyla', status: 'Critically Endangered', chance: 0.3, when: 'night',
    text: 'Pangolins are the most trafficked wild mammals in the world, hunted for their scales and meat. The scales are keratin, the same material as your fingernails. It has no teeth: it eats ants and termites with a long sticky tongue and curls into a ball when threatened.' },
];

// Music Grove: a quiet clearing east of the plaza where the waltz plays. Not a district.
export const GROVE = { x: 46, z: 0, r: 10, name: 'Music Grove' };

// Secret places: not on the minimap until found. Each one has its own look (see .style-* in style.css).
export const SECRETS = [
  { id: 'spirit', name: 'Spirit Grove', x: -56, z: 0, r: 9, style: 'spirit',
    line: 'Tiny forest spirits live here. Walk slowly and they peek out.' },
  { id: 'koi', name: 'Koi Pond', x: -30, z: 56, r: 8, style: 'koi',
    line: 'A quiet pond. The koi have been circling it since the island was built.' },
  { id: 'windmill', name: 'Windmill Hill', x: 42, z: -50, r: 8, style: 'windmill',
    line: 'Sunflowers, butterflies and an old windmill that never stops turning.' },
  { id: 'shrine', name: 'Wind Shrine', x: -45, z: -48, r: 6.5, style: 'shrine',
    line: 'Ring the chimes and look up: an island floats in the sky above the sea.' },
  { id: 'sakura', name: 'Sakura Garden', x: 58, z: 32, r: 10, style: 'sakura',
    line: 'Cherry trees in full bloom, letting go of their petals one by one. Sit a while.' },
];
