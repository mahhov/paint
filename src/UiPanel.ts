import {Color, Emitter, Point, round} from './base.js';
import {Edit, Line, Rect, TextEdit} from './Edit.js';
import {colorIcon, IconInstruction, icons, iconToEdits} from './icons.js';
import {Input, InputState, MouseBinding, MouseButton} from './Input.js';
import Pixels from './Pixels.js';

class UiElement {
	protected position = new Point();
	protected size = new Point();

	setPosition(position: Point, size: Point) {
		this.position = position;
		this.size = size;
	}

	draw(pixels: Pixels) {
		this.edits.forEach(edit => edit.draw(pixels, pixels, true));
	}

	protected get edits(): Edit[] {
		return [new Rect(this.position, this.position.add(this.size), Color.BLACK)];
	}

	containsPoint(point: Point) {
		return point.atLeast(this.position) && point.atMost(this.position.add(this.size));
	}
}

class UiButton extends UiElement {
	private readonly icon: IconInstruction[];
	private readonly event: string;

	constructor(icon: IconInstruction[], event: string) {
		super();
		this.icon = icon;
		this.event = event;
	}

	protected get edits(): Edit[] {
		return super.edits.concat(iconToEdits(this.icon, this.position, this.size));
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

	private getPointColor(point: Point): Color | null {
		let float = point.subtract(this.position).divide(this.size);
		if (float.subtract(new Point(.5)).magnitude2 > .25)
			return null;
		return UiColorCircle.colorFromFloat(float, .5);
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

	add(ui: UiElement, size: Point) {
		if (this.x + size.x + this.margin > this.width)
			this.nextRow();
		ui.setPosition(new Point(this.x, this.y), size);
		this.x += size.x + this.margin;
		this.rowHeight = Math.max(this.rowHeight, size.y);
		return ui;
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
	private readonly uis: UiElement[] = [];

	constructor(width: number, input: Input) {
		super();

		let margin = 10, extraMargin = margin * 3;
		let grid = new GridLayout(width, margin);
		let smallButtonSize = new Point(32);
		let fullRowSize = grid.divide(1);

		this.uis.push(grid.add(new UiButton(icons.SELECT, 'tool-select'), smallButtonSize));
		this.uis.push(grid.add(new UiButton(icons.MOVE, 'tool-move'), smallButtonSize));
		this.uis.push(grid.add(new UiButton(icons.LINE, 'tool-line'), smallButtonSize));
		this.uis.push(grid.add(new UiButton(icons.STRAIGHT_LINE, 'tool-straight-line'), smallButtonSize));
		this.uis.push(grid.add(new UiButton(icons.RECT, 'tool-rect'), smallButtonSize));
		this.uis.push(grid.add(new UiButton(icons.FILL_RECT, 'tool-fill-rect'), smallButtonSize));
		this.uis.push(grid.add(new UiButton(icons.CLEAR, 'tool-clear'), smallButtonSize));
		this.uis.push(grid.add(new UiButton(icons.TEXT, 'tool-text'), smallButtonSize));
		this.uis.push(grid.add(new UiButton(icons.COLOR_PICKER, 'tool-color-picker'), smallButtonSize));
		this.uis.push(grid.add(new UiButton(icons.BUCKET_FILL, 'tool-bucket-fill'), smallButtonSize));

		grid.nextRow(extraMargin);
		this.uis.push(grid.add(new UiColorCircle(), new Point(fullRowSize)));

		grid.nextRow();
		this.uis.push(grid.add(new UiRange(), new Point(fullRowSize, smallButtonSize.y)));

		grid.nextRow();
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
			.forEach(rgba => this.uis.push(grid.add(new UiButton(colorIcon(Color.fromRgba(...rgba)), `color-${rgba}-${rgba.map(x => round(x / 255, .01))}`), smallButtonSize)));

		grid.nextRow(extraMargin);
		this.uis.push(grid.add(new UiButton(icons.UNDO, 'undo'), smallButtonSize));
		this.uis.push(grid.add(new UiButton(icons.REDO, 'redo'), smallButtonSize));

		grid.nextRow(extraMargin);
		this.uis.push(grid.add(new UiText('100%'), new Point(fullRowSize, smallButtonSize.y)));

		grid.nextRow(extraMargin);
		this.uis.push(grid.add(new UiButton(icons.SAVE, 'save'), smallButtonSize));
		this.uis.push(grid.add(new UiButton(icons.START_NEW, 'start-new'), smallButtonSize));

		input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.PRESSED], () => {
			let ui = this.uis.find(ui => ui.containsPoint(input.mouseLastPosition));
			if (ui && ui.event) {
				console.log(ui.event);
				this.emit(ui.event);
			}
		}));
	}

	draw(pixels: Pixels) {
		this.uis.forEach(ui => ui.draw(pixels));
	}
}
