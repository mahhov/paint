import {Color, NEAR_RANGE, Point, Tool} from './base.js';
import Camera from './Camera.js';
import Clipboard from './Clipboard.js';
import {BucketFill, Clear, Edit, FillRect, Line, Move, Paste, Rect, Select, StraightLine, TextEdit} from './Edit.js';
import EditCreator, {DirtyMode} from './EditCreator.js';
import {Input, InputState, KeyBinding, KeyModifier, MouseBinding, MouseButton, MouseWheelBinding} from './Input.js';
import Pixels from './Pixels.js';
import Serializer from './Serializer.js';
import Storage from './Storage.js';

const PIXELS_SIZE = 3000;
const PANEL_SIZE = 300;

export default class Editor {
	private readonly ctx: CanvasRenderingContext2D;
	private readonly pixels: Pixels;
	private readonly pendingPixels: Pixels;
	private editCreator: EditCreator;
	private tool = Tool.SELECT;
	private color = Color.BLACK;
	private input: Input;
	private camera!: Camera;
	editorWidth!: number;
	editorHeight!: number;
	editorSize!: number;

	constructor(canvas: HTMLCanvasElement, editCreator: EditCreator) {
		this.editCreator = editCreator;

		this.ctx = canvas.getContext('2d')!;
		this.pixels = new Pixels(PIXELS_SIZE, PIXELS_SIZE, this.ctx, Color.WHITE);
		this.pendingPixels = new Pixels(PIXELS_SIZE, PIXELS_SIZE, this.ctx, Color.CLEAR);
		this.input = new Input(canvas);

		this.input.addBinding(new MouseBinding(MouseButton.MIDDLE, [InputState.DOWN], () => {
			let delta = this.input.mouseLastPosition.subtract(this.input.mousePosition);
			this.camera.move(delta.scale(1 / this.editorSize));
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
		this.input.addBinding(new KeyBinding('Tab', [], [InputState.PRESSED], () => this.editCreator.setNextControlPoint()));

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

		this.input.addBinding(new KeyBinding('s', [KeyModifier.CONTROL], [InputState.PRESSED], () => this.save()));
		this.input.addBinding(new KeyBinding('e', [KeyModifier.CONTROL], [InputState.PRESSED], () => {
			this.editCreator = new EditCreator();
			this.editCreator.maxDirty = DirtyMode.ALL_EDITS;
		}));

		([
			['ArrowUp', new Point(0, -1)],
			['ArrowRight', new Point(1, 0)],
			['ArrowDown', new Point(0, 1)],
			['ArrowLeft', new Point(-1, 0)],
		] as [string, Point][]).forEach(([key, delta]) => ([
			[[], [InputState.PRESSED], 1],
			[[KeyModifier.CONTROL], [InputState.PRESSED, InputState.DOWN], 10],
			[[KeyModifier.SHIFT], [InputState.PRESSED, InputState.DOWN], 50],
		] as [KeyModifier[], InputState[], number][]).forEach(([modifiers, states, scale]) => {
			this.input.addBinding(new KeyBinding(key, modifiers, states, () => this.editCreator.moveControlPointBy(delta.scale(scale))));
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

		document.addEventListener('copy', () => this.copy());
		document.addEventListener('cut', () => {
			this.copy();
			this.selectTool(Tool.CLEAR);
		});
		document.addEventListener('paste', e => this.paste(e));

		window.addEventListener('resize', () => this.resizeCanvas());
		this.resizeCanvas();

		this.loop();
	}

	static async load(canvas: HTMLCanvasElement): Promise<Editor> {
		console.time('load read');
		let editorCreatorPromise: Promise<EditCreator> = Storage.read('save')
			.then(saveObj => {
				console.timeEnd('load read');
				if (!saveObj) throw new Error('empty storage');
				console.time('load deserialize');
				let editorCreator = Serializer.deserialize(saveObj);
				console.timeEnd('load deserialize');
				editorCreator.maxDirty = DirtyMode.ALL_EDITS;
				return editorCreator;
			})
			.catch(e => {
				console.warn('Failed to restore save', e);
				return new EditCreator();
			});

		return new Editor(canvas, await editorCreatorPromise);
	}

	private save() {
		console.time('save serialize');
		Serializer.serialize(this.editCreator);
		console.timeEnd('save serialize');

		console.time('save storage');
		Storage.write('save', Serializer.serialize(this.editCreator))
			.then(() => console.timeEnd('save storage'))
			.catch(e => console.warn('Failed to save:', e));
	}

	private async copy() {
		let region =
			(this.editCreator.pendingEdit instanceof Select || this.editCreator.pendingEdit instanceof Move) &&
			!this.editCreator.pendingEdit.points[0].equals(this.editCreator.pendingEdit.points[1]);
		let start = region ? this.editCreator.pendingEdit!.points[0] : new Point();
		let end = region ? this.editCreator.pendingEdit!.points[1] : this.pixels.size;
		Clipboard.copyCanvasRegion([await this.pixels.getImage(), await this.pendingPixels.getImage()], start, end);
	}

	private paste(e: ClipboardEvent) {
		let str = Clipboard.clipboardToText(e);
		if (str) {
			if (!(this.editCreator.pendingEdit instanceof TextEdit))
				this.editCreator.startNewEdit(new TextEdit(this.mousePositionToPixelsPosition(), this.color));
			(this.editCreator.pendingEdit as TextEdit).text += str;
			this.tool = Tool.TEXT;
			return;
		}

		Clipboard.clipboardToPixelArray(e)
			.then(int8Array => this.editCreator.startNewEdit(new Paste(this.mousePositionToPixelsPosition(), int8Array)))
			.catch(e => console.warn('Paste failed:', e));
	}

	private resizeCanvas() {
		this.editorWidth = Math.floor(window.innerWidth - PANEL_SIZE);
		this.editorHeight = Math.floor(window.innerHeight);
		this.editorSize = Math.min(this.editorWidth, this.editorHeight);
		this.ctx.canvas.width = this.editorWidth + PANEL_SIZE;
		this.ctx.canvas.height = this.editorHeight;
		this.camera = new Camera(this.editorSize / PIXELS_SIZE);
	}

	private async loop() {
		await this.drawLoop();
		this.input.tick();
		requestAnimationFrame(() => this.loop());
	}

	private mousePositionToCanvasPosition(mousePosition = this.input.mousePosition) {
		// return [0,1) canvas position
		return mousePosition.subtract(new Point(PANEL_SIZE, 0)).scale(1 / this.editorSize);
	}

	private mousePositionToWorldPosition(mousePosition = this.input.mousePosition) {
		// return [0, 1) world position
		return this.camera.canvasToWorld(this.mousePositionToCanvasPosition(mousePosition));
	}

	private mousePositionToPixelsPosition(mousePosition = this.input.mousePosition) {
		// return [0, PIXELS_SIZE) pixel position
		return this.mousePositionToWorldPosition(mousePosition).scale(PIXELS_SIZE).clamp(new Point(), new Point(PIXELS_SIZE - 1)).round;
	}

	private selectTool(tool: Tool) {
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

		// Can't early exit in case of NONE, because camera may have moved. Besides, the following isn't expensive enough to warrant a dirt

		this.editCreator.dirty = DirtyMode.NONE;

		let srcStart = this.camera.canvasToWorld(new Point()).scale(PIXELS_SIZE).round;
		let srcEnd = this.camera.canvasToWorld(new Point(this.editorWidth, this.editorHeight).scale(1 / this.editorSize)).scale(PIXELS_SIZE).round;
		let srcSize = srcEnd.subtract(srcStart);
		let srcDestCoordinates = [srcStart.x, srcStart.y, srcSize.x, srcSize.y, PANEL_SIZE, 0, this.editorWidth, this.editorHeight] as [number, number, number, number, number, number, number, number];

		this.ctx.imageSmoothingEnabled = srcSize.x > this.editorSize;
		this.ctx.fillStyle = '#f0f0f0';
		this.ctx.fillRect(0, 0, PANEL_SIZE + this.editorWidth, this.editorHeight);
		this.ctx.drawImage(await this.pixels.getImage(), ...srcDestCoordinates);
		this.ctx.drawImage(await this.pendingPixels.getImage(), ...srcDestCoordinates);
	}
}
