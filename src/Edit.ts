import {PasteData} from './Clipboard.js';
import Pixels from './Pixels.js';
import TextEditor from './TextEditor.js';
import Color from './util/Color.js';
import Point from './util/Point.js';
import {boundRect, boundTransferRect, clamp, getIndex, getPIndex, unique} from './util/util.js';

export enum DrawMode {
	NORMAL,
	PENDING,
	PREVIEW,
}

export class Edit {
	protected static lastThickness = 0;

	protected static alignPoints(point: Point, other: Point) {
		return point.subtract(other).flatten().add(other);
	}

	protected static squareRect(point: Point, other: Point) {
		let delta = point.subtract(other);
		let magnitude = Math.min(Math.abs(delta.x), Math.abs(delta.y));
		return other.add(new Point(Math.sign(delta.x), Math.sign(delta.y)).scale(magnitude));
	}

	protected static getThicknessPoint(point: Point, thickness: number) {
		return point.add(new Point(thickness + 10, 0));
	}

	protected static readThicknessPoint(delta: Point) {
		return clamp(delta.x - 10, 0, 20);
	}

	get points(): Point[] {return [];};

	setPoint(index: number, point: Point, shiftDown: boolean) {};

	validCommit() {
		return true;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, drawMode: DrawMode, editId: number) {
	}
}

export class EditWith2Points extends Edit {
	protected start: Point;
	protected end: Point;
	protected readonly color: Color;

	constructor(start: Point, end: Point, color: Color) {
		super();
		this.start = start;
		this.end = end;
		this.color = color;
	}

	get points() {
		return [this.end, this.start];
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		switch (index) {
			case 0:
				this.end = point;
				break;
			case 1:
				this.start = point;
				break;
		}
	}
}

export class Select extends EditWith2Points {
	constructor(start: Point, end: Point) {
		super(start, end, Color.WHITE);
	}

	draw(pixels: Pixels, sourcePixels: Pixels, drawMode: DrawMode, editId: number) {
		if (drawMode === DrawMode.NORMAL) return;
		let min = this.start.min(this.end);
		let max = this.start.max(this.end);
		let colors = [Color.WHITE, Color.BLACK];
		let i = 0;
		for (let x = min.x; x <= max.x; x++)
			pixels.set(new Point(x, min.y), colors[i++ % colors.length], editId);
		for (let x = min.x; x <= max.x; x++)
			pixels.set(new Point(x, max.y), colors[i++ % colors.length], editId);
		for (let y = min.y; y <= max.y; y++)
			pixels.set(new Point(min.x, y), colors[i++ % colors.length], editId);
		for (let y = min.y; y <= max.y; y++)
			pixels.set(new Point(max.x, y), colors[i++ % colors.length], editId);
	}
}

export class Preview extends Edit {
	readonly edit: Edit;

	constructor(edit: Edit) {
		super();
		this.edit = edit;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, drawMode: DrawMode, editId: number) {
		console.assert(drawMode === DrawMode.PREVIEW);
		this.edit.draw(pixels, sourcePixels, drawMode, 200);
		let points = this.edit.points;
		let min = points.length >= 2 ? points[0].min(points[1]) : points[0];
		let max = points.length >= 2 ? points[0].max(points[1]) : points[0];
		let padding = new Point(2);
		new Select(min.subtract(padding), max.add(padding)).draw(pixels, sourcePixels, drawMode, editId);
	}
}

export class Move extends Edit {
	protected start: Point;
	protected end: Point;
	protected delta: Point;

	constructor(start: Point, end: Point, delta: Point) {
		super();
		this.start = start;
		this.end = end;
		this.delta = delta;
	}

	private get center() {
		return this.start.add(this.end).scale(.5).round;
	}

	get destStart() {
		return this.start.add(this.delta);
	}

	get destEnd() {
		return this.end.add(this.delta);
	}

	protected get destCenter() {
		return this.center.add(this.delta);
	}

	get points() {
		return [this.start, this.end, this.destCenter, this.destStart, this.destEnd];
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		switch (index) {
			case 0:
				this.start = point;
				break;
			case 1:
				this.end = point;
				break;
			case 2:
				this.delta = point.subtract(this.center);
				if (shiftDown)
					this.delta = this.delta.flatten();
				break;
			case 3:
				this.start = this.start.add(point.subtract(this.destStart));
				break;
			case 4:
				this.end = this.end.add(point.subtract(this.destEnd));
				break;
		}
	}

	validCommit() {
		return !this.delta.equals(Point.P0);
	}

	draw(pixels: Pixels, sourcePixels: Pixels, drawMode: DrawMode, editId: number) {
		if (drawMode === DrawMode.PREVIEW) {
			new FillRect(this.start, this.end, Color.PREVIEW_HIGHLIGHT).draw(pixels, sourcePixels, DrawMode.NORMAL, editId);
			new FillRect(this.destStart, this.destEnd, Color.PREVIEW_HIGHLIGHT).draw(pixels, sourcePixels, DrawMode.NORMAL, editId);
			return;
		}

		let [min, max] = boundTransferRect(this.start, this.end, pixels.size, this.delta, pixels.size);
		let clearLine = new Uint8ClampedArray((max.subtract(min).x + 1) * 4).fill(255);
		let copyLines = [];
		for (let y = min.y; y <= max.y; y++)
			copyLines[y] = sourcePixels.getLine(getIndex(min.x, y, pixels.width, true), getIndex(max.x + 1, y, pixels.width, true));
		for (let y = min.y; y <= max.y; y++)
			pixels.setLine(getIndex(min.x, y, pixels.width, true), clearLine, editId);
		for (let y = min.y; y <= max.y; y++)
			pixels.setLine(getIndex(min.x + this.delta.x, y + this.delta.y, pixels.width, true), copyLines[y], editId);
		pixels.setDirty(min, max);
		pixels.setDirty(min.add(this.delta), max.add(this.delta));
		new Select(this.start, this.end).draw(pixels, sourcePixels, drawMode, editId);
		new Select(this.destStart, this.destEnd).draw(pixels, sourcePixels, drawMode, editId);
	}
}

export class Line extends EditWith2Points {
	private thickness: number;

	constructor(start: Point, end: Point, thickness = Edit.lastThickness, color: Color) {
		super(start, end, color);
		this.thickness = thickness;
	}

	get points() {
		return super.points.concat(Edit.getThicknessPoint(this.end, this.thickness));
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		if (index <= 1) {
			if (shiftDown)
				point = Edit.alignPoints(point, this.points[1 - index]);
			super.setPoint(index, point, shiftDown);
		} else
			Edit.lastThickness = this.thickness = Edit.readThicknessPoint(point.subtract(this.end));
	}

	draw(pixels: Pixels, sourcePixels: Pixels, drawMode: DrawMode, editId: number) {
		let color = drawMode === DrawMode.PREVIEW ? Color.PREVIEW_FILL : this.color;
		let delta = this.end.subtract(this.start);
		let steps = Math.max(Math.abs(delta.x), Math.abs(delta.y)) + 1;
		let thickness = new Point(this.thickness / 2);
		for (let step = 0; step <= steps; step++) {
			let point = this.start.add(delta.scale(step / steps));
			new FillRect(point.subtract(thickness).round, point.add(thickness).round, color).draw(pixels, sourcePixels, DrawMode.NORMAL, editId);
		}
	}
}

export class StraightLine extends Edit {
	private position: Point;
	private control: Point;
	private readonly color: Color;

	constructor(position: Point, control: Point, color: Color) {
		super();
		this.position = position;
		this.control = control;
		this.color = color;
	}

	get points() {
		return [this.control, this.position];
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		switch (index) {
			case 0:
				this.control = Edit.alignPoints(point, this.position);
				break;
			case 1:
				this.control = this.control.subtract(this.position).add(point);
				this.position = point;
				break;
		}
	}

	draw(pixels: Pixels, sourcePixels: Pixels, drawMode: DrawMode, editId: number) {
		let color = drawMode === DrawMode.PREVIEW ? Color.PREVIEW_FILL : this.color;
		if (this.control.x !== this.position.x)
			for (let x = 0; x < pixels.size.x; x++)
				pixels.set(new Point(x, this.control.y), color, editId);
		else
			for (let y = 0; y < pixels.size.y; y++)
				pixels.set(new Point(this.control.x, y), color, editId);
	}
}

export class Measure extends EditWith2Points {
	private offset: Point;

	constructor(start: Point, end: Point, offset: Point, color: Color) {
		super(start, end, color);
		this.offset = offset;
	}

	private get center() {
		return this.start.add(this.end).scale(.5).round;
	}

	get points() {
		return super.points.concat(this.center.add(this.offset));
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		if (index <= 1) {
			if (shiftDown)
				point = Edit.alignPoints(point, this.points[1 - index]);
			super.setPoint(index, point, shiftDown);
		} else
			this.offset = point.subtract(this.center).subtract(new Point(0, 0));
	}

	draw(pixels: Pixels, sourcePixels: Pixels, drawMode: DrawMode, editId: number) {
		let color = drawMode === DrawMode.PREVIEW ? Color.PREVIEW_FILL : this.color;
		let delta = this.end.subtract(this.start);
		if (delta.x && delta.y) {
			new Rect(this.start, this.end, 0, color).draw(pixels, sourcePixels, DrawMode.NORMAL, editId);
			new FixedTextEdit(this.center.add(this.offset).add(new Point(2)), 12, color, `${Math.abs(delta.x)} x ${Math.abs(delta.y)}`).draw(pixels, sourcePixels, DrawMode.NORMAL, editId);
		} else if (delta.x || delta.y) {
			new Line(this.start, this.end, 0, color).draw(pixels, sourcePixels, DrawMode.NORMAL, editId);
			new FixedTextEdit(this.center.add(this.offset).add(new Point(2)), 12, color, String(Math.abs(delta.x || delta.y))).draw(pixels, sourcePixels, DrawMode.NORMAL, editId);
		}
	}
}

export class Rect extends EditWith2Points {
	private thickness: number;

	constructor(start: Point, end: Point, thickness = Edit.lastThickness, color: Color) {
		super(start, end, color);
		this.thickness = thickness;
	}

	get points() {
		return super.points.concat(Edit.getThicknessPoint(this.end, this.thickness));
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		if (index <= 1) {
			if (shiftDown)
				point = Edit.squareRect(point, this.points[1 - index]);
			super.setPoint(index, point, shiftDown);
		} else
			Edit.lastThickness = this.thickness = Edit.readThicknessPoint(point.subtract(this.end));
	}

	draw(pixels: Pixels, sourcePixels: Pixels, drawMode: DrawMode, editId: number) {
		let color = drawMode === DrawMode.PREVIEW ? Color.PREVIEW_FILL : this.color;
		let min = this.start.min(this.end);
		let max = this.start.max(this.end);
		let cornerTopRight = new Point(max.x, min.y);
		let cornerBottomLeft = new Point(min.x, max.y);
		new FillRect(min, cornerTopRight.add(new Point(0, this.thickness)), color).draw(pixels, sourcePixels, DrawMode.NORMAL, editId); // top
		new FillRect(cornerBottomLeft, max.subtract(new Point(0, this.thickness)), color).draw(pixels, sourcePixels, DrawMode.NORMAL, editId); // bottom
		new FillRect(min, cornerBottomLeft.add(new Point(this.thickness, 0)), color).draw(pixels, sourcePixels, DrawMode.NORMAL, editId); // left
		new FillRect(cornerTopRight, max.subtract(new Point(this.thickness, 0)), color).draw(pixels, sourcePixels, DrawMode.NORMAL, editId); // right
	}
}

export class FillRect extends EditWith2Points {
	setPoint(index: number, point: Point, shiftDown: boolean) {
		if (shiftDown)
			point = Edit.squareRect(point, this.points[1 - index]);
		super.setPoint(index, point, shiftDown);
	}

	draw(pixels: Pixels, sourcePixels: Pixels, drawMode: DrawMode, editId: number) {
		let color = drawMode === DrawMode.PREVIEW ? Color.PREVIEW_HIGHLIGHT : this.color;
		let [min, max] = boundRect(this.start, this.end, pixels.size);
		let line = new Uint8ClampedArray((max.subtract(min).x + 1) * 4);
		new Uint32Array(line.buffer).fill(color.int32);
		for (let y = min.y; y <= max.y; y++)
			pixels.setLine(getIndex(min.x, y, pixels.width, true), line, editId);
		pixels.setDirty(min, max);
	}
}

export class Clear extends FillRect {
	constructor(start: Point, end: Point) {
		super(start, end, Color.WHITE);
	}
}

abstract class BaseTextEdit extends Edit {
	static canvas = new OffscreenCanvas(0, 0);
	static ctx = BaseTextEdit.canvas.getContext('2d', {willReadFrequently: true})!;
	protected position: Point;
	protected readonly color: Color;

	protected constructor(position: Point, color: Color) {
		super();
		this.position = position;
		this.color = color;
	}

	protected abstract get text(): string;

	protected abstract get size(): number;

	draw(pixels: Pixels, sourcePixels: Pixels, drawMode: DrawMode, editId: number) {
		let color = drawMode === DrawMode.PREVIEW ? Color.PREVIEW_FILL : this.color;
		let measureSize = this.measure(this.text);
		if (!measureSize.x || !measureSize.y) return;
		BaseTextEdit.canvas.width = measureSize.x;
		BaseTextEdit.canvas.height = measureSize.y;
		this.updateContext();
		BaseTextEdit.ctx.fillText(this.text, 0, 0);
		let imageData = BaseTextEdit.ctx.getImageData(0, 0, BaseTextEdit.canvas.width, BaseTextEdit.canvas.height);
		for (let x = 0; x < imageData.width; x++) {
			for (let y = 0; y < imageData.height; y++) {
				let index = (x + y * imageData.width) * 4;
				let a = imageData.data[index + 3];
				if (a > 150)
					pixels.set(this.position.add(new Point(x, y)), color, editId);
			}
		}
	}

	measure(text = this.text) {
		this.updateContext();
		let metrics = BaseTextEdit.ctx.measureText(text);
		return new Point(Math.ceil(metrics.width), Math.ceil(metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent));
	}

	private updateContext() {
		BaseTextEdit.ctx.font = `${this.size}px Arial`;
		BaseTextEdit.ctx.imageSmoothingEnabled = false;
		BaseTextEdit.ctx.textBaseline = 'top';
		BaseTextEdit.ctx.globalAlpha = 1;
	}
}

export class FixedTextEdit extends BaseTextEdit {
	protected readonly text: string;
	protected readonly size: number;

	constructor(position: Point, size: number, color: Color, text: string) {
		super(position, color);
		this.size = size;
		this.text = text;
	}

	get points() {
		return [this.position];
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		this.position = point;
	}
}

export class TextEdit extends BaseTextEdit {
	private static lastSize = 12;
	readonly textEditor = new TextEditor();
	protected size: number;

	constructor(position: Point, text: string, size = TextEdit.lastSize, color: Color) {
		super(position, color);
		this.textEditor.type(text);
		this.size = size;
	}

	protected get text() {
		return this.textEditor.state.text;
	}

	get points() {
		return [this.position, this.position.add(new Point(0, this.size))];
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		switch (index) {
			case 0:
				this.position = point;
				break;
			case 1:
				TextEdit.lastSize = this.size = Math.abs(point.subtract(this.position).y);
				break;
		}
	}

	validCommit() {
		return !!this.text;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, drawMode: DrawMode, editId: number) {
		if (this.text)
			super.draw(pixels, sourcePixels, drawMode, editId);

		if (drawMode === DrawMode.PENDING) {
			let measureSize = this.measure(this.text);
			let cursorXs = [this.textEditor.state.cursor, this.textEditor.state.selectionStart]
				.filter(unique)
				.map(cursor => this.measure(this.text.slice(0, cursor)).x);
			let lines = cursorXs.map(cursorX => [new Point(cursorX, 0), new Point(cursorX, measureSize.y)]);
			if (cursorXs.length > 1) {
				lines.push([new Point(cursorXs[0], 0), new Point(cursorXs[1], 0)]);
				lines.push([new Point(cursorXs[0], measureSize.y), new Point(cursorXs[1], measureSize.y)]);
			}
			lines.forEach(([start, end]) =>
				new Line(this.position.add(start), this.position.add(end), 0, this.color).draw(pixels, sourcePixels, DrawMode.NORMAL, editId));
		}
	}
}

export class ColorDiff extends Move {
	constructor(start: Point, end: Point, delta: Point) {
		super(start, end, delta);
	}

	draw(pixels: Pixels, sourcePixels: Pixels, drawMode: DrawMode, editId: number) {
		if (drawMode === DrawMode.PREVIEW) {
			super.draw(pixels, sourcePixels, drawMode, editId);
			return;
		}

		let [min, max] = boundTransferRect(this.start, this.end, pixels.size, this.delta, pixels.size);
		let deltaIndex = getPIndex(this.delta, pixels.width);
		let diffLines: Uint8ClampedArray[] = [];
		for (let y = min.y; y <= max.y; y++) {
			diffLines[y] = new Uint8ClampedArray((max.x - min.x + 1) * 4);
			let diffLineView = new Uint32Array(diffLines[y].buffer);
			for (let x = min.x; x <= max.x; x++) {
				let index = getIndex(x, y, pixels.width);
				diffLineView[x - min.x] = Color.subtract(sourcePixels.get32(index), sourcePixels.get32(index + deltaIndex));
			}
		}
		for (let y = min.y; y <= max.y; y++)
			pixels.setLine(getIndex(min.x + this.delta.x, y + this.delta.y, pixels.width, true), diffLines[y], editId);
		pixels.setDirty(min, max);
		pixels.setDirty(min.add(this.delta), max.add(this.delta));
		new Select(this.start, this.end).draw(pixels, sourcePixels, drawMode, editId);
		new Select(this.destStart, this.destEnd).draw(pixels, sourcePixels, drawMode, editId);
	}
}

export class BucketFill extends Edit {
	private position: Point;
	private readonly color: Color;

	constructor(position: Point, color: Color) {
		super();
		this.position = position;
		this.color = color;
	}

	get points() {
		return [this.position];
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		this.position = point;
	}

	private scanHorizontal(x: number, y: number, sourcePixels: Pixels, targetColor: number): [number, number] | null {
		let index = getIndex(x, y, sourcePixels.width);
		if (sourcePixels.get32(index) !== targetColor) return null;
		let leftX = x;
		while (leftX > 0 && sourcePixels.get32(getIndex(leftX - 1, y, sourcePixels.width)) === targetColor)
			leftX--;
		let rightX = x;
		while (rightX < sourcePixels.width - 1 && sourcePixels.get32(getIndex(rightX + 1, y, sourcePixels.width)) === targetColor)
			rightX++;
		return [leftX, rightX];
	}

	draw(pixels: Pixels, sourcePixels: Pixels, drawMode: DrawMode, editId: number) {
		let color = drawMode === DrawMode.PREVIEW ? Color.PREVIEW_HIGHLIGHT : this.color;
		let index = getPIndex(this.position, pixels.width);
		let targetColor = sourcePixels.get32(index);
		if (targetColor === color.int32) return;
		let queue: [[number, number], number, boolean, boolean][] = [[this.scanHorizontal(this.position.x, this.position.y, sourcePixels, targetColor)!, this.position.y, true, true]];
		let line = new Uint8ClampedArray(pixels.width * 4);
		new Uint32Array(line.buffer).fill(color.int32);

		while (queue.length) {
			let [[left, right], y, up, down] = queue.pop()!;
			let index = getIndex(left, y, pixels.width);
			if (pixels.get32(index) === color.int32) continue;
			pixels.setLine(index * 4, line.subarray(0, (right - left + 1) * 4), editId);
			pixels.setDirty(new Point(left, y), new Point(right, y));
			if (up && y > 0) {
				for (let x = left; x <= right;) {
					let scan = this.scanHorizontal(x, y - 1, sourcePixels, targetColor);
					if (scan) {
						queue.push([scan, y - 1, true, scan[0] < left || scan[1] > right]);
						x = scan[1] + 2;
					} else
						x++;
				}
			}
			if (down && y < pixels.height - 1) {
				for (let x = left; x <= right;) {
					let scan = this.scanHorizontal(x, y + 1, sourcePixels, targetColor);
					if (scan) {
						queue.push([scan, y + 1, scan[0] < left || scan[1] > right, true]);
						x = scan[1] + 2;
					} else
						x++;
				}
			}
		}
	}
}

export class Paste extends Edit {
	private position: Point;
	private readonly pasteData: PasteData;

	constructor(position: Point, pasteData: PasteData) {
		super();
		this.position = position;
		this.pasteData = pasteData;
	}

	private get size() {
		return new Point(this.pasteData.width, this.pasteData.height);
	}

	get points() {
		return [this.position, this.position.add(this.size)];
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		switch (index) {
			case 0:
				this.position = point;
				break;
			case 1:
				this.position = point.subtract(this.size);
				break;
		}
	}

	draw(pixels: Pixels, sourcePixels: Pixels, drawMode: DrawMode, editId: number) {
		let size = this.size;
		if (drawMode === DrawMode.PREVIEW) {
			new FillRect(this.position, this.position.add(size), Color.PREVIEW_HIGHLIGHT).draw(pixels, sourcePixels, DrawMode.NORMAL, editId);
			return;
		}
		let [min, max] = boundTransferRect(Point.P0, size, size, this.position, pixels.size);
		for (let y = min.y; y <= max.y; y++)
			pixels.setLine(
				getIndex(min.x + this.position.x, y + this.position.y, pixels.width, true),
				this.pasteData.int8Array.subarray(getIndex(min.x, y, size.x, true), getIndex(max.x + 1, y, size.x, true)), editId);
		pixels.setDirty(min.add(this.position), max.add(this.position));
	}
}

export class Pen extends Edit {
	private position: Point;
	private readonly dots = [Point.P0];
	private thickness: number;
	private readonly color: Color;

	constructor(position: Point, thickness = Edit.lastThickness, color: Color) {
		super();
		this.position = position;
		this.thickness = thickness;
		this.color = color;
	}

	private get end() {
		return this.position.add(this.dots.at(-1)!);
	}

	get points() {
		return [this.end, this.position, Edit.getThicknessPoint(this.end, this.thickness)];
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		switch (index) {
			case 0:
				let newDot = point.subtract(this.position);
				if (!newDot.equals(this.dots.at(-1)!))
					this.dots.push(newDot);
				break;
			case 1:
				this.position = point;
				break;
			case 2:
				Edit.lastThickness = this.thickness = Edit.readThicknessPoint(point.subtract(this.end));
				break;
		}
	}

	draw(pixels: Pixels, sourcePixels: Pixels, drawMode: DrawMode, editId: number) {
		let color = drawMode === DrawMode.PREVIEW ? Color.PREVIEW_FILL : this.color;
		if (this.dots.length > 1)
			this.dots.forEach((dot, i, dots) => {
				if (i)
					new Line(this.position.add(dot), this.position.add(dots[i - 1]), this.thickness, color).draw(pixels, sourcePixels, DrawMode.NORMAL, editId);
			});
		else
			pixels.set(this.position.add(this.dots[0]), color, editId);
	}
}

export class Dot extends Edit {
	private readonly position: Point;
	private readonly color: Color;

	constructor(position: Point, color: Color) {
		super();
		this.position = position;
		this.color = color;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, drawMode: DrawMode, editId: number) {
		pixels.set(this.position, this.color, editId);
	}
}
