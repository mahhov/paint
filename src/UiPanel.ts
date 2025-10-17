import {Dot, DrawMode, Edit, FillRect, FixedTextEdit, Paste, Rect} from './Edit.js';
import {colorIcon, IconInstruction, icons, iconToEdits} from './icons.js';
import {Input, InputState, MouseBinding, MouseButton} from './Input.js';
import Pixels from './Pixels.js';
import Color from './util/Color.js';
import Emitter, {EventMap} from './util/Emitter.js';
import Point from './util/Point.js';
import {A, clamp, getIndex, round, Tool} from './util/util.js';

class UiElement<T extends EventMap = {}> extends Emitter<T> {
	protected position = Point.P0;
	protected size = Point.P0;
	protected defaultTooltip = '';

	setPosition(position: Point) {
		this.position = position;
		return this;
	}

	setSize(size: Point) {
		this.size = size;
		return this;
	}

	setTooltip(tooltip: string) {
		this.defaultTooltip = tooltip;
		return this;
	}

	draw(pixels: Pixels) {
		this.edits(pixels.width).forEach(edit => edit.draw(pixels, pixels, DrawMode.NORMAL, 0));
	}

	protected bgRect(color: Color) {
		return new FillRect(this.position, this.position.add(this.size), color);
	}

	protected edits(pixelsWidth: number): Edit[] {
		return [
			this.bgRect(Color.WHITE),
			new Rect(this.position, this.position.add(this.size), 0, Color.DARK_GRAY),
		];
	}

	onMousePress(point: Point) {}

	onRightMousePress(point: Point) {}

	onMouseDown(point: Point) {}

	onMouseUp(point: Point) {}

	containsPoint(point: Point) {
		return point.atLeast(this.position) && point.atMost(this.position.add(this.size));
	}

	get tooltip(): string {
		return this.defaultTooltip;
	}
}

class UiButton extends UiElement<{ click: void, 'right-click': void, 'hover': void, 'hover-end': void }> {
	selected = false;
	private hovered = false;

	onMousePress(point: Point) {
		if (this.containsPoint(point))
			this.emit('click');
	}

	onRightMousePress(point: Point) {
		if (this.containsPoint(point))
			this.emit('right-click');
	}

	onMouseUp(point: Point) {
		if (this.containsPoint(point)) {
			this.hovered = true;
			this.emit('hover');
		} else if (this.hovered) {
			this.hovered = false;
			this.emit('hover-end');
		}
	}

	protected edits(pixelsWidth: number): Edit[] {
		let edits = super.edits(pixelsWidth);
		if (this.selected)
			edits.push(new Rect(this.position, this.position.add(this.size), 2, Color.BLACK));
		return edits;
	}
}

class UiIconButton extends UiButton {
	icon: IconInstruction[];

	constructor(icon: IconInstruction[]) {
		super();
		this.icon = icon;
	}

	protected edits(pixelsWidth: number): Edit[] {
		let edits = super.edits(pixelsWidth);
		edits.splice(1, 0, ...iconToEdits(this.icon, this.position, this.size));
		return edits;
	}
}

class UiToolButton extends UiIconButton {
	readonly tool: Tool | null;

	constructor(tool: Tool | null) {
		super(tool !== null ? UiToolButton.toolUiInfo[tool]![1] : []);
		this.tool = tool;
	}

	static get toolUiInfo(): Partial<Record<Tool, [Tool, IconInstruction[], string]>> {
		return {
			[Tool.MOVE]: [Tool.MOVE, icons.SELECT, 'move (m or space)'],
			[Tool.LINE]: [Tool.LINE, icons.LINE, 'line (l)'],
			[Tool.STRAIGHT_LINE]: [Tool.STRAIGHT_LINE, icons.STRAIGHT_LINE, 'guiding line (k)'],
			[Tool.MEASURE]: [Tool.MEASURE, icons.MEASURE, 'measure (j)'],
			[Tool.RECT]: [Tool.RECT, icons.RECT, 'rect (r)'],
			[Tool.FILL_RECT]: [Tool.FILL_RECT, icons.FILL_RECT, 'fill rect (f)'],
			[Tool.CLEAR]: [Tool.CLEAR, icons.CLEAR, 'clear (e or delete)'],
			[Tool.TEXT]: [Tool.TEXT, icons.TEXT_EDIT, 'text (t)'],
			[Tool.COLOR_PICKER]: [Tool.COLOR_PICKER, icons.COLOR_PICKER, 'color picker (c)'],
			[Tool.COLOR_DIFF]: [Tool.COLOR_DIFF, icons.COLOR_DIFF, 'diff (d)'],
			[Tool.BUCKET_FILL]: [Tool.BUCKET_FILL, icons.BUCKET_FILL, 'bucket fill (b)'],
			[Tool.PEN]: [Tool.PEN, icons.PEN, 'pen (p)'],
		};
	}

	static get editStackUiInfo(): Record<string, IconInstruction[]> {
		return {
			'': [],
			Move: icons.SELECT,
			Line: icons.LINE,
			StraightLine: icons.STRAIGHT_LINE,
			Measure: icons.MEASURE,
			Rect: icons.RECT,
			FillRect: icons.FILL_RECT,
			Clear: icons.CLEAR,
			TextEdit: icons.TEXT_EDIT,
			ColorDiff: icons.COLOR_DIFF,
			BucketFill: icons.BUCKET_FILL,
			Paste: icons.PASTE,
			Pen: icons.PEN,
		};
	}
}

class UiColorButton extends UiIconButton {
	color: Color;

	constructor(color: Color) {
		super(colorIcon(color));
		this.color = color;
	}

	protected edits(pixelsWidth: number): Edit[] {
		this.icon = colorIcon(this.color);
		return super.edits(pixelsWidth);
	}

	get tooltip(): string {
		return `rgb(${this.color.toRgba().slice(0, 3).join()}) ${this.defaultTooltip}`.trim();
	}
}

class UiTextButton extends UiButton {
	text: string;

	constructor(text: string) {
		super();
		this.text = text;
	}

	protected edits(pixelsWidth: number): Edit[] {
		let textEdit = new FixedTextEdit(this.position.add(new Point(4, 2)), 15, Color.DARK_GRAY, this.text);
		return super.edits(pixelsWidth).concat(textEdit);
	}
}

class UiColorCircle extends UiElement<{ click: void }> {
	float = new Point(.5);
	brightness = .5;

	private getColor(point: Point): Color | null {
		let float = this.pointToFloat(point);
		if (!float) return null;
		if (float.subtract(this.float).atLeast(new Point(-.03)) && float.subtract(this.float).atMost(new Point(.03)))
			return Color.WHITE;
		return Color.fromFloat(float, this.brightness);
	}

	protected edits(pixelsWidth: number): Edit[] {
		let edits: Edit[] = [this.bgRect(Color.fromRgba(240, 240, 240, 255))];
		for (let x = this.position.x; x <= this.position.add(this.size).x; x++)
			for (let y = this.position.y; y <= this.position.add(this.size).y; y++) {
				let point = new Point(x, y);
				let color = this.getColor(point);
				if (color)
					edits.push(new Dot(point, color));
			}
		return edits;
	}

	onMouseDown(point: Point) {
		let float = this.pointToFloat(point);
		if (float) {
			this.float = float;
			this.emit('click');
		}
	}

	private pointToFloat(point: Point) {
		let float = point.subtract(this.position).divide(this.size);
		return float.subtract(new Point(.5)).magnitude2 <= .25 ? float : null;
	}
}

class UiColorRange extends UiElement<{ click: void }> {
	float = new Point(.5);
	brightness = .5;

	private getPointColor(xf: number): Color {
		if (Math.abs(xf - this.brightness) < .03)
			return Color.WHITE;
		return Color.fromFloat(this.float, xf);
	}

	protected edits(pixelsWidth: number): Edit[] {
		let rect = new Uint8ClampedArray((this.size.x + 1) * (this.size.y + 1) * 4);
		let rect32 = new Uint32Array(rect.buffer);
		for (let x = 0; x <= this.size.x; x++)
			rect32[x] = this.getPointColor(x / this.size.x).int32;
		for (let y = 0; y <= this.size.y; y++)
			rect32.set(rect32.subarray(0, getIndex(this.size.x + 1, 0, this.size.x + 1, false)), getIndex(0, y, this.size.x + 1, false));
		let paste = new Paste(this.position, {width: this.size.x + 1, height: this.size.y + 1, int8Array: rect});
		return super.edits(pixelsWidth).concat(paste);
	}

	onMouseDown(point: Point) {
		if (this.containsPoint(point)) {
			this.brightness = clamp((point.x - this.position.x) / this.size.x, 0, 1);
			this.emit('click');
		}
	}

	containsPoint(point: Point) {
		let padding = new Point(10, 0);
		let min = this.position.subtract(padding);
		let max = this.position.add(this.size).add(padding);
		return point.atLeast(min) && point.atMost(max);
	}

	get tooltip(): string {
		return `${round(this.brightness * 100)}%`;
	}
}

class UiTextLabel extends UiElement {
	text: string;

	constructor(text: string) {
		super();
		this.text = text;
	}

	protected edits(pixelsWidth: number): Edit[] {
		return [
			this.bgRect(Color.fromRgba(220, 220, 220, 255)),
			new FixedTextEdit(this.position.add(new Point(4, 2)), 15, Color.DARK_GRAY, this.text),
		];
	}
}

class UiTooltip extends UiElement {
	text = '';

	protected edits(pixelsWidth: number): Edit[] {
		if (!this.text) return [];
		let tooltipPoint1 = this.position.add(new Point(8, 0));
		let tooltipTextEdit = new FixedTextEdit(Point.P0, 15, Color.BLACK, this.text);
		let tooltipPoint2 = tooltipPoint1.add(tooltipTextEdit.measure()).add(new Point(6, 2));
		let excessX = tooltipPoint2.x - pixelsWidth + 1;
		if (excessX > 0) {
			tooltipPoint1 = tooltipPoint1.add(new Point(-excessX, 10));
			tooltipPoint2 = tooltipPoint2.add(new Point(-excessX, 10));
		}
		tooltipTextEdit.setPoint(0, tooltipPoint1.add(new Point(3)), false);
		return [
			new FillRect(tooltipPoint1, tooltipPoint2, Color.WHITE),
			new Rect(tooltipPoint1, tooltipPoint2, 0, Color.DARK_GRAY),
			tooltipTextEdit,
		];
	}
}

class GridLayout {
	private readonly width: number;
	private readonly margin: number;
	private x = 0;
	private y = 0;
	private rowHeight = 0;

	constructor(width: number, margin: number) {
		this.width = width;
		this.margin = margin;
		this.nextRow();
	}

	add(size: Point) {
		if (this.x + size.x + this.margin > this.width)
			this.nextRow();
		let position = new Point(this.x, this.y);
		this.x += size.x + this.margin;
		this.rowHeight = Math.max(this.rowHeight, size.y);
		return position;
	}

	nextRow(margin = 0): void {
		this.x = this.margin;
		this.y = this.height + margin;
		this.rowHeight = 0;
	}

	private get height() {
		return this.y + this.rowHeight + this.margin;
	}

	divide(count: number) {
		return Math.floor((this.width - this.margin) / count) - this.margin;
	}
}

export default class UiPanel extends Emitter<{
	tool: Tool,
	color: Color,
	undo: void,
	redo: void,
	'start-new': void,
	'camera-reset': void,
	'post-edit-click': number,
	'post-edit-right-click': number,
	'post-edit-hover': number,
	'post-edit-hover-end': number,
	'redo-edit-click': number,
	'redo-edit-hover': number,
	'redo-edit-hover-end': number,
	'save-click': number,
}> {
	private readonly grid: GridLayout;
	private readonly uis: UiElement[] = [];
	private readonly toolButtons: UiToolButton[];
	private readonly colorCircle: UiColorCircle;
	private readonly colorBrightness: UiColorRange;
	private readonly presetColorButtons: UiColorButton[];
	private readonly recentColorButtons: UiColorButton[];
	private readonly viewText: UiTextButton;
	private readonly postEditList: UiToolButton[];
	private readonly redoEditList: UiToolButton[];
	private readonly saveList: UiTextButton[];
	private readonly tooltip = new UiTooltip();
	private readonly pixels: Pixels;
	private drawDirtyUis: UiElement[] = [];

	constructor(pixels: Pixels, input: Input) {
		super();

		this.pixels = pixels;
		let margin = 5;
		this.grid = new GridLayout(pixels.width, margin);
		let quarterRowSize = new Point(this.grid.divide(4));
		let halfRowSize = this.grid.divide(2);
		let fullRowSize = this.grid.divide(1);

		this.toolButtons = Object.values(UiToolButton.toolUiInfo).map(uiInfo =>
			this
				.add(new UiToolButton(uiInfo[0]), quarterRowSize)
				.setTooltip(uiInfo[2])
				.addListener('click', () => this.emit('tool', uiInfo[0])));

		this.grid.nextRow(margin);
		this.colorCircle = this.add(new UiColorCircle(), new Point(fullRowSize));

		this.grid.nextRow();
		this.colorBrightness = this.add(new UiColorRange(), new Point(fullRowSize, quarterRowSize.y / 2));

		[this.colorCircle, this.colorBrightness].forEach(ui => ui.addListener('click', () =>
			this.emit('color', Color.fromFloat(this.colorCircle.float, this.colorBrightness.brightness))));

		this.grid.nextRow();

		this.presetColorButtons = ([
			// gray
			[0, 0, 0], // black
			[111, 111, 111], // dark gray
			[170, 170, 170], // light gray
			[255, 255, 255], // white
			// light
			[0, 191, 255], // blue
			[217, 255, 25], // yellow
			[255, 170, 50], // orange
			[245, 100, 245],  // pink
			// dark
			[10, 115, 255], // blue
			[0, 174, 17], // green
			[250, 90, 90], // red
		] as [number, number, number][])
			.map(rgb => Color.fromRgba(...rgb, 255))
			.map((color, i) => {
				let button = this.add(new UiColorButton(color), quarterRowSize);
				if (i < 10)
					button.setTooltip(`(${(i + 1) % 10})`);
				button.addListener('click', () => this.emit('color', color));
				return button;
			});

		this.grid.nextRow(margin);
		this.recentColorButtons = A(12).map((_, i) => {
			let button = this.add(new UiColorButton(Color.LIGHT_GRAY), quarterRowSize);
			button.addListener('click', () => this.emit('color', button.color));
			if (i < 10)
				button.setTooltip(`(ctrl+${(i + 1) % 10})`);
			return button;
		});

		this.grid.nextRow(margin);
		this
			.add(new UiIconButton(icons.UNDO), quarterRowSize)
			.setTooltip('undo (ctrl+z or mb-4)')
			.addListener('click', () => this.emit('undo'));
		this
			.add(new UiIconButton(icons.REDO), quarterRowSize)
			.setTooltip('redo (ctrl+shift+z or mb-5)')
			.addListener('click', () => this.emit('redo'));
		this
			.add(new UiIconButton(icons.START_NEW), quarterRowSize)
			.setTooltip('new (ctrl+e)')
			.addListener('click', () => this.emit('start-new'));

		this.grid.nextRow(margin);
		this.viewText = this
			.add(new UiTextButton('100%'), new Point(fullRowSize, quarterRowSize.y / 2))
			.setTooltip('reset zoom (ctrl+0)')
			.addListener('click', () => this.emit('camera-reset'));

		this.grid.nextRow(margin);
		this
			.add(new UiTextLabel('edit stack'), new Point(fullRowSize, quarterRowSize.y / 2))
			.setTooltip('`');
		this.postEditList = A(49).map((_, i) => this
			.add(new UiToolButton(null), quarterRowSize.scale(.5))
			.addListener('click', () => this.emit('post-edit-click', i))
			.addListener('right-click', () => this.emit('post-edit-right-click', i))
			.addListener('hover', () => this.emit('post-edit-hover', i))
			.addListener('hover-end', () => this.emit('post-edit-hover-end', i)));

		this.grid.nextRow(margin);
		this.add(new UiTextLabel('undo stack'), new Point(fullRowSize, quarterRowSize.y / 2));
		this.redoEditList = A(49).map((_, i) => this
			.add(new UiToolButton(null), quarterRowSize.scale(.5))
			.addListener('click', () => this.emit('redo-edit-click', i))
			.addListener('hover', () => this.emit('redo-edit-hover', i))
			.addListener('hover-end', () => this.emit('redo-edit-hover-end', i)));

		this.grid.nextRow(margin);
		this.add(new UiTextLabel('saves'), new Point(fullRowSize, quarterRowSize.y / 2));
		this.saveList = A(16).map((_, i) => this
			.add(new UiTextButton(`Save ${i}`), new Point(halfRowSize, quarterRowSize.y / 2))
			.addListener('click', () => this.emit('save-click', i)));

		this.uis.push(this.tooltip);

		input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.PRESSED], () =>
			this.uis.forEach(ui => ui.onMousePress(input.mousePosition))));
		input.addBinding(new MouseBinding(MouseButton.RIGHT, [InputState.PRESSED], () =>
			this.uis.forEach(ui => ui.onRightMousePress(input.mousePosition))));
		input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.DOWN], () => {
			if (!input.mouseMoved) return;
			this.uis.forEach(ui => ui.onMouseDown(input.mousePosition));
		}));
		input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.DOWN, InputState.UP], () => {
			if (!input.mouseMoved) return;
			this.uis.forEach(ui => ui.onMouseUp(input.mousePosition));
			this.setTooltip(input.mousePosition);
		}));
	}

	private add<T extends UiElement>(ui: T, size: Point): T {
		let position = this.grid.add(size);
		ui.setPosition(position);
		ui.setSize(size);
		this.uis.push(ui);
		this.drawDirtyUis.push(ui);
		return ui;
	}

	get presetColors(): Color[] {
		return this.presetColorButtons.map(button => button.color);
	}

	get recentColors(): Color[] {
		return this.recentColorButtons.map(button => button.color);
	}

	setTool(tool: Tool) {
		this.toolButtons.forEach(button => button.selected = button.tool === tool);
		this.drawDirtyUis = this.drawDirtyUis.concat(this.toolButtons);
	}

	setColor(color: Color) {
		let [float, brightness] = color.toFloat();
		this.colorCircle.float = float;
		this.colorCircle.brightness = brightness;
		this.colorBrightness.float = float;
		this.colorBrightness.brightness = brightness;
		this.setSelectedColor(color);
		this.drawDirtyUis.push(this.colorCircle);
		this.drawDirtyUis.push(this.colorBrightness);
	}

	setColorUsed(colorUsed: Color) {
		let recentColors = this.recentColorButtons.map(button => button.color);
		let index = recentColors.findIndex(recentColor => recentColor.int32 === colorUsed.int32);
		if (index === -1) {
			recentColors.unshift(colorUsed);
			recentColors.pop();
		} else
			recentColors.unshift(recentColors.splice(index, 1)[0]);
		this.recentColorButtons.forEach((button, i) => button.color = recentColors[i]);
		this.setSelectedColor(colorUsed);
	}

	private setSelectedColor(color: Color) {
		this.presetColorButtons.forEach(button => button.selected = button.color.int32 === color.int32);
		let found = false;
		this.recentColorButtons.forEach(button => {
			button.selected = button.color.int32 === color.int32 && !found;
			if (button.selected)
				found = true;
		});
		this.drawDirtyUis = this.drawDirtyUis.concat(this.presetColorButtons);
		this.drawDirtyUis = this.drawDirtyUis.concat(this.recentColorButtons);
	}

	setZoom(zoom: number) {
		this.viewText.text = `${zoom}%`;
		this.drawDirtyUis.push(this.viewText);
	}

	setStatus(status: string) {
		this.viewText.text = status;
		this.drawDirtyUis.push(this.viewText);
	}

	setPostEditList(names: [string, boolean][]) {
		this.postEditList.forEach((edit, i) => {
			let [text, selected] = names[i] || ['', 0];
			edit.icon = UiToolButton.editStackUiInfo[text];
			edit.selected = selected;
			edit.setTooltip(text);
		});
		this.drawDirtyUis = this.drawDirtyUis.concat(this.postEditList);
	}

	setRedoEditList(names: string[]) {
		this.redoEditList.forEach((edit, i) => {
			let text = names[i] || '';
			edit.icon = UiToolButton.editStackUiInfo[text];
			edit.setTooltip(text);
		});
		this.drawDirtyUis = this.drawDirtyUis.concat(this.redoEditList);
	}

	setSave(index: number) {
		this.saveList.forEach((button, i) => button.selected = i === index);
		this.drawDirtyUis = this.drawDirtyUis.concat(this.saveList);
	}

	private setTooltip(mousePosition: Point) {
		let tooltip = this.uis.find(ui => ui.containsPoint(mousePosition))?.tooltip || '';
		if (!tooltip && !this.tooltip.text) return;
		this.tooltip.setPosition(mousePosition).text = tooltip;
		this.drawDirtyUis.push(this.tooltip);
	}

	draw() {
		if (!this.drawDirtyUis.length) return;
		this.drawDirtyUis.push(this.tooltip);
		let dirtySet = new Set(this.drawDirtyUis);
		if (dirtySet.has(this.tooltip)) {
			this.pixels.clear();
			this.uis.forEach(ui => ui.draw(this.pixels));
		} else
			dirtySet.forEach(ui => ui.draw(this.pixels));
		this.drawDirtyUis = [];
	}
}
