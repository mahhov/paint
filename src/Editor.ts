import {Color, NEAR_RANGE, Point, Tool} from './base.js';
import {BucketFill, Clear, Edit, FillRect, Line, Move, Paste, Rect, Select, TextEdit} from './Edit.js';
import {EditCreator} from './EditCreator.js';
import {Pixels} from './Pixels.js';

enum DrawMode {
	FULL,
	LAST_EDIT,
	PENDING_EDIT
}

export class Editor {
	private readonly ctx: CanvasRenderingContext2D;
	private readonly pixels: Pixels;
	private readonly pendingPixels: Pixels;
	private pendingDirty = false;
	private readonly edits: Edit[] = [];
	private redoEdits: Edit[] = [];
	private readonly editCreator = new EditCreator();
	private pendingEdit: Edit | null = null;
	private tool = Tool.SELECT;
	private color = Color.BLACK;

	constructor(canvas: HTMLCanvasElement) {
		this.ctx = canvas.getContext('2d')!;
		this.pixels = new Pixels(canvas.width, canvas.height, this.ctx, Color.WHITE);
		this.pendingPixels = new Pixels(canvas.width, canvas.height, this.ctx, Color.CLEAR);

		canvas.addEventListener('mousedown', e => {
			this.editCreator.mouseDown = new Point(e.offsetX, e.offsetY);
			this.editCreator.mouseUp = this.editCreator.mouseDown;
			this.editCreator.mouseIsDown = true;

			let nearPendingPoint = this.pendingEdit ? this.editCreator.getNearPoint(this.pendingEdit.points, this.editCreator.mouseDown) : -1;
			if (EditCreator.toolIsInstant(this.tool))
				this.handleInstantEdit();
			else if (nearPendingPoint === -1)
				this.startNewEdit();
			else {
				this.editCreator.selectedPoint = nearPendingPoint;
				this.resumeEdit();
			}
		});

		canvas.addEventListener('mousemove', e => {
			if (!this.editCreator.mouseIsDown) return;
			this.editCreator.mouseUp = new Point(e.offsetX, e.offsetY);

			if (EditCreator.toolIsInstant(this.tool))
				this.handleInstantEdit();
			else if (this.editCreator.selectedPoint !== -1)
				this.resumeEdit();
		});

		canvas.addEventListener('mouseup', e => {
			if (!this.editCreator.mouseIsDown) return;
			this.editCreator.mouseUp = new Point(e.offsetX, e.offsetY);
			this.editCreator.mouseIsDown = false;

			if (EditCreator.toolIsInstant(this.tool))
				this.handleInstantEdit();
			else if (this.editCreator.selectedPoint !== -1)
				this.resumeEdit();
		});

		document.addEventListener('keydown', e => {
			if (e.ctrlKey) {
				if (e.key === 'z' && !e.shiftKey)
					this.undoEdit();
				if (e.key === 'z' && e.shiftKey || e.key === 'y')
					this.redoEdit();
				return;
			}

			if (e.key === 'Delete' && this.pendingEdit instanceof Select)
				this.addEdit(new Clear(this.pendingEdit.points[0], this.pendingEdit.points[1]));

			if (e.key === 'Escape' || e.key === 'Delete') {
				this.pendingEdit = null;
				this.draw(DrawMode.PENDING_EDIT);
				return;
			}

			let tool = {
				s: Tool.SELECT,
				l: Tool.LINE,
				r: Tool.RECT,
				f: Tool.FILL_RECT,
				t: Tool.TEXT,
				c: Tool.COLOR_PICKER,
				b: Tool.BUCKET_FILL,
				e: Tool.CLEAR,
				m: Tool.MOVE,
			}[e.key];
			if (tool === undefined) return;
			this.tool = tool;
			let edit = null;
			if (tool === Tool.MOVE && this.pendingEdit && this.pendingEdit.points.length >= 2)
				edit = new Move(this.pendingEdit.points[0], this.pendingEdit.points[1]);
			this.startNewEdit(edit);
		});

		document.addEventListener('paste', e =>
			Paste.clipboardPixelArray(e)
				.then(pixelArray => {
					let paste = new Paste(this.editCreator.mouseUp, pixelArray);
					this.startNewEdit(paste);
					this.startNewEdit(new Select(paste.points[0], paste.points[1]));
				})
				.catch(e => console.warn(e)));

		let drawLoop = async () => {
			await this.drawOnScreen();
			requestAnimationFrame(drawLoop);
		};
		drawLoop();
	}

	// handle mouse events to create, start, resume edits

	private handleInstantEdit() {
		this.color = this.pixels.get(this.editCreator.mouseUp);
	}

	private startNewEdit(edit: Edit | null = this.createPendingEdit(this.editCreator.mouseUp)) {
		let commit = this.pendingEdit?.validCommit();
		if (commit)
			this.addEdit(this.pendingEdit!);
		this.pendingEdit = edit;
		this.editCreator.selectedPoint = 0;
		this.draw(DrawMode.PENDING_EDIT);
	}

	private resumeEdit() {
		if (!this.pendingEdit) return; // should this be moved to callsites?
		this.pendingEdit.setPoint(this.editCreator.selectedPoint, this.editCreator.mouseUp);
		this.draw(DrawMode.PENDING_EDIT);
	}

	private createPendingEdit(point: Point): Edit {
		switch (this.tool) {
			case Tool.SELECT:
				return new Select(point, point);
			case Tool.LINE:
				return new Line(point, point, this.color);
			case Tool.RECT:
				return new Rect(point, point, this.color);
			case Tool.FILL_RECT:
				return new FillRect(point, point, this.color);
			case Tool.TEXT:
				return new TextEdit(point, 12, this.color);
			case Tool.COLOR_PICKER:
				let never: never;
			case Tool.BUCKET_FILL:
				return new BucketFill(point, this.color);
			case Tool.CLEAR:
				return new Clear(point, point);
			case Tool.MOVE:
				return new Move(point, point);
		}
	}

	// manage edit, undo, redo stacks

	private addEdit(edit: Edit) {
		this.edits.push(edit);
		this.draw(DrawMode.LAST_EDIT);
	}

	private undoEdit() {
		if (this.pendingEdit) {
			this.redoEdits.push(this.pendingEdit);
			this.pendingEdit = null;
		}
		if (this.edits.length)
			this.pendingEdit = this.edits.pop()!;
		this.draw(DrawMode.FULL);
	}

	private redoEdit() {
		if (!this.redoEdits.length) return;
		let commit = !!this.pendingEdit;
		if (commit)
			this.edits.push(this.pendingEdit!);
		this.pendingEdit = this.redoEdits.pop()!;
		this.draw(commit ? DrawMode.LAST_EDIT : DrawMode.PENDING_EDIT);
	}

	// other

	private copy() {
	}

	private draw(drawMode: DrawMode) {
		if (drawMode === DrawMode.FULL) {
			this.pixels.clear();
			this.edits.forEach(edit => edit.draw(this.pixels, this.pixels, false));

		} else if (drawMode === DrawMode.LAST_EDIT)
			this.edits.at(-1)!.draw(this.pixels, this.pixels, false);

		this.pendingDirty = true;
	}

	private async drawOnScreen() {
		if (this.pendingDirty) {
			this.pendingDirty = false;
			this.pendingPixels.clear();
			if (this.pendingEdit) {
				this.pendingEdit.draw(this.pendingPixels, this.pixels, true);
				let r = new Point(NEAR_RANGE / 2).round;
				this.pendingEdit.points.forEach(p =>
					new Select(p.subtract(r), p.add(r)).draw(this.pendingPixels, this.pixels, true));
			}
		}

		this.ctx.putImageData(this.pixels.imageData, 0, 0);
		let pending = await createImageBitmap(this.pendingPixels.imageData);
		this.ctx.drawImage(pending, 0, 0);
	}
}
