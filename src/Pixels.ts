import {Color, getPIndex, Point} from './base.js';

export default class Pixels {
	readonly width: number;
	readonly height: number;
	private readonly defaultColor: Color;
	private readonly imageData: ImageData;
	private readonly imageData32View: Uint32Array;
	private readonly cachedClearedImageDataData: Uint8ClampedArray;
	private cachedImage: Promise<ImageBitmap> | undefined;

	constructor(width: number, height: number, ctx: CanvasRenderingContext2D, defaultColor: Color) {
		this.width = width;
		this.height = height;
		this.defaultColor = defaultColor;
		this.imageData = ctx.createImageData(width, height);
		this.imageData32View = new Uint32Array(this.imageData.data.buffer);
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
		let index = getPIndex(p, this.width);
		return new Color(this.imageData32View[index]);
	}

	get32(index: number) {
		return this.imageData32View[index];
	}

	getLine(start4: number, end4: number) {
		return this.imageData.data.slice(start4, end4);
	}

	set(p: Point, c: Color) {
		if (this.isInBounds(p)) {
			let index = getPIndex(p, this.width);
			this.imageData32View[index] = c.int32;
		}
		this.cachedImage = undefined;
	}

	setIndex(index: number, c: Color) {
		this.imageData32View[index] = c.int32;
		this.cachedImage = undefined;
	}

	setLine(index4: number, line: Uint8ClampedArray) {
		this.imageData.data.set(line, index4);
		this.cachedImage = undefined;
	}

	clear() {
		this.imageData.data.set(this.cachedClearedImageDataData);
		this.cachedImage = undefined;
	}

	getImage(): Promise<ImageBitmap> {
		return this.cachedImage ||= createImageBitmap(this.imageData);
	}

	private isInBounds(p: Point) {
		return p.x >= 0 && p.x < this.width && p.y >= 0 && p.y < this.height;
	}
}
