import Editor from './Editor.js';

console.info('version', (await (await fetch('./version.txt')).text()).trim());
(window as any).editor = Editor.load(document.querySelector('canvas')!);

// todo diff tool
// todo allow scaling move
// todo layers

// todo post edits
//   delete edits with keyboard
//   traverse edits with keyboard
//   drag/drop to reorder edits
//   when deleting pending edit, select previous edit
