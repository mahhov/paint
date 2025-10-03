import {A, Color, NEAR_RANGE, Point} from './base.js';
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
		return this.points_.length >= 2 && this.points[1].subtract(this.points[0]).magnitude2 >= NEAR_RANGE ** 2;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
	}
}

export class Select extends Edit {
	constructor(start: Point, end: Point) {
		super([start, end]);
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
		this.points_[index] = point;
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

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		let min = this.points[0].min(this.points[1]);
		let max = this.points[0].max(this.points[1]).add(new Point(1));
		let iterateClear = max.subtract(min);
		let clearLine = new Uint8ClampedArray(iterateClear.x * 4).fill(255);

		let destMin = min.add(this.delta).max(new Point());
		let destMax = max.add(this.delta).min(pixels.size);
		let sourceMin = destMin.subtract(this.delta);
		let sourceMax = destMax.subtract(this.delta);
		let iterateCopy = sourceMax.subtract(sourceMin);
		let copyLines = [];

		for (let y = 0; y < iterateCopy.y; y++)
			copyLines[y] = sourcePixels.imageData.data.slice((sourceMin.x + (sourceMin.y + y) * pixels.width) * 4, (sourceMin.x + iterateCopy.x + (sourceMin.y + y) * pixels.width) * 4);
		for (let y = 0; y < iterateClear.y; y++)
			pixels.imageData.data.set(clearLine, (min.x + (min.y + y) * pixels.width) * 4);
		for (let y = 0; y < iterateCopy.y; y++)
			pixels.imageData.data.set(copyLines[y], (destMin.x + (destMin.y + y) * pixels.width) * 4);

		// if (pending) {
		new Select(this.points[0], this.points[1]).draw(pixels, sourcePixels, pending);
		new Select(this.points[2], this.points[3]).draw(pixels, sourcePixels, pending);
		// let colors = [Color.WHITE, Color.BLACK];
		// Rect.points(this.points[0], this.points[1], (point, i) =>
		// 	pixels.set(point, colors[i % colors.length]));
		// Rect.points(this.points[2], this.points[3], (point, i) =>
		// 	pixels.set(point, colors[i % colors.length]));
		// }
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
		let steps = Math.max(Math.abs(delta.x), Math.abs(delta.y));
		for (let i = 0; i <= steps; i++)
			pixels.set(this.points[0].add(delta.scale(i / steps).round), this.color);
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

	static points(start: Point, end: Point, handler: (point: Point, index: number) => void) {
		let min = start.min(end);
		let max = start.max(end);
		let i = 0;
		for (let x = min.x; x <= max.x; x++)
			for (let y = min.y; y <= max.y; y++)
				handler(new Point(x, y), i++);
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		FillRect.points(this.points[0], this.points[1], point => pixels.set(point, this.color));
	}
}

export class Clear extends Edit {
	constructor(start: Point, end: Point) {
		super([start, end]);
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		FillRect.points(this.points[0], this.points[1], point => pixels.set(point, Color.WHITE));
	}
}

export class TextEdit extends Edit {
	private readonly size: number;
	private readonly color: Color;

	constructor(pos: Point, size: number, color: Color) {
		super([pos]);
		this.size = size;
		this.color = color;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
	}
}

export class BucketFill extends Edit {
	private readonly color: Color;

	constructor(pos: Point, color: Color) {
		super([pos]);
		this.color = color;
	}

	validCommit() {
		return true;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
	}
}

export class Paste extends Edit {
	private readonly pixelArray: Color[][];

	constructor(pos: Point, pixelArray: Color[][]) {
		super([pos]);
		this.pixelArray = pixelArray;
	}

	static async clipboardPixelArray(e: ClipboardEvent): Promise<Color[][]> {
		return new Promise((resolve, reject) => {
			let canvas = document.createElement('canvas');
			let ctx = canvas.getContext('2d');
			if (!ctx) return reject('no canvas context');

			if (!e.clipboardData) return reject('no clipboard data');
			let clipboardItem = [...e.clipboardData.items]
				.find(item => item.type.startsWith('image/'));
			if (!clipboardItem) return reject('no clipboard image data');
			let blob = clipboardItem.getAsFile();
			if (!blob) return reject(('no clipboard image blob data'));
			let reader = new FileReader();

			reader.onload = e => {
				let img = document.createElement('img');
				img.onload = () => {
					canvas.width = img.width;
					canvas.height = img.height;
					ctx.drawImage(img, 0, 0);
					let imageData = ctx.getImageData(0, 0, img.width, img.height);
					let pixelArray = A(img.width).map((_, x) => A(img.height).map((_, y) => {
						let index = (x + y * img.width) * 4;
						let rgb = [...imageData.data.subarray(index, index + 3)] as [number, number, number];
						return new Color(...rgb);
					}));
					resolve(pixelArray);
				};
				img.src = e.target?.result as string;
			};
			reader.readAsDataURL(blob);
		});
	}

	validCommit() {
		return true;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		this.pixelArray.forEach((column, x) =>
			column.forEach((color, y) =>
				pixels.set(this.points[0].add(new Point(x, y)), color)));
	}
}
