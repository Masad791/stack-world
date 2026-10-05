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
