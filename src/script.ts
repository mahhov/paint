import Editor from './Editor.js';

console.info('version', (await (await fetch('./version.txt')).text()).trim());
(window as any).editor = Editor.load(document.querySelector('canvas')!);

// todo diff tool
// todo allow scaling move
// todo layers
// todo post edits drag/drop to reorder edits or move them between stacks (e.g. edits, post edits, redo edits)
// todo need a way to commit pending edit and have nothing selected
