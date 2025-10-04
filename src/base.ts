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
	static WHITE = new Color(255, 255, 255, 255);
	static BLACK = new Color(0, 0, 0, 255);
	static GREEN = new Color(0, 255, 0, 255);
	static CLEAR = new Color(0, 0, 0, 0);

	readonly r: number;
	readonly g: number;
	readonly b: number;
	readonly a: number;
	private rawCache_: Uint8ClampedArray | undefined;

	constructor(r: number, g: number, b: number, a = 255) {
		this.r = r;
		this.g = g;
		this.b = b;
		this.a = a;
	}

	equals(color: Color) {
		return this.r === color.r && this.g === color.g && this.b === color.b && this.a === color.a;
	}

	get invert() {
		return new Color(255 - this.r, 255 - this.g, 255 - this.b, 255);
	}

	get raw() {
		return this.rawCache_ ||= new Uint8ClampedArray([this.r, this.g, this.b, this.a]);
	}

	get int32() {
		return (this.a << 24) | (this.b << 16) | (this.g << 8) | this.r;
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
