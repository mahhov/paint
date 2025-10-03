import {Color, NEAR_RANGE, Point, Tool} from './base.js';
import Camera from './Camera.js';
import {BucketFill, Clear, Edit, FillRect, Line, Move, Paste, Rect, Select, TextEdit} from './Edit.js';
import EditCreator from './EditCreator.js';
import {Input, InputState, KeyBinding, KeyModifier, MouseBinding, MouseButton, MouseWheelBinding} from './Input.js';
import Pixels from './Pixels.js';

enum DrawMode {
	FULL,
	LAST_EDIT,
	PENDING_EDIT
}

export default class Editor {
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
	private input: Input;
	private camera: Camera = new Camera();

	constructor(canvas: HTMLCanvasElement) {
		this.ctx = canvas.getContext('2d')!;
		this.pixels = new Pixels(canvas.width, canvas.height, this.ctx, Color.WHITE);
		this.pendingPixels = new Pixels(canvas.width, canvas.height, this.ctx, Color.CLEAR);
		this.input = new Input(canvas);

		this.input.addBinding(new MouseBinding(MouseButton.MIDDLE, [InputState.DOWN], () => {
			let delta = this.input.mouseLastPosition.subtract(this.input.mousePosition);
			this.camera.move(delta.scale(1 / canvas.width));
		}));
		this.input.addBinding(new MouseWheelBinding(false, [InputState.PRESSED], () => this.camera.zoom(-.2)));
		this.input.addBinding(new MouseWheelBinding(true, [InputState.PRESSED], () => this.camera.zoom(.2)));

		this.input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.PRESSED], () => {
			let nearPendingPoint = this.pendingEdit ? EditCreator.getNearPoint(this.pendingEdit.points, this.canvasMousePosition) : -1;
			if (EditCreator.toolIsInstant(this.tool))
				this.handleInstantEdit();
			else if (nearPendingPoint === -1)
				this.startNewEdit();
			else {
				this.editCreator.selectedPoint = nearPendingPoint;
				this.resumeEdit();
			}
		}));

		this.input.addBinding(new MouseBinding(MouseButton.RIGHT, [InputState.DOWN], () => this.startNewEdit(null)));

		this.input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.DOWN], () => {
			if (this.canvasMousePosition.equals(this.input.mouseLastPosition)) return;
			if (EditCreator.toolIsInstant(this.tool))
				this.handleInstantEdit();
			else if (this.editCreator.selectedPoint !== -1)
				this.resumeEdit();
		}));

		this.input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.RELEASED], () => {
			if (EditCreator.toolIsInstant(this.tool))
				this.handleInstantEdit();
			else if (this.editCreator.selectedPoint !== -1)
				this.resumeEdit();
		}));

		this.input.addBinding(new KeyBinding('z', [KeyModifier.CONTROL], [InputState.PRESSED], () => this.undoEdit()));
		this.input.addBinding(new KeyBinding('z', [KeyModifier.CONTROL, KeyModifier.SHIFT], [InputState.PRESSED], () => this.redoEdit()));
		this.input.addBinding(new KeyBinding('y', [KeyModifier.CONTROL], [InputState.PRESSED], () => this.redoEdit()));
		this.input.addBinding(new KeyBinding('Delete', [], [InputState.PRESSED], () => {
			if (this.pendingEdit instanceof Select || this.pendingEdit instanceof Move)
				this.addEdit(new Clear(this.pendingEdit.points[0], this.pendingEdit.points[1]));
			this.pendingEdit = null;
			this.draw(DrawMode.PENDING_EDIT);
		}));
		this.input.addBinding(new KeyBinding('Escape', [], [InputState.PRESSED], () => {
			this.pendingEdit = null;
			this.draw(DrawMode.PENDING_EDIT);
		}));
		this.input.addBinding(new KeyBinding('s', [], [InputState.PRESSED], () => this.selectTool(Tool.SELECT)));
		this.input.addBinding(new KeyBinding('l', [], [InputState.PRESSED], () => this.selectTool(Tool.LINE)));
		this.input.addBinding(new KeyBinding('r', [], [InputState.PRESSED], () => this.selectTool(Tool.RECT)));
		this.input.addBinding(new KeyBinding('f', [], [InputState.PRESSED], () => this.selectTool(Tool.FILL_RECT)));
		this.input.addBinding(new KeyBinding('t', [], [InputState.PRESSED], () => this.selectTool(Tool.TEXT)));
		this.input.addBinding(new KeyBinding('c', [], [InputState.PRESSED], () => this.selectTool(Tool.COLOR_PICKER)));
		this.input.addBinding(new KeyBinding('b', [], [InputState.PRESSED], () => this.selectTool(Tool.BUCKET_FILL)));
		this.input.addBinding(new KeyBinding('e', [], [InputState.PRESSED], () => this.selectTool(Tool.CLEAR)));
		this.input.addBinding(new KeyBinding('m', [], [InputState.PRESSED], () => this.selectTool(Tool.MOVE)));

		document.addEventListener('paste', e =>
			Paste.clipboardPixelArray(e)
				.then(pixelArray => this.startNewEdit(new Paste(this.canvasMousePosition, pixelArray)))
				.catch(e => console.warn(e)));

		let loop = async () => {
			await this.drawOnScreen();
			this.input.tick();
			requestAnimationFrame(loop);
		};
		loop();
	}

	// handle mouse & keyboard events to create, start, resume edits

	private get canvasMousePosition() {
		return this.camera.canvasToWorld(this.input.mousePosition.scale(1 / this.ctx.canvas.width)).scale(this.ctx.canvas.width).round;
	}

	selectTool(tool: Tool) {
		this.tool = tool;
		let edit = null;
		if (tool === Tool.MOVE && this.pendingEdit && this.pendingEdit.points.length >= 2)
			edit = new Move(this.pendingEdit.points[0], this.pendingEdit.points[1]);
		this.startNewEdit(edit);
	}

	private handleInstantEdit() {
		this.color = this.pixels.get(this.canvasMousePosition);
	}

	private startNewEdit(edit: Edit | null = this.createPendingEdit(this.canvasMousePosition)) {
		let commit = this.pendingEdit?.validCommit();
		if (commit)
			this.addEdit(this.pendingEdit!);
		this.pendingEdit = edit;
		this.editCreator.selectedPoint = 0;
		this.draw(DrawMode.PENDING_EDIT);
	}

	private resumeEdit() {
		if (!this.pendingEdit) return; // should this be moved to callsites?
		this.pendingEdit.setPoint(this.editCreator.selectedPoint, this.canvasMousePosition);
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

		let srcStart = this.camera.canvasToWorld(new Point()).scale(1000).round;
		let srcEnd = this.camera.canvasToWorld(new Point(1)).scale(1000).round;
		let srcSize = srcEnd.subtract(srcStart);
		let srcDestCoordinates = [srcStart.x, srcStart.y, srcSize.x, srcSize.y, 0, 0, 1000, 1000] as [number, number, number, number, number, number, number, number];

		this.ctx.imageSmoothingEnabled = srcSize.x > 1000;
		this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
		let committed = await createImageBitmap(this.pixels.imageData);
		this.ctx.drawImage(committed, ...srcDestCoordinates);
		let pending = await createImageBitmap(this.pendingPixels.imageData);
		this.ctx.drawImage(pending, ...srcDestCoordinates);
	}
}
