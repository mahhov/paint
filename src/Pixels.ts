import Color from './util/Color.js';
import Point from './util/Point.js';
import {getPIndex} from './util/util.js';

export default class Pixels {
	readonly width: number;
	readonly height: number;
	private readonly defaultColor: Color;
	private readonly imageData: ImageData; // todo is it faster to just directly manipulate canvas?
	private readonly imageData32View: Uint32Array;
	private readonly cachedClearedImageDataData: Uint8ClampedArray;
	private readonly canvas: OffscreenCanvas; // todo do we need to keep this variable
	private readonly ctx: OffscreenCanvasRenderingContext2D;
	private dirtyMin: Point;
	private dirtyMax: Point;

	constructor(width: number, height: number, ctx: CanvasRenderingContext2D, defaultColor: Color) {
		this.width = width;
		this.height = height;
		this.defaultColor = defaultColor;
		this.imageData = ctx.createImageData(width, height);
		this.imageData32View = new Uint32Array(this.imageData.data.buffer);
		this.cachedClearedImageDataData = new Uint8ClampedArray(width * height * 4);
		new Uint32Array(this.cachedClearedImageDataData.buffer).fill(this.defaultColor.int32);
		this.canvas = new OffscreenCanvas(width, height);
		this.ctx = this.canvas.getContext('2d')!;
		this.ctx.fillStyle = `rgba(${this.defaultColor.toRgba().join(',')})`;
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
		this.setDirty(p);
	}

	setIndex(index: number, c: Color) {
		this.imageData32View[index] = c.int32;
	}

	setLine(index4: number, line: Uint8ClampedArray) {
		this.imageData.data.set(line, index4);
	}

	setDirty(min: Point, max: Point = min) {
		this.dirtyMin = this.dirtyMin.min(min);
		this.dirtyMax = this.dirtyMax.max(max);
	}

	clear() {
		this.imageData.data.set(this.cachedClearedImageDataData);
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		this.dirtyMin = this.size;
		this.dirtyMax = Point.P0;
	}

	// todo rename
	async getImage(s: string): Promise<OffscreenCanvas> {
		if (this.dirtyMax.x >= this.dirtyMin.x) {
			let dirtyDelta = this.dirtyMax.subtract(this.dirtyMin).add(Point.P1);
			let dest: [number, number, number, number] = [this.dirtyMin.x, this.dirtyMin.y, dirtyDelta.x, dirtyDelta.y];
			let image = await createImageBitmap(this.imageData, ...dest); // todo try avoiding createImageBitmap
			this.ctx.clearRect(...dest);
			this.ctx.fillRect(...dest);
			this.ctx.drawImage(image, ...dest);
			if (s) console.log(s, this.dirtyMin, this.dirtyMax); // todo remove after done debugging
			this.dirtyMin = this.size;
			this.dirtyMax = Point.P0;
		}
		return this.canvas;
	}

	private isInBounds(p: Point) {
		return p.x >= 0 && p.x < this.width && p.y >= 0 && p.y < this.height;
	}
}

