import Editor from './Editor.js';

console.info('version', (await (await fetch('./version.txt')).text()).trim());
(window as any).editor = Editor.load(document.querySelector('canvas')!);

// todo diff tool
// todo allow scaling move
// todo key arrow speed moving objects
// todo able to edit older edits
// todo layers
