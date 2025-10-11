import Camera from './Camera.js';
import Clipboard from './Clipboard.js';
import {BucketFill, Clear, Edit, FillRect, GridLine, Line, Move, Paste, Pen, Rect, Select, StraightLine, TextEdit} from './Edit.js';
import EditCreator, {DirtyMode} from './EditCreator.js';
import {Input, InputState, KeyBinding, KeyModifier, MouseBinding, MouseButton, MouseWheelBinding} from './Input.js';
import Pixels from './Pixels.js';
import Serializer from './Serializer.js';
import Storage from './Storage.js';
import UiPanel from './UiPanel.js';
import Color from './util/Color.js';
import Debouncer from './util/Debouncer.js';
import Point from './util/Point.js';
import {Tool} from './util/util.js';

const PIXELS_SIZE = 5000;
const PANEL_SIZE = 153;

export default class Editor {
	private readonly ctx: CanvasRenderingContext2D;
	private readonly pixels: Pixels;
	private readonly pendingPixels: Pixels;
	private readonly panelPixels: Pixels;
	private editCreator: EditCreator;
	private tool = Tool.SELECT;
	private color = Color.LIGHT_GRAY;
	private input: Input;
	private readonly panel;
	private camera!: Camera;
	private editorWidth!: number;
	private editorHeight!: number;
	private editorSize!: number;
	private readonly saveDebouncer: Debouncer;

	constructor(canvas: HTMLCanvasElement, editCreator: EditCreator) {
		this.editCreator = editCreator;

		this.ctx = canvas.getContext('2d')!;
		this.pixels = new Pixels(PIXELS_SIZE, PIXELS_SIZE, this.ctx, Color.WHITE, true);
		this.pendingPixels = new Pixels(PIXELS_SIZE, PIXELS_SIZE, this.ctx, Color.CLEAR, false);
		this.panelPixels = new Pixels(PANEL_SIZE, 1500, this.ctx, Color.CLEAR, false);
		this.input = new Input(canvas);
		this.panel = new UiPanel(this.panelPixels, this.input);

		this.panel.addListener('tool', (tool: Tool) => this.selectTool(tool));
		this.panel.addListener('color', (color: Color) => this.setColor(color));
		this.panel.addListener('undo', () => this.editCreator.undoEdit());
		this.panel.addListener('redo', () => this.editCreator.redoEdit());
		this.panel.addListener('camera-reset', () => this.cameraReset());
		this.panel.addListener('start-new', () => this.startNew());
		this.panel.addListener('select-edit', i => this.editCreator.selectEdit(i));
		this.panel.addListener('remove-edit', i => this.editCreator.removeEdit(i));

		this.input.addBinding(new MouseBinding(MouseButton.MIDDLE, [InputState.DOWN], () => {
			let delta = this.input.mouseLastPosition.subtract(this.input.mousePosition);
			this.camera.move(delta.scale(1 / this.editorSize));
		}));
		this.input.addBinding(new MouseWheelBinding(false, () => this.zoom(1)));
		this.input.addBinding(new MouseWheelBinding(true, () => this.zoom(-1)));

		this.input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.PRESSED], () => {
			let point = this.mousePositionToPixelsPosition();
			if (!point) return;
			if (this.tool === Tool.COLOR_PICKER) {
				this.setColor(this.pixels.get(point));
				return;
			}
			let controlPoint = this.editCreator.findControlPoint(point, this.editCreatorControlSize);
			if (controlPoint === -1)
				this.editCreator.startNewEdit(this.createEdit(point));
			else {
				this.editCreator.setControlPoint(controlPoint);
				this.editCreator.moveControlPointTo(point, false);
			}
			this.editModified();
		}));

		this.input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.DOWN], () => {
			if (this.input.mousePosition.equals(this.input.mouseLastPosition)) return;
			let downPoint = this.mousePositionToPixelsPosition(this.input.mouseDownPosition);
			if (!downPoint) return;
			let point = this.mousePositionToPixelsPosition();
			if (!point) return;
			if (this.tool === Tool.COLOR_PICKER) {
				this.setColor(this.pixels.get(point));
				return;
			}
			this.editCreator.moveControlPointTo(point, this.input.shiftDown);
			this.editModified();
		}));

		this.input.addBinding(new MouseBinding(MouseButton.RIGHT, [InputState.RELEASED], () => {
			let downPoint = this.mousePositionToPixelsPosition(this.input.mouseDownPosition);
			if (!downPoint) return;
			let point = this.mousePositionToPixelsPosition();
			if (!point) return;
			let owner = this.pixels.getOwner(downPoint, point);
			if (owner >= 0)
				this.editCreator.selectEdit(owner);
			else
				this.editCreator.selectLastEdit();
		}));

		this.input.addBinding(new MouseBinding(MouseButton.BACK, [InputState.PRESSED], () => this.editCreator.undoEdit()));
		this.input.addBinding(new MouseBinding(MouseButton.FORWARD, [InputState.PRESSED], () => this.editCreator.redoEdit()));
		this.input.addBinding(new KeyBinding('z', [KeyModifier.CONTROL], [InputState.PRESSED], () => {
			this.editCreator.undoEdit();
		}));
		this.input.addBinding(new KeyBinding('z', [KeyModifier.CONTROL, KeyModifier.SHIFT], [InputState.PRESSED], () => {
			this.editCreator.redoEdit();
		}));
		this.input.addBinding(new KeyBinding('y', [KeyModifier.CONTROL], [InputState.PRESSED], () => {
			this.editCreator.redoEdit();
		}));

		this.input.addBinding(new KeyBinding('escape', [], [InputState.PRESSED], () => this.editCreator.undoPendingEdit()));
		this.input.addBinding(new KeyBinding('enter', [], [InputState.PRESSED], () => this.editCreator.startNewEdit(null)));
		this.input.addBinding(new KeyBinding('tab', [], [InputState.PRESSED], () => this.editCreator.setNextControlPoint()));
		this.input.addBinding(new KeyBinding('a', [KeyModifier.CONTROL], [InputState.PRESSED], () => {
			this.selectTool(Tool.SELECT);
			this.editCreator.startNewEdit(new Select(Point.P0, this.pixels.size));
		}));

		this.input.addBinding(new KeyBinding('s', [], [InputState.PRESSED], () => this.keySelectTool(Tool.SELECT)));
		this.input.addBinding(new KeyBinding('m', [], [InputState.PRESSED], () => this.keySelectTool(Tool.MOVE)));
		this.input.addBinding(new KeyBinding(' ', [], [InputState.PRESSED], () => this.keySelectTool(Tool.MOVE)));
		this.input.addBinding(new KeyBinding('l', [], [InputState.PRESSED], () => this.keySelectTool(Tool.LINE)));
		this.input.addBinding(new KeyBinding('k', [], [InputState.PRESSED], () => this.keySelectTool(Tool.STRAIGHT_LINE)));
		this.input.addBinding(new KeyBinding('g', [], [InputState.PRESSED], () => this.keySelectTool(Tool.GRID_LINE)));
		this.input.addBinding(new KeyBinding('r', [], [InputState.PRESSED], () => this.keySelectTool(Tool.RECT)));
		this.input.addBinding(new KeyBinding('f', [], [InputState.PRESSED], () => this.keySelectTool(Tool.FILL_RECT)));
		this.input.addBinding(new KeyBinding('e', [], [InputState.PRESSED], () => this.keySelectTool(Tool.CLEAR)));
		this.input.addBinding(new KeyBinding('delete', [], [InputState.PRESSED], () => this.keySelectTool(Tool.CLEAR)));
		this.input.addBinding(new KeyBinding('t', [], [InputState.PRESSED], () => this.keySelectTool(Tool.TEXT)));
		this.input.addBinding(new KeyBinding('c', [], [InputState.PRESSED], () => this.keySelectTool(Tool.COLOR_PICKER)));
		this.input.addBinding(new KeyBinding('b', [], [InputState.PRESSED], () => this.keySelectTool(Tool.BUCKET_FILL)));
		this.input.addBinding(new KeyBinding('p', [], [InputState.PRESSED], () => this.keySelectTool(Tool.PEN)));

		for (let i = 0; i <= 9; i++) {
			let colorIndex = (i + 9) % 10;
			this.input.addBinding(new KeyBinding(String(i), [], [InputState.PRESSED], () => {
				if (this.editCreator.pendingEdit instanceof TextEdit) return;
				this.setColor(this.panel.presetColors[colorIndex]);
			}));
			this.input.addBinding(new KeyBinding(String(i), [KeyModifier.CONTROL], [InputState.PRESSED], () => this.setColor(this.panel.recentColors[colorIndex])));
		}

		this.input.addBinding(new KeyBinding('0', [KeyModifier.CONTROL], [InputState.PRESSED], () => this.cameraReset()));

		this.input.addBinding(new KeyBinding('e', [KeyModifier.CONTROL], [InputState.PRESSED], () => this.startNew()));

		([
			['ArrowUp', new Point(0, -1)],
			['ArrowRight', new Point(1, 0)],
			['ArrowDown', new Point(0, 1)],
			['ArrowLeft', new Point(-1, 0)],
		] as [string, Point][]).forEach(([key, delta]) => ([
			[[], [InputState.DOWN], 1],
			[[KeyModifier.CONTROL], [InputState.PRESSED], 1],
			[[KeyModifier.SHIFT], [InputState.DOWN], 25],
		] as [KeyModifier[], InputState[], number][]).forEach(([modifiers, states, scale]) => {
			this.input.addBinding(new KeyBinding(key, modifiers, states, () => {
				this.editCreator.moveControlPointBy(delta.scale(scale));
				this.editModified();
			}));
		}));

		document.addEventListener('keydown', e => {
			if (!(this.editCreator.pendingEdit instanceof TextEdit)) return;
			// todo text cursor & selection & undo/redo typing
			if (e.key === 'Delete' || e.key === 'Backspace') {
				if (e.ctrlKey) {
					let str = this.editCreator.pendingEdit.text.trim();
					this.editCreator.pendingEdit.text = str.substring(0, str.lastIndexOf(' ') + 1);
				} else
					this.editCreator.pendingEdit.text = this.editCreator.pendingEdit.text.slice(0, -1);
				this.editModified();
				this.editCreator.maxDirty = DirtyMode.PENDING_EDIT;
			} else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
				this.editCreator.pendingEdit.text += e.key;
				this.editModified();
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
		window.addEventListener('mouseup', e => e.preventDefault());
		window.addEventListener('wheel', e => e.preventDefault(), {passive: false});

		this.resizeCanvas();

		this.panel.setTool(this.tool);
		this.panel.setColor(this.color);
		this.panel.setZoom(this.camera.zoomPercent);
		this.panel.setEditList(this.editList);

		this.saveDebouncer = new Debouncer(() =>
			Storage.write('save', Serializer.serialize(this.editCreator))
				.catch(e => console.warn('Failed to save:', e)));

		this.loop();
	}

	static async load(canvas: HTMLCanvasElement): Promise<Editor> {
		console.time('load read');
		let editCreatorPromise: Promise<EditCreator> = Storage.read('save')
			.then(saveObj => {
				console.timeEnd('load read');
				if (!saveObj) throw new Error('empty storage');
				console.time('load deserialize');
				let editCreator: EditCreator = Serializer.deserialize(saveObj);
				console.timeEnd('load deserialize');
				editCreator.edits = editCreator.edits.filter(edit => edit instanceof Edit);
				editCreator.postEdits = editCreator.postEdits.filter(edit => edit instanceof Edit);
				editCreator.redoEdits = editCreator.redoEdits.filter(edit => edit instanceof Edit);
				if (!(editCreator.pendingEdit instanceof Edit)) editCreator.pendingEdit = null;
				editCreator.maxDirty = DirtyMode.ALL_EDITS;
				return editCreator;
			})
			.catch(e => {
				console.warn('Failed to restore save', e);
				return new EditCreator();
			});

		return new Editor(canvas, await editCreatorPromise);
	}

	private startNew() {
		this.editCreator = new EditCreator();
		this.editCreator.maxDirty = DirtyMode.ALL_EDITS;
	}

	private async copy() {
		let region = this.editCreator.pendingEdit instanceof Select || this.editCreator.pendingEdit instanceof Move;
		let start = region ? this.editCreator.pendingEdit!.points[0] : Point.P0;
		let end = region ? this.editCreator.pendingEdit!.points[1] : this.pixels.size;
		this.editCreator.startNewEdit(null);
		this.flushEditCreatorToPixels();
		Clipboard.copyCanvasRegion(await this.pixels.getImage(), start, end);
	}

	private paste(e: ClipboardEvent) {
		let point = this.mousePositionToPixelsPosition();
		if (!point) return;

		if (this.tool === Tool.COLOR_PICKER)
			this.selectTool(Tool.SELECT);

		let str = Clipboard.clipboardToText(e);
		if (str) {
			if (!(this.editCreator.pendingEdit instanceof TextEdit))
				this.editCreator.startNewEdit(new TextEdit(point, this.color, ''));
			(this.editCreator.pendingEdit as TextEdit).text += str;
			this.tool = Tool.TEXT;
			return;
		}

		Clipboard.clipboardToPixelArray(e)
			.then(int8Array => this.editCreator.startNewEdit(new Paste(point, int8Array)))
			.catch(e => console.warn('Paste failed:', e));
	}

	private resizeCanvas() {
		this.editorWidth = Math.floor(window.innerWidth - PANEL_SIZE);
		this.editorHeight = Math.floor(window.innerHeight);
		this.editorSize = Math.min(this.editorWidth, this.editorHeight);
		this.ctx.canvas.width = this.editorWidth + PANEL_SIZE;
		this.ctx.canvas.height = this.editorHeight;
		this.ctx.fillStyle = '#f0f0f0';
		this.cameraReset();
	}

	private cameraReset() {
		this.camera = new Camera(this.editorSize / PIXELS_SIZE);
		this.panel.setZoom(this.camera.zoomPercent);
	}

	private keySelectTool(tool: Tool) {
		if (this.editCreator.pendingEdit instanceof TextEdit) return;
		this.selectTool(tool);
	}

	private selectTool(tool: Tool) {
		this.tool = tool;
		this.panel.setTool(tool);
		let edit = null;
		if (this.editCreator.pendingEdit && this.editCreator.pendingEdit.points.length >= 2)
			if ([Tool.MOVE, Tool.GRID_LINE, Tool.CLEAR].includes(tool)) {
				edit = this.createEdit(this.editCreator.pendingEdit.points[0]);
				edit.setPoint(1, this.editCreator.pendingEdit.points[1], false);
			}
		this.editCreator.startNewEdit(edit);
	}

	private setColor(color: Color) {
		this.color = color;
		this.editCreator.setColor(color);
		this.panel.setColor(color);
	}

	private get editCreatorControlSize() {
		return 2000 / this.camera.zoomPercent;
	}

	private get editList(): [string, 0 | 1 | 2][] {
		return [
			this.editCreator.edits.map(edit => [edit.constructor.name, 0] as [string, 0 | 1 | 2]),
			this.editCreator.pendingEdit ? [([this.editCreator.pendingEdit.constructor.name, 1] as [string, 0 | 1 | 2])] : [],
			this.editCreator.postEdits.map(edit => [edit.constructor.name, 2] as [string, 0 | 1 | 2]),
		].flat();
	}

	private zoom(delta: number) {
		let canvasPosition = this.mousePositionToCanvasPosition();
		if (canvasPosition) {
			this.camera.zoom(delta, canvasPosition);
			this.editCreator.maxDirty = DirtyMode.PENDING_EDIT;
			this.panel.setZoom(this.camera.zoomPercent);
		}
	}

	private editModified() {
		if (!this.editCreator.pendingEdit) return;

		let status = '';
		if (this.editCreator.pendingEdit.points.length >= 2) {
			let delta = this.editCreator.pendingEdit.points[1].subtract(this.editCreator.pendingEdit.points[0]);
			status = `[${Math.abs(delta.x) + 1}, ${Math.abs(delta.y) + 1}]`;
		}
		this.panel.setStatus(status);

		if ('color' in this.editCreator.pendingEdit!)
			this.panel.setColorUsed(this.color);
	}

	private async loop() {
		await this.drawLoop();
		this.input.tick();
		requestAnimationFrame(() => this.loop());
	}

	private mousePositionToCanvasPosition(mousePosition = this.input.mousePosition) {
		// return [0,1) canvas position
		let offset = mousePosition.subtract(new Point(PANEL_SIZE, 0));
		return offset.x >= 0 ? offset.scale(1 / this.editorSize) : null;
	}

	private mousePositionToWorldPosition(mousePosition = this.input.mousePosition) {
		// return [0, 1) world position
		let canvasPosition = this.mousePositionToCanvasPosition(mousePosition);
		return canvasPosition ? this.camera.canvasToWorld(canvasPosition) : null;
	}

	private mousePositionToPixelsPosition(mousePosition = this.input.mousePosition) {
		// return [0, PIXELS_SIZE) pixel position
		let worldPosition = this.mousePositionToWorldPosition(mousePosition);
		return worldPosition ? worldPosition.scale(PIXELS_SIZE).clamp(Point.P0, new Point(PIXELS_SIZE - 1)).round : null;
	}

	private createEdit(point: Point): Edit {
		switch (this.tool) {
			case Tool.SELECT:
				return new Select(point, point);
			case Tool.MOVE:
				return new Move(point, point, Point.P0);
			case Tool.LINE:
				return new Line(point, point, this.color);
			case Tool.STRAIGHT_LINE:
				return new StraightLine(point, point, this.color);
			case Tool.GRID_LINE:
				return new GridLine(point, point, Point.P0, this.color);
			case Tool.RECT:
				return new Rect(point, point, this.color);
			case Tool.FILL_RECT:
				return new FillRect(point, point, this.color);
			case Tool.CLEAR:
				return new Clear(point, point);
			case Tool.TEXT:
				return new TextEdit(point, this.color, '');
			case Tool.COLOR_PICKER:
				throw new Error('createEdit() should not handle COLOR_PICKER');
			case Tool.BUCKET_FILL:
				return new BucketFill(point, this.color);
			case Tool.PASTE:
				throw new Error('createEdit() should not handle PASTE');
			case Tool.PEN:
				return new Pen(point, this.color);
		}
	}

	private flushEditCreatorToPixels() {
		// todo only update on edit list change
		this.panel.setEditList(this.editList);
		this.panel.draw();

		if (this.editCreator.dirty === DirtyMode.NONE) {
			this.saveDebouncer.allow();
			return;
		}

		this.saveDebouncer.queue();

		if (this.editCreator.dirty === DirtyMode.ALL_EDITS) {
			this.pixels.clear();
			this.editCreator.edits.forEach((edit, i) => edit.draw(this.pixels, this.pixels, false, i));
		}

		if (this.editCreator.dirty === DirtyMode.LAST_EDIT)
			this.editCreator.edits.at(-1)!.draw(this.pixels, this.pixels, false, this.editCreator.edits.length - 1);

		console.time('draw');
		this.pendingPixels.clear();
		if (this.editCreator.pendingEdit) {
			this.editCreator.pendingEdit.draw(this.pendingPixels, this.pixels, true, 0);
			([
				...this.editCreator.pendingEdit.points.map(p => [p, this.editCreatorControlSize / 2]),
				[this.editCreator.pendingEdit.points[this.editCreator.controlPoint], this.editCreatorControlSize / 4],
			] as [Point, number][]).forEach(([p, r]) => {
				let rp = new Point(r).round;
				new Select(p.subtract(rp), p.add(rp)).draw(this.pendingPixels, this.pixels, true, 0);
			});
		}
		console.timeEnd('draw');

		this.editCreator.dirty = DirtyMode.NONE;
	}

	private async drawLoop() {
		this.flushEditCreatorToPixels();

		let srcStart = this.camera.canvasToWorld(Point.P0).scale(PIXELS_SIZE).round;
		let srcEnd = this.camera.canvasToWorld(new Point(this.editorWidth, this.editorHeight).scale(1 / this.editorSize)).scale(PIXELS_SIZE).round;
		let srcSize = srcEnd.subtract(srcStart);
		let srcDestCoordinates = [srcStart.x, srcStart.y, srcSize.x, srcSize.y, PANEL_SIZE, 0, this.editorWidth, this.editorHeight] as [number, number, number, number, number, number, number, number];

		this.ctx.imageSmoothingEnabled = srcSize.x > this.editorSize;
		this.ctx.fillRect(0, 0, PANEL_SIZE + this.editorWidth, this.editorHeight);
		this.ctx.drawImage(this.pixels.getImage(), ...srcDestCoordinates);
		this.ctx.drawImage(this.pendingPixels.getImage(), ...srcDestCoordinates);
		this.ctx.drawImage(this.panelPixels.getImage(), 0, 0);
	}
}

// todo reorder methods
