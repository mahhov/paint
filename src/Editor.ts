import {Color, NEAR_RANGE, Point, Tool} from './base.js';
import Camera from './Camera.js';
import {BucketFill, Clear, Edit, FillRect, Line, Move, Paste, Rect, Select, StraightLine, TextEdit} from './Edit.js';
import EditCreator from './EditCreator.js';
import {Input, InputState, KeyBinding, KeyModifier, MouseBinding, MouseButton, MouseWheelBinding} from './Input.js';
import Pixels from './Pixels.js';

const PIXELS_SIZE = 3000;
const EDITOR_SIZE = 1500;
// todo responsive
const PANEL_SIZE = 300;

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
	private camera: Camera = new Camera(EDITOR_SIZE / PIXELS_SIZE, 64 / PIXELS_SIZE, 1);

	constructor(canvas: HTMLCanvasElement) {
		canvas.width = EDITOR_SIZE + PANEL_SIZE;
		canvas.height = EDITOR_SIZE;

		this.ctx = canvas.getContext('2d')!;
		this.pixels = new Pixels(PIXELS_SIZE, PIXELS_SIZE, this.ctx, Color.WHITE);
		this.pendingPixels = new Pixels(PIXELS_SIZE, PIXELS_SIZE, this.ctx, Color.CLEAR);
		this.input = new Input(canvas);

		this.input.addBinding(new MouseBinding(MouseButton.MIDDLE, [InputState.DOWN], () => {
			let delta = this.input.mouseLastPosition.subtract(this.input.mousePosition);
			this.camera.move(delta.scale(1 / EDITOR_SIZE));
		}));
		this.input.addBinding(new MouseWheelBinding(false, () => this.camera.zoom(-.2)));
		this.input.addBinding(new MouseWheelBinding(true, () => this.camera.zoom(.2)));

		this.input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.PRESSED], () => {
			let nearPendingPoint = this.pendingEdit ? EditCreator.getNearPoint(this.pendingEdit.points, this.canvasMousePosition()) : -1;
			if (EditCreator.toolIsInstant(this.tool))
				this.handleInstantEdit();
			else if (nearPendingPoint === -1)
				this.startNewEdit();
			else {
				this.editCreator.selectedPoint = nearPendingPoint;
				this.resumeEdit();
			}
		}));

		this.input.addBinding(new MouseBinding(MouseButton.RIGHT, [InputState.PRESSED], () => this.startNewEdit(null)));

		this.input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.DOWN], () => {
			if (this.canvasMousePosition().equals(this.canvasMousePosition(this.input.mouseLastPosition))) return;
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

		this.input.addBinding(new MouseBinding(MouseButton.BACK, [InputState.PRESSED], () => this.undoEdit()));
		this.input.addBinding(new MouseBinding(MouseButton.FORWARD, [InputState.PRESSED], () => this.redoEdit()));
		this.input.addBinding(new KeyBinding('z', [KeyModifier.CONTROL], [InputState.PRESSED], () => {
			if ((this.pendingEdit instanceof TextEdit)) return;
			this.undoEdit();
		}));
		this.input.addBinding(new KeyBinding('z', [KeyModifier.CONTROL, KeyModifier.SHIFT], [InputState.PRESSED], () => {
			if ((this.pendingEdit instanceof TextEdit)) return;
			this.redoEdit();
		}));
		this.input.addBinding(new KeyBinding('y', [KeyModifier.CONTROL], [InputState.PRESSED], () => {
			if ((this.pendingEdit instanceof TextEdit)) return;
			this.redoEdit();
		}));

		this.input.addBinding(new KeyBinding('Delete', [], [InputState.PRESSED], () => {
			if ((this.pendingEdit instanceof TextEdit)) return;
			if (this.pendingEdit instanceof Select || this.pendingEdit instanceof Move)
				this.addEdit(new Clear(this.pendingEdit.points[0], this.pendingEdit.points[1]));
			this.pendingEdit = null;
			this.draw(DrawMode.PENDING_EDIT);
		}));
		this.input.addBinding(new KeyBinding('Escape', [], [InputState.PRESSED], () => {
			this.pendingEdit = null;
			this.draw(DrawMode.PENDING_EDIT);
		}));
		this.input.addBinding(new KeyBinding('Enter', [], [InputState.PRESSED], () => this.startNewEdit(null)));
		this.input.addBinding(new KeyBinding('s', [], [InputState.PRESSED], () => this.selectTool(Tool.SELECT)));
		this.input.addBinding(new KeyBinding('m', [], [InputState.PRESSED], () => this.selectTool(Tool.MOVE)));
		this.input.addBinding(new KeyBinding('l', [], [InputState.PRESSED], () => this.selectTool(Tool.LINE)));
		this.input.addBinding(new KeyBinding('k', [], [InputState.PRESSED], () => this.selectTool(Tool.STRAIGHT_LINE)));
		this.input.addBinding(new KeyBinding('r', [], [InputState.PRESSED], () => this.selectTool(Tool.RECT)));
		this.input.addBinding(new KeyBinding('f', [], [InputState.PRESSED], () => this.selectTool(Tool.FILL_RECT)));
		this.input.addBinding(new KeyBinding('e', [], [InputState.PRESSED], () => this.selectTool(Tool.CLEAR)));
		this.input.addBinding(new KeyBinding('t', [], [InputState.PRESSED], () => this.selectTool(Tool.TEXT)));
		this.input.addBinding(new KeyBinding('c', [], [InputState.PRESSED], () => this.selectTool(Tool.COLOR_PICKER)));
		this.input.addBinding(new KeyBinding('b', [], [InputState.PRESSED], () => this.selectTool(Tool.BUCKET_FILL)));

		([
			['ArrowUp', new Point(0, -1)],
			['ArrowRight', new Point(1, 0)],
			['ArrowDown', new Point(0, 1)],
			['ArrowLeft', new Point(-1, 0)],
		] as [string, Point][]).forEach(([key, delta]) => ([
			[[], 1],
			[[KeyModifier.CONTROL], 10],
			[[KeyModifier.SHIFT], 50],
		] as [KeyModifier[], number][]).forEach(([modifiers, scale]) => {
			this.input.addBinding(new KeyBinding(key, modifiers, [InputState.PRESSED, InputState.DOWN], () => this.movePendingEdit(delta.scale(scale))));
		}));

		document.addEventListener('keydown', e => {
			if (!(this.pendingEdit instanceof TextEdit)) return;
			if (e.key.length > 1) return;
			this.pendingEdit.text += e.key;
			this.draw(DrawMode.PENDING_EDIT);
		});

		document.addEventListener('copy', async e => {
			e.preventDefault();
			let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
			navigator.clipboard.write([new ClipboardItem({[blob.type]: blob})])
				.catch(e => console.warn('Failed to copy', e));
			// todo only copy selected region
			// todo allow cut
		});

		document.addEventListener('paste', e =>
			Paste.clipboardPixelArray(e)
				.then(pixelArray => this.startNewEdit(new Paste(this.canvasMousePosition(), pixelArray)))
				.catch(e => console.warn(e)));

		let loop = async () => {
			await this.drawOnScreen();
			this.input.tick();
			requestAnimationFrame(loop);
		};
		loop();
	}

	// handle mouse & keyboard events to create, start, resume edits

	private canvasMousePosition(mousePosition = this.input.mousePosition) {
		return this.camera.canvasToWorld(mousePosition.subtract(new Point(PANEL_SIZE, 0)).scale(1 / EDITOR_SIZE)).scale(PIXELS_SIZE).clamp(new Point(), new Point(PIXELS_SIZE - 1)).round;
	}

	selectTool(tool: Tool) {
		if ((this.pendingEdit instanceof TextEdit)) return;
		this.tool = tool;
		let edit = null;
		if (tool === Tool.MOVE && this.pendingEdit && this.pendingEdit.points.length >= 2)
			edit = new Move(this.pendingEdit.points[0], this.pendingEdit.points[1]);
		this.startNewEdit(edit);
	}

	movePendingEdit(delta: Point) {
		if (!this.pendingEdit) return;
		this.pendingEdit.setPoint(this.editCreator.selectedPoint, this.pendingEdit.points[this.editCreator.selectedPoint].add(delta));
		this.draw(DrawMode.PENDING_EDIT);
	}

	private handleInstantEdit() {
		this.color = this.pixels.get(this.canvasMousePosition());
	}

	private startNewEdit(edit: Edit | null = this.createPendingEdit(this.canvasMousePosition())) {
		let commit = this.pendingEdit?.validCommit();
		if (commit)
			this.addEdit(this.pendingEdit!);
		this.pendingEdit = edit;
		this.editCreator.selectedPoint = 0;
		this.draw(DrawMode.PENDING_EDIT);
	}

	private resumeEdit() {
		if (!this.pendingEdit) return;
		this.pendingEdit.setPoint(this.editCreator.selectedPoint, this.canvasMousePosition());
		this.draw(DrawMode.PENDING_EDIT);
	}

	private createPendingEdit(point: Point): Edit {
		switch (this.tool) {
			case Tool.SELECT:
				return new Select(point, point);
			case Tool.MOVE:
				return new Move(point, point);
			case Tool.LINE:
				return new Line(point, point, this.color);
			case Tool.STRAIGHT_LINE:
				return new StraightLine(point, point, this.color);
			case Tool.RECT:
				return new Rect(point, point, this.color);
			case Tool.FILL_RECT:
				return new FillRect(point, point, this.color);
			case Tool.CLEAR:
				return new Clear(point, point);
			case Tool.TEXT:
				return new TextEdit(point, 12, this.color);
			case Tool.COLOR_PICKER:
				throw new Error('createPendingEdit() should not handle COLOR_PICKER');
			case Tool.BUCKET_FILL:
				return new BucketFill(point, this.color);
			case Tool.PASTE:
				throw new Error('createPendingEdit() should not handle PASTE');
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

	// draw

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

		let srcStart = this.camera.canvasToWorld(new Point()).scale(PIXELS_SIZE).round;
		let srcEnd = this.camera.canvasToWorld(new Point(1)).scale(PIXELS_SIZE).round;
		let srcSize = srcEnd.subtract(srcStart);
		let srcDestCoordinates = [srcStart.x, srcStart.y, srcSize.x, srcSize.y, PANEL_SIZE, 0, EDITOR_SIZE, EDITOR_SIZE] as [number, number, number, number, number, number, number, number];

		this.ctx.imageSmoothingEnabled = srcSize.x > EDITOR_SIZE;
		this.ctx.fillStyle = '#f0f0f0';
		this.ctx.fillRect(0, 0, PANEL_SIZE + EDITOR_SIZE, EDITOR_SIZE);
		let committed = await createImageBitmap(this.pixels.imageData);
		this.ctx.drawImage(committed, ...srcDestCoordinates);
		let pending = await createImageBitmap(this.pendingPixels.imageData);
		this.ctx.drawImage(pending, ...srcDestCoordinates);
	}
}
