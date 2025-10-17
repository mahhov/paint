import {clamp, round} from './util.js';

export default class Point {
	static readonly P0 = new Point(0);
	static readonly P1 = new Point(1);

	readonly x: number;
	readonly y: number;

	constructor(x: number, y = x) {
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

	multiply(point: Point) {
		return new Point(this.x * point.x, this.y * point.y);
	}

	divide(point: Point) {
		return new Point(this.x / point.x, this.y / point.y);
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

	flatten() {
		return Math.abs(this.x) >= Math.abs(this.y) ? new Point(this.x, 0) : new Point(0, this.y);
	}
}
