import {NEAR_RANGE, Point} from './base.js';
import {Edit} from './Edit.js';

export enum DirtyMode {
	NONE,
	PENDING_EDIT,
	LAST_EDIT,
	ALL_EDITS,
}

export default class EditCreator {
	readonly edits: Edit[] = [];
	pendingEdit: Edit | null = null;
	controlPoint = 0;
	private readonly redoEdits: Edit[] = [];
	dirty = DirtyMode.NONE;

	set maxDirty(dirtyMode: DirtyMode) {
		this.dirty = Math.max(this.dirty, dirtyMode);
	}

	findControlPoint(point: Point) {
		if (!this.pendingEdit) return -1;
		let deltas = this.pendingEdit.points.map(p => p.subtract(point));
		let magnitudes = deltas.map(delta => delta.magnitude2);
		let minIndex = magnitudes.indexOf(Math.min(...magnitudes));
		return deltas[minIndex].atMost(new Point(NEAR_RANGE)) && deltas[minIndex].atLeast(new Point(-NEAR_RANGE)) ? minIndex : -1;
	}

	setControlPoint(index: number) {
		if (!this.pendingEdit) return;
		this.controlPoint = index;
		this.maxDirty = DirtyMode.PENDING_EDIT;
	}

	setNextControlPoint() {
		if (!this.pendingEdit) return;
		this.controlPoint = (this.controlPoint + 1) % this.pendingEdit.points.length;
		this.maxDirty = DirtyMode.PENDING_EDIT;
	}

	moveControlPointTo(point: Point) {
		if (!this.pendingEdit) return;
		this.pendingEdit.setPoint(this.controlPoint, point);
		this.maxDirty = DirtyMode.PENDING_EDIT;
	}

	moveControlPointBy(delta: Point) {
		if (!this.pendingEdit) return;
		this.pendingEdit.setPoint(this.controlPoint, this.pendingEdit.points[this.controlPoint].add(delta));
		this.maxDirty = DirtyMode.PENDING_EDIT;
	}

	commitPendingEdit() {
		if (this.pendingEdit?.validCommit()) {
			this.edits.push(this.pendingEdit);
			this.pendingEdit = null;
			this.maxDirty = DirtyMode.LAST_EDIT;
		}
	}

	startNewEdit(edit: Edit | null) {
		this.commitPendingEdit();
		this.pendingEdit = edit;
		this.controlPoint = 0;
		this.maxDirty = DirtyMode.PENDING_EDIT;
	}

	undoPendingEdit() {
		if (this.pendingEdit?.validCommit()) {
			this.redoEdits.push(this.pendingEdit);
			this.pendingEdit = null;
			this.maxDirty = DirtyMode.PENDING_EDIT;
		}
	}

	undoEdit() {
		this.undoPendingEdit();
		if (this.edits.length) {
			this.pendingEdit = this.edits.pop()!;
			this.controlPoint = 0;
			this.maxDirty = DirtyMode.ALL_EDITS;
		}
	}

	redoEdit() {
		if (!this.redoEdits.length) return;
		this.commitPendingEdit();
		this.pendingEdit = this.redoEdits.pop()!;
		this.controlPoint = 0;
		this.maxDirty = DirtyMode.PENDING_EDIT;
	}
}
