import {PasteData} from './Clipboard.js';
import Pixels from './Pixels.js';
import TextEditor from './TextEditor.js';
import Color from './util/Color.js';
import Point from './util/Point.js';
import {boundRect, boundTransferRect, getIndex, getIndexP, unique} from './util/util.js';

export class Edit {
	protected readonly points_: Point[];

	constructor(points: Point[]) {
		this.points_ = points;
	}

	get points(): readonly Point[] {
		return this.points_;
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		this.points_[index] = point;
	}

	validCommit() {
		return true;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean, editId: number) {
	}
}

export class Select extends Edit {
	constructor(start: Point, end: Point) {
		super([start, end]);
	}

	validCommit() {
		return !this.points[0].equals(this.points[1]);
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean, editId: number) {
		if (pending) {
			let colors = [Color.WHITE, Color.BLACK];
			Rect.points(this.points[0], this.points[1], (point, i) =>
				pixels.set(point, colors[i % colors.length], editId));
		}
	}
}

export class Preview extends Edit {
	readonly edit: Edit;
	readonly owner: number;
	private ownerIndexes: number[] | null = null;

	constructor(edit: Edit, owner: number = -1) {
		super([]);
		this.edit = edit;
		this.owner = owner;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean, editId: number) {
		if (this.owner !== -1) {
			this.ownerIndexes ||= sourcePixels.getOwnedBy(this.owner);

			this.ownerIndexes.forEach(i => {
				pixels.setIndex(i, Color.fromRgba(255, 0, 0, 255), 0);
				let p = getIndexP(i, pixels.width);
				pixels.setDirty(p);
			});
		}

		if (!this.ownerIndexes?.length) {
			let oldColor;
			if ('color' in this.edit) {
				oldColor = this.edit.color;
				this.edit.color = Color.fromRgba(255, 0, 0, 255);
			}
			this.edit.draw(pixels, sourcePixels, pending, 0);
			if ('color' in this.edit)
				this.edit.color = oldColor;
		}

		let min = this.edit.points[1] ? this.edit.points[0].min(this.edit.points[1]) : this.edit.points[0];
		let max = this.edit.points[1] ? this.edit.points[0].max(this.edit.points[1]) : this.edit.points[0];
		let padding = new Point(2);
		new Select(min.subtract(padding), max.add(padding)).draw(pixels, sourcePixels, pending, editId);
	}
}

export class Move extends Edit {
	constructor(start: Point, end: Point, delta: Point) {
		super([start, end, Move.center(start, end), start.add(delta), end.add(delta)]);
	}

	static center(p1: Point, p2: Point) {
		return p1.add(p2).scale(.5).round;
	}

	protected get delta() {
		return this.points[3].subtract(this.points[0]);
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		let delta = this.delta;
		super.setPoint(index, point, shiftDown);
		let center = Move.center(this.points[0], this.points[1]);
		switch (index) {
			case 0:
			case 1:
				this.points_[index + 3] = this.points[index].add(delta);
				this.points_[2] = center.add(delta);
				break;
			case 3:
			case 4:
				this.points_[index - 3] = this.points[index].subtract(delta);
				this.points_[2] = center.add(delta);
				break;
			case 2:
				delta = this.points[2].subtract(center);
				if (shiftDown) {
					delta = Math.abs(delta.x) > Math.abs(delta.y) ? new Point(delta.x, 0) : new Point(0, delta.y);
					this.points_[2] = center.add(delta);
				}
				this.points_[3] = this.points[0].add(delta);
				this.points_[4] = this.points[1].add(delta);
				break;
		}
	}

	validCommit() {
		return !this.points[3].equals(this.points[0]);
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean, editId: number) {
		let move = this.delta;
		let [min, max] = boundTransferRect(this.points[0], this.points[1], pixels.size, move, pixels.size);
		let clearLine = new Uint8ClampedArray((max.subtract(min).x + 1) * 4).fill(255);
		let copyLines = [];
		for (let y = min.y; y <= max.y; y++)
			copyLines[y] = sourcePixels.getLine(getIndex(min.x, y, pixels.width, true), getIndex(max.x + 1, y, pixels.width, true));
		for (let y = min.y; y <= max.y; y++)
			pixels.setLine(getIndex(min.x, y, pixels.width, true), clearLine, editId);
		for (let y = min.y; y <= max.y; y++)
			pixels.setLine(getIndex(min.x + move.x, y + move.y, pixels.width, true), copyLines[y], editId);
		pixels.setDirty(min, max);
		pixels.setDirty(min.add(move), max.add(move));
		new Select(this.points[0], this.points[1]).draw(pixels, sourcePixels, pending, editId);
		new Select(this.points[3], this.points[4]).draw(pixels, sourcePixels, pending, editId);
	}
}

export class Line extends Edit {
	private readonly color: Color;

	constructor(start: Point, end: Point, color: Color) {
		super([start, end]);
		this.color = color;
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		super.setPoint(index, point, shiftDown);
		if (!shiftDown) return;
		let delta = this.points_[index].subtract(this.points_[1 - index]);
		delta = Math.abs(delta.x) > Math.abs(delta.y) ? new Point(delta.x, 0) : new Point(0, delta.y);
		this.points_[index] = this.points_[1 - index].add(delta);
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean, editId: number) {
		let delta = this.points[1].subtract(this.points[0]);
		let steps = Math.max(Math.abs(delta.x), Math.abs(delta.y)) + 1;
		for (let i = 0; i <= steps; i++)
			pixels.set(this.points[0].add(delta.scale(i / steps).round), this.color, editId);
	}
}

export class StraightLine extends Edit {
	private readonly color: Color;

	constructor(start: Point, end: Point, color: Color) {
		super([start, end]);
		this.color = color;
	}

	get delta() {
		return this.points[0].subtract(this.points[1]);
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		let delta = this.delta;
		super.setPoint(index, point, shiftDown);
		if (index)
			this.points_[0] = this.points[1].add(delta);
		else {
			delta = this.delta;
			delta = Math.abs(delta.x) > Math.abs(delta.y) ? new Point(delta.x, 0) : new Point(0, delta.y);
			this.points_[0] = this.points_[1].add(delta);
		}
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean, editId: number) {
		if (this.delta.x)
			for (let x = 0; x < pixels.size.x; x++)
				pixels.set(new Point(x, this.points[0].y), this.color, editId);
		else
			for (let y = 0; y < pixels.size.y; y++)
				pixels.set(new Point(this.points[0].x, y), this.color, editId);
	}
}

export class GridLine extends Move {
	private readonly color: Color;

	constructor(start: Point, end: Point, delta: Point, color: Color) {
		super(start, end, delta);
		this.color = color;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean, editId: number) {
		let delta = this.delta;
		for (let i = 0; i < 2; i++) {
			if (!delta.y)
				for (let x = 0; x <= pixels.width; x += 2)
					pixels.set(new Point(x, this.points[i].y), this.color, editId);
			if (!delta.x)
				for (let y = 0; y <= pixels.height; y += 2)
					pixels.set(new Point(this.points[i].x, y), this.color, editId);
		}
		new Rect(this.points[0], this.points[1], this.color).draw(pixels, sourcePixels, pending, editId);
		if (delta.x || delta.y)
			new Rect(this.points[3], this.points[4], this.color).draw(pixels, sourcePixels, pending, editId);
	}
}

export class Rect extends Edit {
	protected readonly color: Color;

	constructor(start: Point, end: Point, color: Color) {
		super([start, end]);
		this.color = color;
	}

	static points(start: Point, end: Point, handler: (point: Point, index: number) => void) {
		let min = start.min(end);
		let max = start.max(end);
		let i = 0;
		for (let x = min.x; x <= max.x; x++)
			handler(new Point(x, min.y), i++);
		for (let x = min.x; x <= max.x; x++)
			handler(new Point(x, max.y), i++);
		for (let y = min.y; y <= max.y; y++)
			handler(new Point(min.x, y), i++);
		for (let y = min.y; y <= max.y; y++)
			handler(new Point(max.x, y), i++);
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		super.setPoint(index, point, shiftDown);
		if (!shiftDown) return;
		let delta = this.points[index].subtract(this.points[1 - index]);
		let magnitude = Math.min(Math.abs(delta.x), Math.abs(delta.y));
		this.points_[index] = this.points[1 - index].add(new Point(Math.sign(delta.x), Math.sign(delta.y)).scale(magnitude));
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean, editId: number) {
		Rect.points(this.points[0], this.points[1], point => pixels.set(point, this.color, editId));
	}
}

export class FillRect extends Rect {
	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean, editId: number) {
		let [min, max] = boundRect(this.points[0], this.points[1], pixels.size);
		let line = new Uint8ClampedArray((max.subtract(min).x + 1) * 4);
		new Uint32Array(line.buffer).fill(this.color.int32);
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

export class TextEdit extends Edit {
	static canvas = new OffscreenCanvas(0, 0);
	static ctx = TextEdit.canvas.getContext('2d', {willReadFrequently: true})!;
	static lastSize: number = 12;
	readonly textEditor = new TextEditor();
	private readonly color: Color;
	private readonly fixedSize: number;

	constructor(point: Point, color: Color, text: string, fixedSize = 0) {
		super([point, point.add(new Point(0, TextEdit.lastSize))]);
		this.textEditor.type(text);
		this.color = color;
		this.fixedSize = fixedSize;
	}

	private get size() {
		return Math.abs(this.points[1].subtract(this.points[0]).y);
	}

	get text() {
		return this.textEditor.state.text;
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		let size = this.size;
		super.setPoint(index, point, shiftDown);
		if (index) {
			size = this.size;
			TextEdit.lastSize = this.size;
		}
		this.points_[1] = this.points[0].add(new Point(0, size));
	}

	validCommit() {
		return !!this.text;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean, editId: number) {
		let measureSize = this.measure(this.text);
		if (this.text) {
			if (!measureSize.x || !measureSize.y) return;
			TextEdit.canvas.width = measureSize.x;
			TextEdit.canvas.height = measureSize.y;
			this.updateContext();
			TextEdit.ctx.fillText(this.text, 0, 0);
			let imageData = TextEdit.ctx.getImageData(0, 0, TextEdit.canvas.width, TextEdit.canvas.height);
			for (let x = 0; x < imageData.width; x++) {
				for (let y = 0; y < imageData.height; y++) {
					let index = (x + y * imageData.width) * 4;
					let a = imageData.data[index + 3];
					if (a > 150)
						pixels.set(this.points[0].add(new Point(x, y)), this.color, editId);
				}
			}
		}
		if (!pending) return;

		let cursorXs = [this.textEditor.state.cursor, this.textEditor.state.selectionStart]
			.filter(unique)
			.map(cursor => this.measure(this.text.slice(0, cursor)).x);
		let lines = cursorXs.map(cursorX => [new Point(cursorX, 0), new Point(cursorX, measureSize.y)]);
		if (cursorXs.length > 1) {
			lines.push([new Point(cursorXs[0], 0), new Point(cursorXs[1], 0)]);
			lines.push([new Point(cursorXs[0], measureSize.y), new Point(cursorXs[1], measureSize.y)]);
		}
		lines.forEach(([start, end]) =>
			new Line(this.points[0].add(start), this.points[0].add(end), this.color).draw(pixels, sourcePixels, pending, editId));
	}

	measure(text: string = this.text) {
		this.updateContext();
		let metrics = TextEdit.ctx.measureText(text);
		return new Point(Math.ceil(metrics.width), Math.ceil(metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent));
	}

	private updateContext() {
		TextEdit.ctx.font = `${this.fixedSize || this.size}px Arial`;
		TextEdit.ctx.imageSmoothingEnabled = false;
		TextEdit.ctx.textBaseline = 'top';
		TextEdit.ctx.globalAlpha = 1;
	}
}

export class BucketFill extends Edit {
	private readonly color: Color;

	constructor(point: Point, color: Color) {
		super([point]);
		this.color = color;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean, editId: number) {
		let targetColor = sourcePixels.get(this.points[0]);
		if (targetColor.int32 === this.color.int32) return;
		let queue = [this.points[0].x + this.points[0].y * pixels.width];
		while (queue.length) {
			let index = queue.pop()!;
			let x = index % pixels.width;
			let y = (index / pixels.width) | 0;
			if (pixels.get32(index) === this.color.int32) continue;
			if (sourcePixels.get32(index) !== targetColor.int32) continue;
			pixels.setIndex(index, this.color, editId);
			pixels.setDirty(new Point(x, y));
			if (x < pixels.width - 1) queue.push(index + 1);
			if (y < pixels.height - 1) queue.push(index + pixels.width);
			if (x > 0) queue.push(index - 1);
			if (y > 0) queue.push(index - pixels.width);
		}
	}
}

export class Paste extends Edit {
	private readonly pasteData: PasteData;

	constructor(point: Point, pasteData: PasteData) {
		super([point, point.add(new Point(pasteData.width, pasteData.height))]);
		this.pasteData = pasteData;
	}

	private get size() {
		return new Point(this.pasteData.width, this.pasteData.height);
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		super.setPoint(index, point, shiftDown);
		if (index)
			this.points_[0] = point.subtract(this.size);
		else
			this.points_[1] = point.add(this.size);
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean, editId: number) {
		let size = this.size;
		let [min, max] = boundTransferRect(Point.P0, size, size, this.points[0], pixels.size);
		for (let y = min.y; y <= max.y; y++)
			pixels.setLine(
				getIndex(min.x + this.points[0].x, y + this.points[0].y, pixels.width, true),
				this.pasteData.int8Array.subarray(getIndex(min.x, y, size.x, true), getIndex(max.x + 1, y, size.x, true)), editId);
		pixels.setDirty(min.add(this.points[0]), max.add(this.points[0]));
	}
}

export class Pen extends Edit {
	private readonly dots = [Point.P0];
	private readonly color: Color;

	constructor(point: Point, color: Color) {
		super([point, point]);
		this.color = color;
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		super.setPoint(index, point, shiftDown);
		if (index)
			this.points_[0] = point.add(this.dots.at(-1)!);
		else
			this.dots.push(point.subtract(this.points[1]));
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean, editId: number) {
		// todo draw when 1 point
		this.dots.forEach((dot, i, dots) => {
			if (i)
				new Line(this.points[1].add(dot), this.points[1].add(dots[i - 1]), this.color).draw(pixels, sourcePixels, pending, editId);
		});
	}
}
