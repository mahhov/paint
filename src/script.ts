import Editor from './Editor.js';

window.editor = new Editor(document.querySelector('canvas')!);

// todo
//   diff tool
//   tool selector UI
//   color selector UI
//   paste text
//   save/load
//   control points shouldn't scale with camera zoom
//   allow scaling move
//   pencil tool
//   out of bounds error for computed points
//   fix edit stack and delete to clear/cancel
