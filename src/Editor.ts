import {Color, NEAR_RANGE, Point, Tool} from './base.js';
import Camera from './Camera.js';
import {BucketFill, Clear, Edit, FillRect, Line, Move, Paste, Rect, Select, StraightLine, TextEdit} from './Edit.js';
import EditCreator, {DirtyMode} from './EditCreator.js';
import {Input, InputState, KeyBinding, KeyModifier, MouseBinding, MouseButton, MouseWheelBinding} from './Input.js';
import Pixels from './Pixels.js';
import Serializer from './Serializer.js';

const PIXELS_SIZE = 3000;
const EDITOR_SIZE = 1500;
// todo responsive
const PANEL_SIZE = 300;

export default class Editor {
	private readonly ctx: CanvasRenderingContext2D;
	private readonly pixels: Pixels;
	private readonly pendingPixels: Pixels;
	private readonly editCreator;
	private tool = Tool.SELECT;
	private color = Color.BLACK;
	private input: Input;
	private camera: Camera = new Camera(EDITOR_SIZE / PIXELS_SIZE);
	private readonly serializer: Serializer;

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
		this.input.addBinding(new MouseWheelBinding(false, () => this.camera.zoom(-1, this.mousePositionToCanvasPosition())));
		this.input.addBinding(new MouseWheelBinding(true, () => this.camera.zoom(1, this.mousePositionToCanvasPosition())));

		this.input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.PRESSED], () => {
			let point = this.mousePositionToPixelsPosition();
			if (this.tool === Tool.COLOR_PICKER) {
				this.color = this.pixels.get(point);
				return;
			}
			let controlPoint = this.editCreator.findControlPoint(point);
			if (controlPoint === -1)
				this.editCreator.startNewEdit(this.createEdit(point));
			else {
				this.editCreator.setControlPoint(controlPoint);
				this.editCreator.moveControlPointTo(point);
			}
		}));

		this.input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.DOWN, InputState.RELEASED], () => {
			if (this.input.mousePosition.equals(this.input.mouseLastPosition)) return;
			let point = this.mousePositionToPixelsPosition();
			if (this.tool === Tool.COLOR_PICKER) {
				this.color = this.pixels.get(point);
				return;
			}
			this.editCreator.moveControlPointTo(point);
		}));

		this.input.addBinding(new MouseBinding(MouseButton.RIGHT, [InputState.PRESSED], () =>
			this.editCreator.startNewEdit(null)));

		this.input.addBinding(new MouseBinding(MouseButton.BACK, [InputState.PRESSED], () => this.editCreator.undoEdit()));
		this.input.addBinding(new MouseBinding(MouseButton.FORWARD, [InputState.PRESSED], () => this.editCreator.redoEdit()));
		this.input.addBinding(new KeyBinding('z', [KeyModifier.CONTROL], [InputState.PRESSED], () => {
			if ((this.editCreator.pendingEdit instanceof TextEdit)) return;
			this.editCreator.undoEdit();
		}));
		this.input.addBinding(new KeyBinding('z', [KeyModifier.CONTROL, KeyModifier.SHIFT], [InputState.PRESSED], () => {
			if ((this.editCreator.pendingEdit instanceof TextEdit)) return;
			this.editCreator.redoEdit();
		}));
		this.input.addBinding(new KeyBinding('y', [KeyModifier.CONTROL], [InputState.PRESSED], () => {
			if ((this.editCreator.pendingEdit instanceof TextEdit)) return;
			this.editCreator.redoEdit();
		}));

		this.input.addBinding(new KeyBinding('Escape', [], [InputState.PRESSED], () => this.editCreator.undoPendingEdit()));
		this.input.addBinding(new KeyBinding('Enter', [], [InputState.PRESSED], () => this.editCreator.startNewEdit(null)));
		this.input.addBinding(new KeyBinding('s', [], [InputState.PRESSED], () => this.selectTool(Tool.SELECT)));
		this.input.addBinding(new KeyBinding('m', [], [InputState.PRESSED], () => this.selectTool(Tool.MOVE)));
		this.input.addBinding(new KeyBinding('l', [], [InputState.PRESSED], () => this.selectTool(Tool.LINE)));
		this.input.addBinding(new KeyBinding('k', [], [InputState.PRESSED], () => this.selectTool(Tool.STRAIGHT_LINE)));
		this.input.addBinding(new KeyBinding('r', [], [InputState.PRESSED], () => this.selectTool(Tool.RECT)));
		this.input.addBinding(new KeyBinding('f', [], [InputState.PRESSED], () => this.selectTool(Tool.FILL_RECT)));
		this.input.addBinding(new KeyBinding('e', [], [InputState.PRESSED], () => this.selectTool(Tool.CLEAR)));
		this.input.addBinding(new KeyBinding('Delete', [], [InputState.PRESSED], () => this.selectTool(Tool.CLEAR)));
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
			this.input.addBinding(new KeyBinding(key, modifiers, [InputState.PRESSED, InputState.DOWN], () => this.editCreator.moveControlPointBy(delta.scale(scale))));
		}));

		document.addEventListener('keydown', e => {
			if (!(this.editCreator.pendingEdit instanceof TextEdit)) return;
			if (e.key === 'Delete' || e.key === 'Backspace') {
				this.editCreator.pendingEdit.text = this.editCreator.pendingEdit.text.slice(0, -1);
				this.editCreator.maxDirty = DirtyMode.PENDING_EDIT;
			} else if (e.key.length === 1) {
				this.editCreator.pendingEdit.text += e.key;
				this.editCreator.maxDirty = DirtyMode.PENDING_EDIT;
			}
		});

		document.addEventListener('copy', async e => {
			e.preventDefault();
			let blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
			if (!blob)
				console.warn('Copy failed to get blob');
			else
				navigator.clipboard.write([new ClipboardItem({[blob.type]: blob})])
					.catch(e => console.warn('Copy failed to write to clipboard', e));
			// todo only copy selected region
			// todo allow cut
		});

		document.addEventListener('paste', e =>
			Paste.clipboardPixelArray(e)
				.then(pixelArray => this.editCreator.startNewEdit(new Paste(this.mousePositionToPixelsPosition(), pixelArray)))
				.catch(e => console.warn('Paste failed:', e)));

		this.serializer = new Serializer({
			EditCreator,
			Edit,
			Select,
			Move,
			Line,
			StraightLine,
			Rect,
			FillRect,
			Clear,
			TextEdit,
			BucketFill,
			Paste,
			Point,
			Color,
			Uint8ClampedArray: null,
		});
		try {
			let saveStr = localStorage.getItem('save');
			if (!saveStr) throw new Error('empty local storage');
			let saveObj = JSON.parse(saveStr);
			this.editCreator = this.serializer.deserialize(saveObj);
		} catch (e) {
			console.warn('Failed to restore save', e);
			this.editCreator = new EditCreator();
		}

		let loop = async () => {
			await this.drawLoop();
			this.input.tick();
			requestAnimationFrame(loop);
		};
		loop();
	}

	save() {
		localStorage.setItem('save', JSON.stringify(this.serializer.serialize(this.editCreator)));
	}

	// handle mouse & keyboard events to create, start, resume edits

	private mousePositionToCanvasPosition(mousePosition = this.input.mousePosition) {
		// return [0,1) canvas position
		return mousePosition.subtract(new Point(PANEL_SIZE, 0)).scale(1 / EDITOR_SIZE);
	}

	private mousePositionToWorldPosition(mousePosition = this.input.mousePosition) {
		// return [0, 1) world position
		return this.camera.canvasToWorld(this.mousePositionToCanvasPosition(mousePosition));
	}

	private mousePositionToPixelsPosition(mousePosition = this.input.mousePosition) {
		// return [0, PIXELS_SIZE) pixel position
		return this.mousePositionToWorldPosition(mousePosition).scale(PIXELS_SIZE).clamp(new Point(), new Point(PIXELS_SIZE - 1)).round;
	}

	selectTool(tool: Tool) {
		if ((this.editCreator.pendingEdit instanceof TextEdit)) return;
		this.tool = tool;
		let edit = null;
		if (this.editCreator.pendingEdit && this.editCreator.pendingEdit.points.length >= 2)
			if (tool === Tool.MOVE)
				edit = new Move(this.editCreator.pendingEdit.points[0], this.editCreator.pendingEdit.points[1]);
			else if (tool === Tool.CLEAR)
				edit = new Clear(this.editCreator.pendingEdit.points[0], this.editCreator.pendingEdit.points[1]);
		this.editCreator.startNewEdit(edit);
	}

	private createEdit(point: Point): Edit {
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
				return new TextEdit(point, this.color);
			case Tool.COLOR_PICKER:
				throw new Error('createEdit() should not handle COLOR_PICKER');
			case Tool.BUCKET_FILL:
				return new BucketFill(point, this.color);
			case Tool.PASTE:
				throw new Error('createEdit() should not handle PASTE');
		}
	}

	private async drawLoop() {
		if (this.editCreator.dirty === DirtyMode.ALL_EDITS) {
			this.pixels.clear();
			this.editCreator.edits.forEach(edit => edit.draw(this.pixels, this.pixels, false));
		} else if (this.editCreator.dirty === DirtyMode.LAST_EDIT)
			this.editCreator.edits.at(-1)!.draw(this.pixels, this.pixels, false);

		if (this.editCreator.dirty !== DirtyMode.NONE) {
			this.save();
			this.pendingPixels.clear();
			if (this.editCreator.pendingEdit) {
				this.editCreator.pendingEdit.draw(this.pendingPixels, this.pixels, true);
				([
					...this.editCreator.pendingEdit.points.map(p => [p, NEAR_RANGE / 2]),
					[this.editCreator.pendingEdit.points[this.editCreator.controlPoint], NEAR_RANGE / 4],
				] as [Point, number][]).forEach(([p, r]) => {
					let rp = new Point(r).round;
					new Select(p.subtract(rp), p.add(rp)).draw(this.pendingPixels, this.pixels, true);
				});
			}
		}

		this.editCreator.dirty = DirtyMode.NONE;

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
