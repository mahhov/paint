import {sort2} from './util/util.js';

type State = {
	text: string;
	cursor: number;
	selectionStart: number;
}

export enum Direction {
	LEFT,
	RIGHT,
	WORD_LEFT,
	WORD_RIGHT,
	LINE_LEFT,
	LINE_RIGHT,
}

enum EditType {
	TYPE,
	DELETE,
	CURSOR,
}

export default class TextEditor {
	state = {text: '', cursor: 0, selectionStart: 0};
	private lastEditType = EditType.CURSOR;
	private readonly undoStack: State[] = [];
	private readonly redoStack: State[] = [];

	type(text: string) {
		if (!text) return;
		if (this.lastEditType !== EditType.TYPE)
			this.commit();
		this.lastEditType = EditType.TYPE;
		this.deleteSelection();
		this.state.text = this.state.text.slice(0, this.state.cursor) + text + this.state.text.slice(this.state.cursor);
		this.state.cursor += text.length;
		this.state.selectionStart = this.state.cursor;
	}

	delete(direction: Direction) {
		if (this.lastEditType !== EditType.DELETE)
			this.commit();
		this.lastEditType = EditType.DELETE;
		if (this.hasSelection())
			this.deleteSelection();
		else {
			let [deleteFrom, deleteTo] = sort2(this.state.cursor, this.findNextCursor(direction));
			this.state.text = this.state.text.slice(0, deleteFrom) + this.state.text.slice(deleteTo);
			this.state.cursor = deleteFrom;
			this.state.selectionStart = deleteFrom;
		}
	}

	deleteSelection() {
		if (this.lastEditType !== EditType.DELETE)
			this.commit();
		this.lastEditType = EditType.DELETE;
		if (!this.hasSelection()) return;
		let start = Math.min(this.state.cursor, this.state.selectionStart);
		let end = Math.max(this.state.cursor, this.state.selectionStart);
		this.state.text = this.state.text.slice(0, start) + this.state.text.slice(end);
		this.state.cursor = start;
		this.state.selectionStart = start;
	}

	moveCursor(direction: Direction, selectionMode: boolean) {
		this.lastEditType = EditType.CURSOR;
		this.state.cursor = this.findNextCursor(direction);
		if (!selectionMode)
			this.state.selectionStart = this.state.cursor;
	}

	undo() {
		if (!this.undoStack.length) return;
		this.redoStack.push(this.state);
		this.state = this.undoStack.pop()!;
	}

	redo() {
		if (!this.redoStack.length) return;
		this.undoStack.push(this.state);
		this.state = this.redoStack.pop()!;
	}

	get selectedText() {
		let start = Math.min(this.state.cursor, this.state.selectionStart);
		let end = Math.max(this.state.cursor, this.state.selectionStart);
		return this.state.text.slice(start, end);
	}

	private hasSelection() {
		return this.state.cursor !== this.state.selectionStart;
	}

	private commit() {
		this.undoStack.push({...this.state});
	}

	private findNextCursor(direction: Direction) {
		switch (direction) {
			case Direction.LEFT:
				return Math.max(this.state.cursor - 1, 0);
			case Direction.RIGHT:
				return Math.min(this.state.cursor + 1, this.state.text.length);
			case Direction.WORD_LEFT: {
				let index = this.state.text.slice(0, this.state.cursor).trimEnd().lastIndexOf(' ');
				return index !== -1 ? index + 1 : 0;
			}
			case Direction.WORD_RIGHT: {
				let subStr = this.state.text.slice(this.state.cursor).trimStart();
				let index = subStr.indexOf(' ');
				return index !== -1 ? this.state.text.length - subStr.length + index : this.state.text.length;
			}
			case Direction.LINE_LEFT:
				return 0;
			case Direction.LINE_RIGHT:
				return this.state.text.length;
		}
	}
}
