import {Edit, FillRect, Line, Paste, Rect, TextEdit} from './Edit.js';
import {colorIcon, IconInstruction, icons, iconToEdits} from './icons.js';
import {Input, InputState, MouseBinding, MouseButton} from './Input.js';
import Pixels from './Pixels.js';
import Color from './util/Color.js';
import Emitter from './util/Emitter.js';
import Point from './util/Point.js';
import {A, getIndex, round, Tool} from './util/util.js';

class UiElement extends Emitter {
	protected position = Point.P0;
	protected size = Point.P0;
	tooltip = '';

	setPosition(position: Point) {
		this.position = position;
		return this;
	}

	setSize(size: Point) {
		this.size = size;
		return this;
	}

	setTooltip(tooltip: string) {
		this.tooltip = tooltip;
		return this;
	}

	draw(pixels: Pixels) {
		this.edits.forEach(edit => edit.draw(pixels, pixels, true));
	}

	protected get edits(): Edit[] {
		return [new Rect(this.position, this.position.add(this.size), Color.BLACK)];
	}

	onClick(point: Point) {}

	containsPoint(point: Point) {
		return point.atLeast(this.position) && point.atMost(this.position.add(this.size));
	}
}

class UiButton extends UiElement {
	protected icon: IconInstruction[];
	selected = false;

	constructor(icon: IconInstruction[]) {
		super();
		this.icon = icon;
	}

	protected get edits(): Edit[] {
		let edits = super.edits.concat(iconToEdits(this.icon, this.position, this.size));
		if (this.selected) {
			edits.push(new Rect(this.position.subtract(Point.P1), this.position.add(this.size).add(Point.P1), Color.fromRgba(0, 0, 0, 255)));
			edits.push(new Rect(this.position.subtract(new Point(2)), this.position.add(this.size).add(new Point(2)), Color.fromRgba(0, 0, 0, 255)));
		}
		return edits;
	}

	onClick(point: Point) {
		if (this.containsPoint(point))
			this.emit('click');
	}
}

class UiToolButton extends UiButton {
	readonly tool: Tool;

	constructor(tool: Tool) {
		super(UiToolButton.toolUiInfo[tool]![1]);
		this.tool = tool;
	}

	static get toolUiInfo(): Partial<Record<Tool, [Tool, IconInstruction[], string]>> {
		return {
			[Tool.SELECT]: [Tool.SELECT, icons.SELECT, 'select (s)'],
			[Tool.MOVE]: [Tool.MOVE, icons.MOVE, 'move (m or space)'],
			[Tool.LINE]: [Tool.LINE, icons.LINE, 'line (l)'],
			[Tool.GRID_LINE]: [Tool.GRID_LINE, icons.GRID_LINE, 'grid_line (k)'],
			[Tool.RECT]: [Tool.RECT, icons.RECT, 'rect (r)'],
			[Tool.FILL_RECT]: [Tool.FILL_RECT, icons.FILL_RECT, 'fill rect (f)'],
			[Tool.CLEAR]: [Tool.CLEAR, icons.CLEAR, 'clear (e or delete)'],
			[Tool.TEXT]: [Tool.TEXT, icons.TEXT, 'text (t)'],
			[Tool.COLOR_PICKER]: [Tool.COLOR_PICKER, icons.COLOR_PICKER, 'color picker (c)'],
			[Tool.BUCKET_FILL]: [Tool.BUCKET_FILL, icons.BUCKET_FILL, 'bucket fill (b)'],
		};
	}
}

class UiColorButton extends UiButton {
	color: Color;

	constructor(color: Color) {
		super(colorIcon(color));
		this.color = color;
	}

	protected get edits(): Edit[] {
		this.icon = colorIcon(this.color);
		return super.edits;
	}
}

class UiColorCircle extends UiElement {
	float = new Point(.5);
	brightness = .5;

	private getColor(point: Point): Color | null {
		let float = this.pointToFloat(point);
		if (!float) return null;
		if (float.subtract(this.float).atLeast(new Point(-.03)) && float.subtract(this.float).atMost(new Point(.03)))
			return Color.WHITE;
		return Color.fromFloat(float, this.brightness);
	}

	protected get edits(): Edit[] {
		let edits = [];
		for (let x = this.position.x; x <= this.position.add(this.size).x; x++)
			for (let y = this.position.y; y <= this.position.add(this.size).y; y++) {
				let point = new Point(x, y);
				let color = this.getColor(point);
				if (color)
					edits.push(new Line(point, point, color));
			}
		return edits;
	}

	onClick(point: Point) {
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

class UiColorRange extends UiElement {
	float = new Point(.5);
	brightness = .5;

	private getPointColor(xf: number): Color {
		if (Math.abs(xf - this.brightness) < .03)
			return Color.WHITE;
		return Color.fromFloat(this.float, xf);
	}

	protected get edits(): Edit[] {
		let edits: Edit[] = [];
		let rect = new Uint8ClampedArray((this.size.x + 1) * (this.size.y + 1) * 4);
		let rect32 = new Uint32Array(rect.buffer);
		for (let x = 0; x <= this.size.x; x++)
			rect32[x] = this.getPointColor(x / this.size.x).int32;
		for (let y = 0; y <= this.size.y; y++)
			rect32.set(rect32.subarray(0, getIndex(this.size.x + 1, 0, this.size.x + 1, false)), getIndex(0, y, this.size.x + 1, false));
		edits.push(new Paste(this.position, {width: this.size.x + 1, height: this.size.y + 1, int8Array: rect}));
		return edits.concat(super.edits);
	}

	onClick(point: Point) {
		// todo difficult to drag to either end
		if (this.containsPoint(point)) {
			this.brightness = (point.x - this.position.x) / this.size.x;
			this.emit('click');
		}
	}
}

class UiText extends UiElement {
	text: string;

	constructor(text: string) {
		super();
		this.text = text;
	}

	protected get edits(): Edit[] {
		let textEdit = new TextEdit(this.position.add(new Point(4, 11)), Color.DARK_GRAY, this.text);
		return super.edits.concat(textEdit);
	}

	onClick(point: Point) {
		if (this.containsPoint(point))
			this.emit('click');
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

	nextRow(extraMargin = 0): void {
		this.x = this.margin;
		this.y = this.height + extraMargin;
		this.rowHeight = 0;
	}

	private get height() {
		return this.y + this.rowHeight + this.margin;
	}

	divide(count: number) {
		return Math.floor((this.width - this.margin) / count) - this.margin;
	}
}

export default class UiPanel extends Emitter {
	private readonly grid: GridLayout;
	private readonly uis: UiElement[] = [];
	private readonly toolButtons: UiToolButton[];
	private readonly colorCircle: UiColorCircle;
	private readonly colorBrightness: UiColorRange;
	private readonly presetColors: UiColorButton[];
	private readonly recentColors: UiColorButton[];
	private readonly zoomText: UiText;
	private readonly pixels: Pixels;
	private tooltip = '';
	private tooltipPosition = Point.P0;

	constructor(pixels: Pixels, input: Input) {
		super();

		this.pixels = pixels;
		let margin = 10, extraMargin = margin * 3;
		this.grid = new GridLayout(pixels.width, margin);
		let smallButtonSize = new Point(this.grid.divide(4));
		let fullRowSize = this.grid.divide(1);

		this.toolButtons = Object.values(UiToolButton.toolUiInfo).map(uiInfo =>
			this.add(new UiToolButton(uiInfo[0]), smallButtonSize)
				.setTooltip(uiInfo[2])
				.addListener('click', () => this.emit('tool', uiInfo[0])));

		this.grid.nextRow(extraMargin);
		this.colorCircle = this.add(new UiColorCircle(), new Point(fullRowSize));

		this.grid.nextRow();
		this.colorBrightness = this.add(new UiColorRange(), new Point(fullRowSize, smallButtonSize.y));

		[this.colorCircle, this.colorBrightness].forEach(ui => ui.addListener('click', () =>
			this.emit('color', Color.fromFloat(this.colorCircle.float, this.colorBrightness.brightness))));

		this.grid.nextRow();

		let d3 = .3, d1 = .1;
		this.presetColors = ([
			[0, 0, 0, 255],
			[255 / 3, 255 / 3, 255 / 3, 255],
			[255 * 2 / 3, 255 * 2 / 3, 255 * 2 / 3, 255],
			[255, 255, 255, 255],
			...A(10).map((_, i, a) => [
				[...Color.hsvToRgb(round(i * 255 / a.length), 1, 1 - d3), 255],
				[...Color.hsvToRgb(round(i * 255 / a.length), 1, 1 - d1), 255],
				[...Color.hsvToRgb(round(i * 255 / a.length), 1 - d1, 1), 255],
				[...Color.hsvToRgb(round(i * 255 / a.length), 1 - d3, 1), 255],
			]).flat(),
		] as [number, number, number, number][]).map(rgba => {
			let color = Color.fromRgba(...rgba);
			return this
				.add(new UiColorButton(color), smallButtonSize)
				.setTooltip(`rgb(${rgba.slice(0, 3).join()})`)
				.addListener('click', () => this.emit('color', color));
		});

		this.grid.nextRow(extraMargin);
		this.recentColors = A(16).map(() => {
			let button = this.add(new UiColorButton(Color.LIGHT_GRAY), smallButtonSize);
			button.addListener('click', () => this.emit('color', button.color));
			return button;
		});

		this.grid.nextRow(extraMargin);
		this.add(new UiButton(icons.UNDO), smallButtonSize)
			.setTooltip('undo (ctrl+z or mb-4)')
			.addListener('click', () => this.emit('undo'));
		this.add(new UiButton(icons.REDO), smallButtonSize)
			.setTooltip('redo (ctrl+shift+z or mb-5)')
			.addListener('click', () => this.emit('redo'));

		this.grid.nextRow(extraMargin);
		this.zoomText = this
			.add(new UiText('100%'), new Point(fullRowSize, smallButtonSize.y))
			.setTooltip('click to reset view')
			.addListener('click', () => this.emit('camera-reset'));

		this.grid.nextRow(extraMargin);
		this.add(new UiButton(icons.SAVE), smallButtonSize)
			.setTooltip('save')
			.addListener('click', () => this.emit('save'));
		this.add(new UiButton(icons.START_NEW), smallButtonSize)
			.setTooltip('start new')
			.addListener('click', () => this.emit('start-new'));

		// todo don't repeat on buttons like undo/redo
		input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.PRESSED, InputState.DOWN], () =>
			this.uis.forEach(ui => ui.onClick(input.mousePosition))));
		input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.UP], () => {
			if (input.mousePosition.equals(input.mouseLastPosition)) return;
			let tooltip = this.uis.find(ui => ui.containsPoint(input.mousePosition))?.tooltip || '';
			if (!tooltip && !this.tooltip) return;
			this.tooltip = tooltip;
			this.tooltipPosition = input.mousePosition;
			this.draw();
		}));
	}

	private add<T extends UiElement>(ui: T, size: Point): T {
		let position = this.grid.add(size);
		ui.setPosition(position);
		ui.setSize(size);
		this.uis.push(ui);
		return ui;
	}

	setTool(tool: Tool) {
		this.toolButtons.forEach(button => button.selected = button.tool === tool);
		this.draw();
	}

	setColor(color: Color) {
		let [float, brightness] = color.toFloat();
		this.colorCircle.float = float;
		this.colorCircle.brightness = brightness;
		this.colorBrightness.float = float;
		this.colorBrightness.brightness = brightness;
		this.setSelectedColor(color);
		this.draw();
	}

	setColorUsed(color: Color) {
		let recentColors = this.recentColors.map(button => button.color);
		let index = recentColors.findIndex(recentColor => recentColor.int32 === color.int32);
		if (index === -1) {
			recentColors.unshift(color);
			recentColors.pop();
		} else
			recentColors.unshift(recentColors.splice(index, 1)[0]);
		this.recentColors.forEach((button, i) => button.color = recentColors[i]);
		this.setSelectedColor(color);
		this.draw();
	}

	private setSelectedColor(color: Color) {
		this.presetColors.forEach(button => button.selected = button.color.int32 === color.int32);
		let found = false;
		this.recentColors.forEach(button => {
			button.selected = button.color.int32 === color.int32 && !found;
			if (button.selected)
				found = true;
		});
	}

	setZoom(zoom: number) {
		this.zoomText.text = `${zoom}%`;
		this.draw();
	}

	draw() {
		this.pixels.clear();
		this.uis.forEach(ui => ui.draw(this.pixels));

		if (this.tooltip) {
			let tooltipPoint1 = this.tooltipPosition.add(new Point(8, 0));
			let tooltipTextEdit = new TextEdit(Point.P0, Color.BLACK, this.tooltip, 15);
			let tooltipPoint2 = tooltipPoint1.add(tooltipTextEdit.measure).add(new Point(6, 2));
			let excessX = tooltipPoint2.x - this.pixels.width;
			if (excessX > 0) {
				tooltipPoint1 = tooltipPoint1.add(new Point(-excessX, 10));
				tooltipPoint2 = tooltipPoint2.add(new Point(-excessX, 10));
			}

			tooltipTextEdit.setPoint(0, tooltipPoint1.add(new Point(3)), false);
			new FillRect(tooltipPoint1, tooltipPoint2, Color.WHITE).draw(this.pixels, this.pixels, true);
			new Rect(tooltipPoint1, tooltipPoint2, Color.BLACK).draw(this.pixels, this.pixels, true);
			tooltipTextEdit.draw(this.pixels, this.pixels, true);
		}
	}
}

// todo show tooltips
