import {Color, Point} from './base.js';
import {PasteData} from './Clipboard.js';
import Pixels from './Pixels.js';

export class Edit {
	protected readonly points_: Point[];

	constructor(points: Point[]) {
		this.points_ = points;
	}

	get points(): readonly Point[] {
		return this.points_;
	}

	setPoint(index: number, point: Point) {
		this.points_[index] = point;
	}

	validCommit() {
		return true;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
	}
}

export class Select extends Edit {
	constructor(start: Point, end: Point) {
		super([start, end]);
	}

	validCommit() {
		return !this.points[0].equals(this.points[1]);
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		if (pending) {
			let colors = [Color.WHITE, Color.BLACK];
			Rect.points(this.points[0], this.points[1], (point, i) =>
				pixels.set(point, colors[i % colors.length]));
		}
	}
}

export class Move extends Edit {
	private delta = new Point();

	constructor(start: Point, end: Point) {
		super([start, end, start, end, Move.center(start, end)]);
	}

	static center(p1: Point, p2: Point) {
		return p1.add(p2).scale(.5).round;
	}

	setPoint(index: number, point: Point) {
		super.setPoint(index, point);
		let center = Move.center(this.points[0], this.points[1]);
		switch (index) {
			case 0:
			case 1:
				this.points_[index + 2] = this.points[index].add(this.delta);
				this.points_[4] = center.add(this.delta);
				break;
			case 2:
			case 3:
				this.points_[index - 2] = this.points[index].subtract(this.delta);
				this.points_[4] = center.add(this.delta);
				break;
			case 4:
				this.delta = this.points[4].subtract(center);
				this.points_[2] = this.points[0].add(this.delta);
				this.points_[3] = this.points[1].add(this.delta);
				break;
		}
	}

	validCommit() {
		return !this.points[0].equals(this.points[1]);
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		let min = this.points[0].min(this.points[1]);
		let max = this.points[0].max(this.points[1]).add(new Point(1));
		let iterateClear = max.subtract(min);
		let clearLine = new Uint8ClampedArray(iterateClear.x * 4);
		new Uint32Array(clearLine.buffer).fill(255);

		let destMin = min.add(this.delta).max(new Point());
		let destMax = max.add(this.delta).min(pixels.size);
		let sourceMin = destMin.subtract(this.delta);
		let sourceMax = destMax.subtract(this.delta);
		let iterateCopy = sourceMax.subtract(sourceMin);
		let copyLines = [];

		for (let y = 0; y < iterateCopy.y; y++)
			copyLines[y] = sourcePixels.getLine((sourceMin.x + (sourceMin.y + y) * pixels.width) * 4, (sourceMin.x + iterateCopy.x + (sourceMin.y + y) * pixels.width) * 4);
		for (let y = 0; y < iterateClear.y; y++)
			pixels.setLine((min.x + (min.y + y) * pixels.width) * 4, clearLine);
		for (let y = 0; y < iterateCopy.y; y++)
			pixels.setLine((destMin.x + (destMin.y + y) * pixels.width) * 4, copyLines[y]);

		new Select(this.points[0], this.points[1]).draw(pixels, sourcePixels, pending);
		new Select(this.points[2], this.points[3]).draw(pixels, sourcePixels, pending);
	}
}

export class Line extends Edit {
	private readonly color: Color;

	constructor(start: Point, end: Point, color: Color) {
		super([start, end]);
		this.color = color;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		let delta = this.points[1].subtract(this.points[0]);
		let steps = Math.max(Math.abs(delta.x), Math.abs(delta.y)) + 1;
		for (let i = 0; i <= steps; i++)
			pixels.set(this.points[0].add(delta.scale(i / steps).round), this.color);
	}
}

export class StraightLine extends Line {
	setPoint(index: number, point: Point) {
		let delta = this.points_[0].subtract(this.points_[1]);
		super.setPoint(index, point);
		if (!index) {
			delta = this.points_[0].subtract(this.points_[1]);
			delta = Math.abs(delta.x) > Math.abs(delta.y) ? new Point(delta.x, 0) : new Point(0, delta.y);
		}
		this.points_[0] = this.points_[1].add(delta);
	}
}

export class Rect extends Edit {
	private readonly color: Color;

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

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		Rect.points(this.points[0], this.points[1], point => pixels.set(point, this.color));
	}
}

export class FillRect extends Edit {
	private readonly color: Color;

	constructor(start: Point, end: Point, color: Color) {
		super([start, end]);
		this.color = color;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		let min = this.points[0].min(this.points[1]);
		let max = this.points[0].max(this.points[1]);
		let delta = max.subtract(min);
		let fillLine = new Uint8ClampedArray(delta.x * 4);
		new Uint32Array(fillLine.buffer).fill(this.color.int32);
		for (let y = 0; y < delta.y; y++)
			pixels.setLine((min.x + (min.y + y) * pixels.width) * 4, fillLine);
	}
}

export class Clear extends FillRect {
	constructor(start: Point, end: Point) {
		super(start, end, Color.WHITE);
	}
}

export class TextEdit extends Edit {
	static lastSize: number = 12;
	private readonly color: Color;
	text = '';

	constructor(point: Point, color: Color) {
		super([point, point.add(new Point(0, TextEdit.lastSize))]);
		this.color = color;
	}

	get size() {
		return Math.abs(this.points[1].subtract(this.points[0]).y);
	}

	setPoint(index: number, point: Point) {
		super.setPoint(index, point);
		if (index)
			TextEdit.lastSize = this.size;
		this.points_[1] = this.points[0].add(new Point(0, TextEdit.lastSize));
	}

	validCommit() {
		return !!this.text;
	}

	private setContext(canvas: HTMLCanvasElement) {
		let ctx = canvas.getContext('2d')!;
		ctx.font = `${this.size}px Arial`;
		ctx.imageSmoothingEnabled = false;
		ctx.textBaseline = 'top';
		ctx.globalAlpha = 1;
		return ctx;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		let canvas = document.createElement('canvas');
		let ctx = this.setContext(canvas);
		let metrics = ctx.measureText(this.text);
		canvas.width = Math.ceil(metrics.width);
		if (!canvas.width) return;
		canvas.height = Math.ceil(metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent);
		ctx = this.setContext(canvas);
		ctx.fillText(this.text, 0, 0);
		let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		for (let x = 0; x < imageData.width; x++) {
			for (let y = 0; y < imageData.height; y++) {
				let index = (x + y * imageData.width) * 4;
				let a = imageData.data[index + 3];
				if (a > 150)
					pixels.set(this.points[0].add(new Point(x, y)), this.color);
			}
		}
	}
}

export class BucketFill extends Edit {
	private readonly color: Color;

	constructor(point: Point, color: Color) {
		super([point]);
		this.color = color;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		let targetColor = sourcePixels.get(this.points[0]);
		if (targetColor.int32 === this.color.int32) return;
		let queue = [this.points[0].x + this.points[0].y * pixels.width];
		while (queue.length) {
			let index = queue.pop()!;
			let x = index % pixels.width;
			let y = (index / pixels.width) | 0;
			if (pixels.get32(index) === this.color.int32) continue;
			if (sourcePixels.get32(index) !== targetColor.int32) continue;
			pixels.setIndex(index, this.color);
			if (x < pixels.width - 1) queue.push(index + 1);
			if (y < pixels.height - 1) queue.push(index + pixels.width);
			if (x > 0) queue.push(index - 1);
			if (y > 0) queue.push(index - pixels.width);
		}
		// todo optimize by batching horizontal lines
	}
}

export class Paste extends Edit {
	// todo serialize this
	private readonly pasteData: PasteData;

	constructor(point: Point, pasteData: PasteData) {
		super([point]);
		this.pasteData = pasteData;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		let size = pixels.size.subtract(this.points[0]).min(new Point(this.pasteData.width, this.pasteData.height));
		for (let y = 0; y < size.y; y++) {
			pixels.setLine(
				(this.points[0].x + (this.points[0].y + y) * pixels.width) * 4,
				this.pasteData.int8Array.subarray(y * size.x * 4, y * size.x * 4 + size.x * 4));
		}
	}
}
