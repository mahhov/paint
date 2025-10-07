import {A, Color, Point, Tool} from './base.js';
import {Edit, FillRect, Line, Rect, Select} from './Edit.js';
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

class UiToolButton extends UiButton {
	private tool: Tool;

	constructor(tool: Tool) {
		super();
		this.tool = tool;
	}

	protected get edits(): Edit[] {
		let primaryColor = Color.fromRgba(30, 30, 30, 255);
		let secondaryColor = Color.fromRgba(180, 180, 180, 255);
		let edits = super.edits;
		switch (this.tool) {
			case Tool.SELECT:
				// Dashed selection rectangle (Rounded from 2.5/29.5)
				edits.push(new Select(...this.iconCoordinates2(3, 3, 30, 30)));
				// Simple cursor arrow (V shape made of three lines)
				edits.push(new Line(...this.iconCoordinates2(5, 5, 13, 13), primaryColor));
				edits.push(new Line(...this.iconCoordinates2(5, 5, 5, 13), primaryColor));
				edits.push(new Line(...this.iconCoordinates2(5, 5, 13, 5), primaryColor));
				break;

			case Tool.MOVE:
				// Center selection square
				edits.push(new Select(...this.iconCoordinates2(11, 11, 21, 21)));

				// left arrow
				edits.push(new Line(...this.iconCoordinates2(1, 16, 11, 16), primaryColor));
				edits.push(new Line(...this.iconCoordinates2(1, 16, 5, 14), primaryColor)); // Arrowhead
				edits.push(new Line(...this.iconCoordinates2(1, 16, 5, 18), primaryColor)); // Arrowhead

				// right arrow
				edits.push(new Line(...this.iconCoordinates2(31, 16, 21, 16), primaryColor));
				edits.push(new Line(...this.iconCoordinates2(31, 16, 28, 14), primaryColor)); // Arrowhead
				edits.push(new Line(...this.iconCoordinates2(31, 16, 28, 18), primaryColor)); // Arrowhead

				// up arrow
				edits.push(new Line(...this.iconCoordinates2(16, 1, 16, 11), primaryColor));
				edits.push(new Line(...this.iconCoordinates2(16, 1, 14, 5), primaryColor)); // Arrowhead
				edits.push(new Line(...this.iconCoordinates2(16, 1, 18, 5), primaryColor)); // Arrowhead

				// down arrow
				edits.push(new Line(...this.iconCoordinates2(16, 31, 16, 21), primaryColor));
				edits.push(new Line(...this.iconCoordinates2(16, 31, 14, 28), primaryColor)); // Arrowhead
				edits.push(new Line(...this.iconCoordinates2(16, 31, 18, 28), primaryColor)); // Arrowhead
				break;

			case Tool.LINE:
				// Main diagonal line
				edits.push(new Line(...this.iconCoordinates2(1, 31, 31, 1), primaryColor));
				// Start dot (Increased size from 2x2 to 4x4)
				edits.push(new FillRect(...this.iconCoordinates2(0, 28, 4, 32), primaryColor));
				// End dot (Increased size from 2x2 to 4x4)
				edits.push(new FillRect(...this.iconCoordinates2(28, 0, 32, 4), primaryColor));
				break;

			case Tool.STRAIGHT_LINE:
				// Horizontal line
				edits.push(new Line(...this.iconCoordinates2(2, 16, 30, 16), primaryColor));
				// Vertical line
				edits.push(new Line(...this.iconCoordinates2(16, 2, 16, 30), primaryColor));
				break;

			case Tool.RECT:
				// Rectangle outline
				edits.push(new Rect(...this.iconCoordinates2(2, 2, 30, 30), primaryColor));
				break;

			case Tool.FILL_RECT:
				// Filled rectangle
				edits.push(new FillRect(...this.iconCoordinates2(2, 2, 30, 30), primaryColor));
				break;

			case Tool.CLEAR:
				// Eraser body (light gray fill)
				edits.push(new FillRect(...this.iconCoordinates2(5, 8, 27, 23), secondaryColor));
				// Eraser casing (darker gray fill)
				edits.push(new FillRect(...this.iconCoordinates2(5, 23, 27, 25), primaryColor));
				// Outline for body
				edits.push(new Rect(...this.iconCoordinates2(5, 8, 27, 23), primaryColor));
				// Outline for casing
				edits.push(new Rect(...this.iconCoordinates2(5, 23, 27, 25), primaryColor));
				break;

			case Tool.TEXT:
				// --- Character 1: 'a' --- (Base Y=25, Height=7)
				edits.push(new Line(...this.iconCoordinates2(11, 25, 11, 18), primaryColor)); // Stem
				edits.push(new Line(...this.iconCoordinates2(6, 25, 11, 25), primaryColor)); // Bowl bottom
				edits.push(new Line(...this.iconCoordinates2(6, 25, 6, 20), primaryColor)); // Bowl left side
				edits.push(new Line(...this.iconCoordinates2(6, 20, 11, 20), primaryColor)); // Bowl top

				// --- Character 2: 'b' --- (Tall stem: Y=8, Loop Y=19)
				edits.push(new Line(...this.iconCoordinates2(14, 25, 14, 8), primaryColor)); // Tall stem
				edits.push(new Line(...this.iconCoordinates2(14, 25, 18, 25), primaryColor)); // Loop bottom
				edits.push(new Line(...this.iconCoordinates2(18, 25, 18, 19), primaryColor)); // Loop side
				edits.push(new Line(...this.iconCoordinates2(14, 19, 18, 19), primaryColor)); // Loop middle

				// --- Character 3: 'c' --- (Base Y=25, Height=8)
				edits.push(new Line(...this.iconCoordinates2(21, 25, 26, 25), primaryColor)); // Bottom
				edits.push(new Line(...this.iconCoordinates2(21, 25, 21, 18), primaryColor)); // Left side
				edits.push(new Line(...this.iconCoordinates2(21, 18, 26, 18), primaryColor)); // Top

				// --- Cursor (Thicker and Taller, from Y=7 to Y=28)
				edits.push(new Line(...this.iconCoordinates2(29, 7, 29, 28), primaryColor));
				edits.push(new Line(...this.iconCoordinates2(30, 7, 30, 28), primaryColor));
				break;

			case Tool.COLOR_PICKER:
				// --- Magnifying Glass over Color ---
				// Color Base (FillRect for color spectrum area)
				edits.push(new FillRect(...this.iconCoordinates2(5, 5, 27, 27), secondaryColor));
				// Magnifier Handle (Line)
				edits.push(new Line(...this.iconCoordinates2(27, 5, 20, 12), primaryColor));
				edits.push(new Line(...this.iconCoordinates2(26, 4, 19, 11), primaryColor));
				// Magnifier Loop (Rect to simulate circular loop)
				edits.push(new FillRect(...this.iconCoordinates2(11, 12, 19, 20), Color.WHITE));
				edits.push(new Rect(...this.iconCoordinates2(11, 12, 19, 20), primaryColor));
				break;

			case Tool.BUCKET_FILL:
				// --- Upright Bucket ---
				// Bucket Rim (Horizontal rectangle)
				edits.push(new FillRect(...this.iconCoordinates2(8, 5, 24, 7), primaryColor));
				// Bucket Body (Upright rectangle)
				edits.push(new FillRect(...this.iconCoordinates2(9, 7, 23, 25), secondaryColor));

				// Pour Spout (Top right corner)
				edits.push(new Line(...this.iconCoordinates2(23, 6, 26, 9), primaryColor));

				// Paint Drips (Paint coming out of the spout)
				// Fill near spout (paint coming out)
				edits.push(new FillRect(...this.iconCoordinates2(24, 8, 26, 12), primaryColor));
				// Paint puddle at bottom (no drip line)
				edits.push(new FillRect(...this.iconCoordinates2(23, 22, 27, 25), primaryColor));
				break;

			case Tool.PASTE:
				// --- Stacked Documents (Copy/Paste) ---
				// Back document (Offset bottom-right)
				edits.push(new Rect(...this.iconCoordinates2(7, 6, 29, 29), primaryColor));
				// Front document (Primary copy)
				edits.push(new Rect(...this.iconCoordinates2(4, 3, 26, 26), primaryColor));
				// Highlight/Fill for front document
				edits.push(new FillRect(...this.iconCoordinates2(6, 5, 24, 10), secondaryColor));
				break;
		}
		return edits;
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
	readonly tools = Object.values(Tool).filter(v => typeof v === 'number').map(tool => new UiToolButton(tool));
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
		let smallButtonSize = new Point(32);
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
