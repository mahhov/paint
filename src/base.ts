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

	get round() {
		return new Point(Math.round(this.x), Math.round(this.y));
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

	constructor(r: number, g: number, b: number, a = 255) {
		this.r = r;
		this.g = g;
		this.b = b;
		this.a = a;
	}
}

export let A = (n: number) => [...Array(n)];

export enum Tool {
	SELECT, // copy, paste, move, delete
	LINE,
	RECT,
	FILL_RECT,
	TEXT,
	COLOR_PICKER,
	BUCKET_FILL,
	CLEAR,
	MOVE,
}

export let NEAR_RANGE = 15;

export let clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
