import Point from './util/Point.js';
import {clamp} from './util/util.js';

let zoomPercents = [25, 50, 100, 200, 400, 800];

export default class Camera {
	private leftTop: Point = Point.P0;
	private initialWidth: number;
	private zoomIndex = zoomPercents.indexOf(100);

	constructor(initialWidth: number) {
		this.initialWidth = initialWidth;
	}

	get zoomPercent() {
		return zoomPercents[this.zoomIndex];
	}

	private get width() {
		return this.initialWidth / this.zoomPercent * 100;
	}

	move(delta: Point) {
		this.leftTop = this.leftTop.add(delta.scale(this.width));
		this.clamp();
	}

	zoom(delta: number, canvasPoint: Point) {
		let worldPoint = this.canvasToWorld(canvasPoint);
		this.zoomIndex = clamp(this.zoomIndex + delta, 0, zoomPercents.length - 1);
		this.leftTop = worldPoint.subtract(canvasPoint.scale(this.width));
		this.clamp();
	}

	clamp() {
		this.leftTop = this.leftTop.clamp(new Point(-.2), new Point(1.2).subtract(new Point(this.width)));
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
