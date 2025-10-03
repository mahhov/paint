import {NEAR_RANGE, Point, Tool} from './base.js';

export default class EditCreator {
	selectedPoint = -1;

	static toolIsInstant(tool: Tool) {
		return tool === Tool.COLOR_PICKER;
	}

	static getNearPoint(points: readonly Point[], point: Point) {
		let magnitudes = points.map(p => p.subtract(point).magnitude2);
		let minIndex = magnitudes.indexOf(Math.min(...magnitudes));
		return magnitudes[minIndex] < NEAR_RANGE ** 2 ? minIndex : -1;
		// todo use rectangle region similar to that drawn
	}
}

// todo either move more logic here, ore get rid of
