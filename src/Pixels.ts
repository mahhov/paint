import {Color, Point} from './base.js';

export default class Pixels {
	readonly width: number;
	readonly height: number;
	private readonly defaultColor: Color;
	readonly imageData: ImageData;
	private readonly cachedClearedImageDataData: Uint8ClampedArray;

	constructor(width: number, height: number, ctx: CanvasRenderingContext2D, defaultColor: Color) {
		this.width = width;
		this.height = height;
		this.defaultColor = defaultColor;
		this.imageData = ctx.createImageData(width, height);
		this.cachedClearedImageDataData = new Uint8ClampedArray(width * height * 4);
		new Uint32Array(this.cachedClearedImageDataData.buffer).fill(this.defaultColor.int32);
		this.clear();
	}

	get size() {
		return new Point(this.width, this.height);
	}

	get(p: Point) {
		if (!this.isInBounds(p))
			return this.defaultColor;
		let index = (p.x + p.y * this.width) * 4;
		return new Color(
			this.imageData.data[index],
			this.imageData.data[index + 1],
			this.imageData.data[index + 2],
			this.imageData.data[index + 3]);
	}

	set(p: Point, c: Color) {
		if (this.isInBounds(p)) {
			let index = (p.x + p.y * this.width) * 4;
			this.imageData.data.set(c.int8, index);
		}
	}

	clear() {
		this.imageData.data.set(this.cachedClearedImageDataData);
	}

	isInBounds(p: Point) {
		return p.x >= 0 && p.x < this.width && p.y >= 0 && p.y < this.height;
	}

	debug() {
		let seen1: Record<string, number> = {};
		for (let i = 0; i < this.width; i++)
			for (let j = 0; j < this.width; j++) {
				let x = this.get(new Point(i, j));
				let y = [x.r, x.g, x.b, x.a].toString();
				seen1[y] ||= 0;
				seen1[y]++;
			}

		let seen2: Record<string, number> = {};
		for (let i = 0; i < this.imageData.data.length; i += 4) {
			let x = this.imageData.data.subarray(i, i + 4).toString();
			seen2[x] ||= 0;
			seen2[x]++;
		}

		console.debug(seen1, seen2);
	}
}
