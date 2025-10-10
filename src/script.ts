import Editor from './Editor.js';

console.info('version', (await (await fetch('./version.txt')).text()).trim());
(window as any).editor = Editor.load(document.querySelector('canvas')!);

// todo diff tool
// todo allow scaling move
// todo layers

// todo post edits
//   visualize edits
//   traverse edits
//   pick edits with id canvas
//   delete edits
//   correct pixel composition for post edits
