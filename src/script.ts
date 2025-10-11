import Editor from './Editor.js';

console.info('version', (await (await fetch('./version.txt')).text()).trim());
(window as any).editor = Editor.load(document.querySelector('canvas')!);

// todo diff tool
// todo allow scaling move
// todo layers

// todo post edits
//   drag/drop to reorder edits
