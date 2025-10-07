import {Color, Emitter, Point} from './base.js';
import {Edit, Rect} from './Edit.js';
import {IconInstruction, icons, iconToEdits} from './icons.js';
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

	protected iconCoordinates(point32: Point) {
		return point32.scale(1 / 32).multiply(this.size).add(this.position).round;
	}

	protected iconCoordinates2(x1: number, y1: number, x2: number, y2: number): [Point, Point] {
		return [this.iconCoordinates(new Point(x1, y1)), this.iconCoordinates(new Point(x2, y2))];
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
}

class UiRange extends UiElement {
}

class UiText extends UiElement {
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
		// this.uis.push(grid.add(this.colorCircle, new Point(fullRowSize)));

		grid.nextRow();
		// this.uis.push(grid.add(this.colorBrightness, new Point(fullRowSize, smallButtonSize.y)));

		grid.nextRow();
		// this.recentColors.forEach(ui => grid.add(ui, smallButtonSize));

		grid.nextRow(extraMargin);
		this.uis.push(grid.add(new UiButton(icons.UNDO, 'undo'), smallButtonSize));
		this.uis.push(grid.add(new UiButton(icons.REDO, 'redo'), smallButtonSize));

		grid.nextRow(extraMargin);
		// this.uis.push(grid.add(this.zoom, new Point(fullRowSize, smallButtonSize.y)));

		grid.nextRow(extraMargin);
		this.uis.push(grid.add(new UiButton(icons.SAVE, 'save'), smallButtonSize));
		this.uis.push(grid.add(new UiButton(icons.RESET, 'reset'), smallButtonSize));

		input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.PRESSED],
			() => this.uis.some(ui => ui.containsPoint(input.mouseLastPosition))));
	}

	draw(pixels: Pixels) {
		this.uis.forEach(ui => ui.draw(pixels));
	}
}
