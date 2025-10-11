import Color from './util/Color.js';
import Point from './util/Point.js';
import {getIndex, getPIndex} from './util/util.js';

export default class Pixels {
	readonly width: number;
	readonly height: number;
	private readonly defaultColor: Color;
	private readonly imageData: ImageData;
	private readonly imageData32View: Uint32Array;
	private readonly cachedClearedImageDataData: Uint8ClampedArray;
	private readonly ctx: OffscreenCanvasRenderingContext2D;
	private dirtyMin!: Point;
	private dirtyMax!: Point;
	private readonly owners?: Uint8ClampedArray;

	constructor(width: number, height: number, ctx: CanvasRenderingContext2D, defaultColor: Color, trackOwners: boolean) {
		this.width = width;
		this.height = height;
		this.defaultColor = defaultColor;
		this.imageData = ctx.createImageData(width, height);
		this.imageData32View = new Uint32Array(this.imageData.data.buffer);
		this.cachedClearedImageDataData = new Uint8ClampedArray(width * height * 4);
		new Uint32Array(this.cachedClearedImageDataData.buffer).fill(this.defaultColor.int32);
		let canvas = new OffscreenCanvas(width, height);
		this.ctx = canvas.getContext('2d')!;
		this.ctx.fillStyle = `rgba(${this.defaultColor.toRgba().join(',')})`;
		if (trackOwners)
			this.owners = new Uint8ClampedArray(this.width * this.height);
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

	set(p: Point, c: Color, owner: number) {
		if (this.isInBounds(p)) {
			let index = getPIndex(p, this.width);
			this.imageData32View[index] = c.int32;
			if (this.owners)
				this.owners[index] = owner;
		}
		this.setDirty(p);
	}

	setIndex(index: number, c: Color, owner: number) {
		this.imageData32View[index] = c.int32;
		if (this.owners)
			this.owners[index] = owner;
	}

	setLine(index4: number, line: Uint8ClampedArray, owner: number) {
		this.imageData.data.set(line, index4);
		this.owners?.subarray(index4 / 4, (index4 + line.length) / 4).fill(owner);
	}

	setDirty(min: Point, max: Point = min) {
		this.dirtyMin = this.dirtyMin.min(min);
		this.dirtyMax = this.dirtyMax.max(max);
	}

	getOwner(p1: Point, p2: Point): number {
		if (!this.owners) return -1;
		let min = p1.min(p2);
		let max = p1.max(p2);
		let maxOwner = -1;
		for (let y = min.y; y <= max.y; y++)
			for (let x = min.x; x <= max.x; x++) {
				let owner = this.owners[getIndex(x, y, this.width)];
				if (owner !== 255 && owner > maxOwner)
					maxOwner = owner;
			}
		return maxOwner;
	}

	getOwnedBy(owner: number) {
		if (!this.owners) return [];
		let indexes = [];
		for (let i = 0; i < this.owners.length; i++)
			if (this.owners[i] === owner)
				indexes.push(i);
		return indexes;
	}

	clear() {
		this.imageData.data.set(this.cachedClearedImageDataData);
		if (this.defaultColor.toRgba()[3] < 255)
			this.ctx.clearRect(0, 0, this.width, this.height);
		if (this.defaultColor.toRgba()[3] > 0)
			this.ctx.fillRect(0, 0, this.width, this.height);
		this.dirtyMin = this.size;
		this.dirtyMax = Point.P0;
		this.owners?.fill(255);
	}

	getImage(): OffscreenCanvas {
		if (this.dirtyMax.x >= this.dirtyMin.x) {
			let dirtyDelta = this.dirtyMax.subtract(this.dirtyMin).add(Point.P1);
			let dest: [number, number, number, number] = [this.dirtyMin.x, this.dirtyMin.y, dirtyDelta.x, dirtyDelta.y];
			this.ctx.putImageData(this.imageData, 0, 0, ...dest);
			this.dirtyMin = this.size;
			this.dirtyMax = Point.P0;
		}
		return this.ctx.canvas;
	}

	private isInBounds(p: Point) {
		return p.x >= 0 && p.x < this.width && p.y >= 0 && p.y < this.height;
	}
}

