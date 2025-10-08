import Point from './util/Point.js';
import {clamp, round} from './util/util.js';

// todo center around initial zoom
let zoomDelta = .2;
let minWidth = .2;
let maxWidth = 1.4; // maxWidth-minWidth should be divisible by zoomDelta
let padding = (maxWidth - 1) / 2;

export default class Camera {
	private leftTop: Point = Point.P0;
	private width: number;

	constructor(initialWidth: number) {
		this.width = initialWidth;
	}

	move(delta: Point) {
		this.leftTop = this.leftTop.add(delta.scale(this.width));
		this.clamp();
	}

	zoom(delta: number, canvasPoint: Point) {
		let worldPoint = this.canvasToWorld(canvasPoint);
		this.width = round(clamp(this.width + delta * zoomDelta, minWidth, maxWidth), 1);
		this.leftTop = worldPoint.subtract(canvasPoint.scale(this.width));
		this.clamp();
	}

	clamp() {
		this.leftTop = this.leftTop.clamp(new Point(-padding), new Point(1 + padding).subtract(new Point(this.width)));
	}

	worldToCanvas(world: Point) {
		return world
			.subtract(this.leftTop)
			.scale(1 / this.width);
	}

	canvasToWorld(canvas: Point) {
		return canvas
			.scale(this.width)
			.add(this.leftTop);
	}
}
