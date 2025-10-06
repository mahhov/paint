export class Point {
	readonly x: number;
	readonly y: number;

	constructor(x: number = 0, y: number = x) {
		this.x = x;
		this.y = y;
	}

	add(point: Point) {
		return new Point(this.x + point.x, this.y + point.y);
	}

	subtract(point: Point) {
		return new Point(this.x - point.x, this.y - point.y);
	}

	scale(n: number) {
		return new Point(this.x * n, this.y * n);
	}

	min(point: Point) {
		return new Point(Math.min(this.x, point.x), Math.min(this.y, point.y));
	}

	max(point: Point) {
		return new Point(Math.max(this.x, point.x), Math.max(this.y, point.y));
	}

	atMost(point: Point) {
		return this.x <= point.x && this.y <= point.y;
	}

	atLeast(point: Point) {
		return this.x >= point.x && this.y >= point.y;
	}

	equals(point: Point) {
		return this.x === point.x && this.y === point.y;
	}

	get round() {
		return new Point(round(this.x), round(this.y));
	}

	get magnitude2() {
		return this.x ** 2 + this.y ** 2;
	}

	clamp(min: Point, max: Point) {
		return new Point(clamp(this.x, min.x, max.x), clamp(this.y, min.y, max.y));
	}
}

export class Color {
	static WHITE = Color.fromRgba(255, 255, 255, 255);
	static BLACK = Color.fromRgba(0, 0, 0, 255);
	static GREEN = Color.fromRgba(0, 255, 0, 255);
	static CLEAR = Color.fromRgba(0, 0, 0, 0);

	readonly int32: number;

	constructor(int32: number) {
		this.int32 = int32;
	}

	static fromRgba(r: number, g: number, b: number, a: number) {
		return new Color(((a << 24) | (b << 16) | (g << 8) | r) >>> 0);
	}

	static fromInt32IgnoreAlpha(int32: number) {
		return new Color((int32 | 255 << 24) >>> 0);
	}
}

export let A = (n: number) => [...Array(n)];

export enum Tool {
	SELECT, // copy, paste, move, delete
	MOVE,
	LINE,
	STRAIGHT_LINE,
	RECT,
	FILL_RECT,
	CLEAR,
	TEXT,
	COLOR_PICKER,
	BUCKET_FILL,
	PASTE,
}

export let NEAR_RANGE = 15;

export let clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export let round = (v: number, precision: number = 1) => Math.round(v / precision) * precision;

export let boundTransferRect = (source1: Point, source2: Point, sourceSize: Point, destDelta: Point, destSize: Point): [Point, Point] => {
	return [
		source1.min(source2).max(new Point()).max(destDelta.scale(-1)),
		source1.max(source2).min(sourceSize).min(destSize.subtract(destDelta)),
	];
};

export let getIndex = (x: number, y: number, width: number, int8: boolean = false): number => (x + y * width) * (int8 ? 4 : 1);
export let getPIndex = (p: Point, width: number, int8: boolean = false): number => getIndex(p.x, p.y, width, int8);
