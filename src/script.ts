import Editor from './Editor.js';

(window as any).editor = new Editor(document.querySelector('canvas')!);

// todo
//   diff tool
//   tool selector UI
//   color selector UI
//   paste text
//   allow scaling move
//   pencil tool
//   out of bounds error for computed points
