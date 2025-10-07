import {Color, Emitter, Point, round, Tool} from './base.js';
import {Edit, Line, Rect, TextEdit} from './Edit.js';
import {colorIcon, IconInstruction, icons, iconToEdits} from './icons.js';
import {Input, InputState, MouseBinding, MouseButton} from './Input.js';
import Pixels from './Pixels.js';

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
	private readonly icon: IconInstruction[];

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

class UiColorCircle extends UiElement {
	static colorFromFloat(float: Point, brightness: number) {
		let rx = Math.cos(0) + .5;
		let ry = Math.sin(0) + .5;
		let gx = Math.cos(Math.PI * 2 / 3) + .5;
		let gy = Math.sin(Math.PI * 2 / 3) + .5;
		let bx = Math.cos(Math.PI * 4 / 3) + .5;
		let by = Math.sin(Math.PI * 4 / 3) + .5;

		let rgb = [
			new Point(rx, ry),
			new Point(gx, gy),
			new Point(bx, by),
		]
			.map(colorCenter => 1 + brightness - float.subtract(colorCenter).magnitude2 ** .5)
			.map(f => round(f * 255)) as [number, number, number];

		return Color.fromRgba(...rgb, 255);
	}

	private getColor(point: Point): Color | null {
		let float = point.subtract(this.position).divide(this.size);
		return float.subtract(new Point(.5)).magnitude2 <= .25 ?
			UiColorCircle.colorFromFloat(float, .5) : null;
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
		let color = this.getColor(point);
		if (color)
			this.emit('click', color);
	}
}

class UiRange extends UiElement {
	private getPointColor(point: Point): Color | null {
		let x = 1 - point.subtract(this.position).divide(this.size).x;
		return UiColorCircle.colorFromFloat(new Point(.5), x);
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
		this.emit('click', point.x / this.size.x);
	}
}

class UiText extends UiElement {
	private readonly text: string;

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

	constructor(width: number, input: Input) {
		super();

		let margin = 10, extraMargin = margin * 3;
		this.grid = new GridLayout(width, margin);
		let smallButtonSize = new Point(this.grid.divide(4));
		let fullRowSize = this.grid.divide(1);


		([
			[icons.SELECT, Tool.SELECT],
			[icons.MOVE, Tool.MOVE],
			[icons.LINE, Tool.LINE],
			[icons.STRAIGHT_LINE, Tool.STRAIGHT_LINE],
			[icons.RECT, Tool.RECT],
			[icons.FILL_RECT, Tool.FILL_RECT],
			[icons.CLEAR, Tool.CLEAR],
			[icons.TEXT, Tool.TEXT],
			[icons.COLOR_PICKER, Tool.COLOR_PICKER],
			[icons.BUCKET_FILL, Tool.BUCKET_FILL],
		] as [IconInstruction[], Tool][]).forEach(([icon, tool]) =>
			this.add(new UiButton(icon), smallButtonSize).addListener('click', () => this.emit('tool', tool)));

		this.grid.nextRow(extraMargin);
		this.add(new UiColorCircle(), new Point(fullRowSize));

		this.grid.nextRow();
		this.add(new UiRange(), new Point(fullRowSize, smallButtonSize.y));

		this.grid.nextRow();
		([
			[0, 0, 0, 255],
			[85, 85, 85, 255],
			[170, 170, 170, 255],
			[255, 255, 255, 255],

			[255, 0, 0, 255],
			[0, 255, 0, 255],
			[0, 0, 255, 255],
			[255, 255, 0, 255],
			[0, 255, 255, 255],
			[255, 0, 255, 255],
			[255, 200, 150, 255],
			[255, 170, 0, 255],
			[0, 128, 0, 255],
			[128, 64, 0, 255],
			[0, 128, 255, 255],
			[128, 0, 128, 255],

			[255, 0, 0, 255],
			[255, 85, 0, 255],
			[255, 172, 0, 255],
			[212, 255, 0, 255],
			[128, 255, 0, 255],
			[43, 255, 0, 255],
			[0, 255, 85, 255],
			[0, 255, 172, 255],
			[0, 255, 255, 255],
			[0, 212, 255, 255],
			[0, 128, 255, 255],
			[43, 0, 255, 255],
			[128, 0, 255, 255],
			[212, 0, 255, 255],
			[255, 0, 172, 255],
			[255, 0, 85, 255],

			[255, 0, 0, 255],
			[255, 255, 0, 255],
			[0, 255, 0, 255],
			[0, 255, 255, 255],
			[0, 0, 255, 255],
			[255, 0, 255, 255],
			[128, 0, 0, 255],
			[128, 128, 0, 255],
			[0, 128, 0, 255],
			[0, 128, 128, 255],
			[0, 0, 128, 255],
			[128, 0, 128, 255],

			[255, 255, 255, 255], // Pure White
			[191, 191, 191, 255], // Light Gray
			[102, 102, 102, 255], // Dark Gray
			[0, 0, 0, 255],      // Pure Black
			[217, 0, 0, 255],    // Red (V=85%)
			[217, 217, 0, 255],  // Yellow (V=85%)
			[0, 217, 0, 255],    // Green (V=85%)
			[0, 217, 217, 255],  // Cyan (V=85%)
			[0, 0, 217, 255],    // Blue (V=85%)
			[217, 0, 217, 255],  // Magenta (V=85%)
			[166, 0, 0, 255],    // Deep Red (V=65%)
			[166, 166, 0, 255],  // Dark Yellow (V=65%)
			[0, 166, 0, 255],    // Dark Green (V=65%)
			[0, 166, 166, 255],  // Dark Cyan (V=65%)
			[0, 0, 166, 255],    // Deep Blue (V=65%)
			[166, 0, 166, 255],   // Dark Purple (V=65%)
		] as [number, number, number, number][])
			.map(rgba => Color.fromRgba(...rgba))
			.forEach(color => this.add(new UiButton(colorIcon(color)), smallButtonSize).addListener('click', () => this.emit('color', color)));

		// todo recent colors
		// todo off-by-1 for edit coordinates

		this.grid.nextRow(extraMargin);
		this.add(new UiButton(icons.UNDO), smallButtonSize).addListener('click', () => this.emit('undo'));
		this.add(new UiButton(icons.REDO), smallButtonSize).addListener('click', () => this.emit('redo'));

		this.grid.nextRow(extraMargin);
		this.add(new UiText('100%'), new Point(fullRowSize, smallButtonSize.y)).addListener('click', () => this.emit('camera-reset'));

		this.grid.nextRow(extraMargin);
		this.add(new UiButton(icons.SAVE), smallButtonSize).addListener('click', () => this.emit('save'));
		this.add(new UiButton(icons.START_NEW), smallButtonSize).addListener('click', () => this.emit('start-new'));

		input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.PRESSED], () => this.uis.forEach(ui => ui.onClick(input.mouseLastPosition))));
	}

	private add(ui: UiElement, size: Point) {
		let position = this.grid.add(size);
		ui.setPosition(position);
		ui.setSize(size);
		this.uis.push(ui);
		return ui;
	}

	draw(pixels: Pixels) {
		this.uis.forEach(ui => ui.draw(pixels));
	}
}
