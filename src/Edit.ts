import {PasteData} from './Clipboard.js';
import Pixels from './Pixels.js';
import Color from './util/Color.js';
import Point from './util/Point.js';
import {boundRect, boundTransferRect, getIndex} from './util/util.js';

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
	constructor(start: Point, end: Point, delta: Point) {
		super([start, end, start.add(delta), end.add(delta), Move.center(start, end)]);
	}

	static center(p1: Point, p2: Point) {
		return p1.add(p2).scale(.5).round;
	}

	private get delta() {
		return this.points[2].subtract(this.points[0]);
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		let delta = this.delta;
		super.setPoint(index, point, shiftDown);
		let center = Move.center(this.points[0], this.points[1]);
		switch (index) {
			case 0:
			case 1:
				this.points_[index + 2] = this.points[index].add(delta);
				this.points_[4] = center.add(delta);
				break;
			case 2:
			case 3:
				this.points_[index - 2] = this.points[index].subtract(delta);
				this.points_[4] = center.add(delta);
				break;
			// todo allow moving center of start/end
			case 4:
				delta = this.points[4].subtract(center);
				if (shiftDown) {
					delta = Math.abs(delta.x) > Math.abs(delta.y) ? new Point(delta.x, 0) : new Point(0, delta.y);
					this.points_[4] = center.add(delta);
				}
				this.points_[2] = this.points[0].add(delta);
				this.points_[3] = this.points[1].add(delta);
				break;
		}
	}

	validCommit() {
		return !this.points[0].equals(this.points[1]);
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		let move = this.points[2].subtract(this.points[0]);
		let [min, max] = boundTransferRect(this.points[0], this.points[1], pixels.size, move, pixels.size);
		let clearLine = new Uint8ClampedArray((max.subtract(min).x + 1) * 4).fill(255);
		let copyLines = [];
		for (let y = min.y; y <= max.y; y++)
			copyLines[y] = sourcePixels.getLine(getIndex(min.x, y, pixels.width, true), getIndex(max.x + 1, y, pixels.width, true));
		for (let y = min.y; y <= max.y; y++)
			pixels.setLine(getIndex(min.x, y, pixels.width, true), clearLine);
		for (let y = min.y; y <= max.y; y++)
			pixels.setLine(getIndex(min.x + move.x, y + move.y, pixels.width, true), copyLines[y]);

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

	setPoint(index: number, point: Point, shiftDown: boolean) {
		super.setPoint(index, point, shiftDown);
		if (!shiftDown) return;
		let delta = this.points_[index].subtract(this.points_[1 - index]);
		delta = Math.abs(delta.x) > Math.abs(delta.y) ? new Point(delta.x, 0) : new Point(0, delta.y);
		this.points_[index] = this.points_[1 - index].add(delta);
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		let delta = this.points[1].subtract(this.points[0]);
		let steps = Math.max(Math.abs(delta.x), Math.abs(delta.y)) + 1;
		for (let i = 0; i <= steps; i++)
			pixels.set(this.points[0].add(delta.scale(i / steps).round), this.color);
	}
}

export class GridLine extends Move {
	private readonly color: Color;

	constructor(start: Point, end: Point, delta: Point, color: Color) {
		super(start, end, delta);
		this.color = color;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		for (let i = 0; i < 4; i++) {
			for (let x = 0; x <= pixels.width; x++)
				pixels.set(new Point(x, this.points[i].y), this.color);
			for (let y = 0; y <= pixels.height; y++)
				pixels.set(new Point(this.points[i].x, y), this.color);
		}
		new Rect(this.points[0], this.points[1], this.color).draw(pixels, sourcePixels, pending);
		new Rect(this.points[2], this.points[3], this.color).draw(pixels, sourcePixels, pending);
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
		delta = new Point(Math.abs(delta.x) < Math.abs(delta.y) ? delta.x : delta.y);
		this.points_[index] = this.points[1 - index].add(delta);
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		Rect.points(this.points[0], this.points[1], point => pixels.set(point, this.color));
	}
}

export class FillRect extends Rect {
	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		let [min, max] = boundRect(this.points[0], this.points[1], pixels.size);
		let line = new Uint8ClampedArray((max.subtract(min).x + 1) * 4);
		new Uint32Array(line.buffer).fill(this.color.int32);
		for (let y = min.y; y <= max.y; y++)
			pixels.setLine(getIndex(min.x, y, pixels.width, true), line);
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
	private readonly color: Color;
	text = '';
	private readonly fixedSize: number;

	constructor(point: Point, color: Color, text: string, fixedSize = 0) {
		super([point, point.add(new Point(0, TextEdit.lastSize))]);
		this.color = color;
		this.text = text;
		this.fixedSize = fixedSize;
	}

	private get size() {
		return Math.abs(this.points[1].subtract(this.points[0]).y);
	}

	setPoint(index: number, point: Point, shiftDown: boolean) {
		super.setPoint(index, point, shiftDown);
		if (index)
			TextEdit.lastSize = this.size;
		this.points_[1] = this.points[0].add(new Point(0, TextEdit.lastSize));
	}

	validCommit() {
		return !!this.text;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		let measureSize = this.measure;
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
					pixels.set(this.points[0].add(new Point(x, y)), this.color);
			}
		}
	}

	get measure() {
		this.updateContext();
		let metrics = TextEdit.ctx.measureText(this.text);
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
	}
}

export class Paste extends Edit {
	private readonly pasteData: PasteData;

	constructor(point: Point, pasteData: PasteData) {
		super([point]);
		this.pasteData = pasteData;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		let size = new Point(this.pasteData.width, this.pasteData.height);
		let [min, max] = boundTransferRect(Point.P0, size, size, this.points[0], pixels.size);
		for (let y = min.y; y <= max.y; y++)
			pixels.setLine(
				getIndex(min.x + this.points[0].x, y + this.points[0].y, pixels.width, true),
				this.pasteData.int8Array.subarray(getIndex(min.x, y, size.x, true), getIndex(max.x + 1, y, size.x, true)));
	}
}

