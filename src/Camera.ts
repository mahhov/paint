import {clamp, Point} from './base.js';

let padding = .25;

export default class Camera {
	private leftTop: Point = new Point();
	private width: number = 1;

	move(delta: Point) {
		this.leftTop = this.leftTop.add(delta.scale(this.width));
		this.clamp();
	}

	zoom(delta: number) {
		let centerWorld = this.canvasToWorld(new Point(.5));
		this.width = clamp(this.width + delta, .1, 1 + padding * 2);
		this.leftTop = centerWorld.subtract(new Point(this.width / 2));
		this.clamp();
		// todo zoom towards cursor
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
