import {Color, Point} from './base.js';

export class Pixels {
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

		let rawDefaultColor = new Uint8ClampedArray([this.defaultColor.r, this.defaultColor.g, this.defaultColor.b, this.defaultColor.a]);
		this.cachedClearedImageDataData = new Uint8ClampedArray(width * height * rawDefaultColor.length);
		for (let i = 0; i < this.cachedClearedImageDataData.length; i += rawDefaultColor.length)
			this.cachedClearedImageDataData.set(rawDefaultColor, i);
		this.clear();
	}

	get size() {
		return new Point(this.width, this.height);
	}

	get(p: Point) {
		if (!this.isInBounds(p))
			return this.defaultColor;
		let raw = this.getRaw(p);
		return new Color(raw[0], raw[1], raw[2], raw[3]);
	}

	getRaw(p: Point) {
		let index = (p.x + p.y * this.width) * 4;
		return this.imageData.data.subarray(index, index + 4);
	}

	set(p: Point, c: Color) {
		if (this.isInBounds(p)) {
			let index = (p.x + p.y * this.width) * 4;
			this.imageData.data[index] = c.r;
			this.imageData.data[index + 1] = c.g;
			this.imageData.data[index + 2] = c.b;
			this.imageData.data[index + 3] = c.a;
		}
	}

	setRaw(p: Point, raw: Uint8ClampedArray) {
		let index = (p.x + p.y * this.width) * 4;
		this.imageData.data[index] = raw[0];
		this.imageData.data[index + 1] = raw[1];
		this.imageData.data[index + 2] = raw[2];
		this.imageData.data[index + 3] = raw[3];
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

		console.log(seen1, seen2);
	}
}
