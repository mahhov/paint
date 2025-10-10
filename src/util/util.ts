import Point from './Point.js';

export let A = (n: number) => [...Array(n)];

export enum Tool {
	SELECT, // copy, paste, move, delete
	MOVE,
	LINE,
	STRAIGHT_LINE,
	GRID_LINE,
	RECT,
	FILL_RECT,
	CLEAR,
	TEXT,
	COLOR_PICKER,
	BUCKET_FILL,
	PASTE,
	PEN,
}

export let clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export let round = (v: number, precision: number = 0) => Math.round(v * 10 ** precision) / 10 ** precision;

export let boundRect = (source1: Point, source2: Point, maxSize: Point): [Point, Point] => {
	return [
		source1.min(source2).max(Point.P0),
		source1.max(source2).min(maxSize.subtract(Point.P1)),
	];
};
export let boundTransferRect = (source1: Point, source2: Point, sourceSize: Point, destDelta: Point, destSize: Point): [Point, Point] => {
	return [
		source1.min(source2).max(Point.P0).max(destDelta.scale(-1)),
		source1.max(source2).min(sourceSize.subtract(Point.P1)).min(destSize.subtract(destDelta).subtract(Point.P1)),
	];
};

export let getIndex = (x: number, y: number, width: number, int8: boolean = false): number => (x + y * width) * (int8 ? 4 : 1);
export let getPIndex = (p: Point, width: number, int8: boolean = false): number => getIndex(p.x, p.y, width, int8);

export let sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
