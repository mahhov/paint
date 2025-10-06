import {A, Color, Point, Tool} from './base.js';
import {Edit, Rect} from './Edit.js';
import {Input, InputState, MouseBinding, MouseButton} from './Input.js';
import Pixels from './Pixels.js';

class UiElement {
	protected position = new Point();
	protected size = new Point();
	private handler = () => {};

	setPosition(position: Point, size: Point) {
		this.position = position;
		this.size = size;
	}

	setHandler(handler: () => void) {
		this.handler = handler;
	}

	draw(pixels: Pixels) {
		this.edits.forEach(edit => edit.draw(pixels, pixels, false));
	}

	protected get edits(): Edit[] {
		return [new Rect(this.position, this.position.add(this.size), Color.BLACK)];
	}

	maybeClick(point: Point) {
		if (point.atLeast(this.position) && point.atMost(this.position.add(this.size))) {
			this.handler();
			return true;
		}
		return false;
	}
}

class UiButton extends UiElement {
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

export default class UiPanel {
	readonly tools = A(Object.values(Tool).length / 2).map(() => new UiButton());
	readonly colorCircle = new UiColorCircle();
	readonly colorBrightness = new UiRange();
	readonly recentColors = A(16).map(() => new UiButton());
	readonly undo = new UiButton();
	readonly redo = new UiButton();
	readonly zoom = new UiText();
	readonly save = new UiText();
	readonly reset = new UiText();

	constructor(width: number, input: Input) {
		let margin = 10, extraMargin = margin * 3;
		let grid = new GridLayout(width, margin);
		let smallButtonSize = new Point(grid.divide(4));
		let fullRowSize = grid.divide(1);

		this.tools.forEach(ui => grid.add(ui, smallButtonSize));

		grid.nextRow(extraMargin);
		grid.add(this.colorCircle, new Point(fullRowSize));

		grid.nextRow();
		grid.add(this.colorBrightness, new Point(fullRowSize, smallButtonSize.y));

		grid.nextRow();
		this.recentColors.forEach(ui => grid.add(ui, smallButtonSize));

		grid.nextRow(extraMargin);
		grid.add(this.undo, smallButtonSize);
		grid.add(this.redo, smallButtonSize);

		grid.nextRow(extraMargin);
		grid.add(this.zoom, new Point(fullRowSize, smallButtonSize.y));

		grid.nextRow(extraMargin);
		grid.add(this.save, smallButtonSize);
		grid.add(this.reset, smallButtonSize);

		input.addBinding(new MouseBinding(MouseButton.LEFT, [InputState.PRESSED],
			() => this.uis.some(ui => ui.maybeClick(input.mouseLastPosition))));
	}

	private get uis() {
		return [
			this.tools,
			this.colorCircle,
			this.colorBrightness,
			this.recentColors,
			this.undo,
			this.redo,
			this.zoom,
			this.save,
			this.reset,
		].flat();
	}

	draw(pixels: Pixels) {
		this.uis.forEach(ui => ui.draw(pixels));
	}
}
