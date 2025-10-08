import {Edit, Line, Rect, TextEdit} from './Edit.js';
import {colorIcon, IconInstruction, icons, iconToEdits} from './icons.js';
import {Input, InputState, MouseBinding, MouseButton} from './Input.js';
import Pixels from './Pixels.js';
import Color from './util/Color.js';
import Emitter from './util/Emitter.js';
import Point from './util/Point.js';
import {A, round, Tool} from './util/util.js';

class UiElement extends Emitter {
	protected position = new Point();
	protected size = new Point();

	setPosition(position: Point) {
		this.position = position;
		return this;
	}

	setSize(size: Point) {
		this.size = size;
		return this;
	}

	draw(pixels: Pixels) {
		this.edits.forEach(edit => edit.draw(pixels, pixels, true));
	}

	protected get edits(): Edit[] {
		return [new Rect(this.position, this.position.add(this.size), Color.BLACK)];
	}

	onClick(point: Point) {}

	protected containsPoint(point: Point) {
		return point.atLeast(this.position) && point.atMost(this.position.add(this.size));
	}
}

class UiButton extends UiElement {
	protected icon: IconInstruction[];

	constructor(icon: IconInstruction[]) {
		super();
		this.icon = icon;
	}

	protected get edits(): Edit[] {
		return super.edits.concat(iconToEdits(this.icon, this.position, this.size));
	}

	onClick(point: Point) {
		if (this.containsPoint(point))
			this.emit('click');
	}
}

class UiToolButton extends UiButton {
	readonly tool: Tool;
	selected = false;

	constructor(tool: Tool) {
		super(UiToolButton.toolIcons[tool]![1]);
		this.tool = tool;
	}

	static get toolIcons(): Partial<Record<Tool, [Tool, IconInstruction[]]>> {
		return {
			[Tool.SELECT]: [Tool.SELECT, icons.SELECT],
			[Tool.MOVE]: [Tool.MOVE, icons.MOVE],
			[Tool.LINE]: [Tool.LINE, icons.LINE],
			[Tool.GRID_LINE]: [Tool.GRID_LINE, icons.GRID_LINE],
			[Tool.RECT]: [Tool.RECT, icons.RECT],
			[Tool.FILL_RECT]: [Tool.FILL_RECT, icons.FILL_RECT],
			[Tool.CLEAR]: [Tool.CLEAR, icons.CLEAR],
			[Tool.TEXT]: [Tool.TEXT, icons.TEXT],
			[Tool.COLOR_PICKER]: [Tool.COLOR_PICKER, icons.COLOR_PICKER],
			[Tool.BUCKET_FILL]: [Tool.BUCKET_FILL, icons.BUCKET_FILL],
		};
	}

	protected get edits(): Edit[] {
		let edits = super.edits;
		if (this.selected) {
			edits.push(new Rect(this.position.subtract(new Point(1)), this.position.add(this.size).add(new Point(1)), Color.fromRgba(0, 0, 0, 255)));
			edits.push(new Rect(this.position.subtract(new Point(2)), this.position.add(this.size).add(new Point(2)), Color.fromRgba(0, 0, 0, 255)));
		}
		return edits;
	}
}

// todo make selectable
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
		let edits = super.edits;
		for (let x = this.position.x; x < this.position.add(this.size).x; x++)
			for (let y = this.position.y; y < this.position.add(this.size).y; y++) {
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

	private getPointColor(point: Point): Color | null {
		let x = point.subtract(this.position).divide(this.size).x;
		if (Math.abs(x - this.brightness) < .03)
			return Color.WHITE;
		return Color.fromFloat(this.float, x);
	}

	protected get edits(): Edit[] {
		let edits = super.edits;
		for (let x = this.position.x; x < this.position.add(this.size).x; x++)
			for (let y = this.position.y; y < this.position.add(this.size).y; y++) {
				let point = new Point(x, y);
				let color = this.getPointColor(point);
				if (color)
					edits.push(new Line(point, point, color));
			}
		return edits;
		// todo optimize y
	}

	onClick(point: Point) {
		if (this.containsPoint(point)) {
			this.brightness = point.x / this.size.x;
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
		let textEdit = new TextEdit(this.position.add(new Point(4, 11)), Color.DARK_GRAY);
		textEdit.text = this.text;
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
	private readonly recentColors: UiColorButton[];
	private readonly zoomText: UiText;
	private readonly pixels: Pixels;

	constructor(pixels: Pixels, input: Input) {
		super();

		this.pixels = pixels;
		let margin = 10, extraMargin = margin * 3;
		this.grid = new GridLayout(pixels.width, margin);
		let smallButtonSize = new Point(this.grid.divide(4));
		let fullRowSize = this.grid.divide(1);

		this.toolButtons = Object.values(UiToolButton.toolIcons).map(([tool]) =>
			this.add(new UiToolButton(tool), smallButtonSize).addListener('click', () => this.emit('tool', tool)));

		this.grid.nextRow(extraMargin);
		this.colorCircle = this.add(new UiColorCircle(), new Point(fullRowSize));

		this.grid.nextRow();
		this.colorBrightness = this.add(new UiColorRange(), new Point(fullRowSize, smallButtonSize.y));

		[this.colorCircle, this.colorBrightness].forEach(ui => ui.addListener('click', () =>
			this.emit('color', Color.fromFloat(this.colorCircle.float, this.colorBrightness.brightness))));

		this.grid.nextRow();

		let d3 = .3, d1 = .1;
		([
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
		] as [number, number, number, number][])
			.map(rgba => Color.fromRgba(...rgba))
			.forEach(color => this.add(new UiColorButton(color), smallButtonSize).addListener('click', () => this.emit('color', color)));

		this.grid.nextRow(extraMargin);
		this.recentColors = A(16).map(() => {
			let button = this.add(new UiColorButton(Color.LIGHT_GRAY), smallButtonSize);
			button.addListener('click', () => this.emit('color', button.color));
			return button;
		});

		// todo off-by-1 for edit coordinates

		this.grid.nextRow(extraMargin);
		this.add(new UiButton(icons.UNDO), smallButtonSize).addListener('click', () => this.emit('undo'));
		this.add(new UiButton(icons.REDO), smallButtonSize).addListener('click', () => this.emit('redo'));

		this.grid.nextRow(extraMargin);
		this.zoomText = this.add(new UiText('100%'), new Point(fullRowSize, smallButtonSize.y)).addListener('click', () => this.emit('camera-reset'));

		this.grid.nextRow(extraMargin);
		this.add(new UiButton(icons.SAVE), smallButtonSize).addListener('click', () => this.emit('save'));
		this.add(new UiButton(icons.START_NEW), smallButtonSize).addListener('click', () => this.emit('start-new'));

		// todo don't repeat on buttons like undo/redo
		input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.PRESSED, InputState.DOWN], () => this.uis.forEach(ui => ui.onClick(input.mouseLastPosition))));
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
		this.draw();
	}

	setZoom(zoom: number) {
		this.zoomText.text = `${zoom}%`;
		this.draw();
	}

	draw() {
		this.pixels.clear();
		this.uis.forEach(ui => ui.draw(this.pixels));
	}
}

// todo show tooltips
