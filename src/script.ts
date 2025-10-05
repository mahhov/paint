import Editor from './Editor.js';

(window as any).editor = Editor.load(document.querySelector('canvas')!);

// todo
//   diff tool
//   tool selector UI
//   color selector UI
//   allow scaling move
//   pencil tool
//   out of bounds error for computed points
