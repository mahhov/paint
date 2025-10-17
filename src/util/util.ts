import Point from './Point.js';

export let A = (n: number) => [...Array(n)];

export enum Tool {
	MOVE,
	LINE,
	STRAIGHT_LINE,
	MEASURE,
	RECT,
	FILL_RECT,
	CLEAR,
	TEXT,
	COLOR_PICKER,
	COLOR_DIFF,
	BUCKET_FILL,
	PASTE,
	PEN,
}

export let clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export let round = (v: number, precision = 0) => Math.round(v * 10 ** precision) / 10 ** precision;

export let unique = <T>(value: T, index: number, array: T[]) => array.indexOf(value) === index;

export let sort2 = (a: number, b: number) => [Math.min(a, b), Math.max(a, b)];

export let boundRect = (source1: Point, source2: Point, maxSize: Point): [Point, Point] => {
	maxSize = maxSize.subtract(Point.P1);
	return [
		source1.min(source2).clamp(Point.P0, maxSize),
		source1.max(source2).clamp(Point.P0, maxSize),
	];
};
export let boundTransferRect = (source1: Point, source2: Point, sourceSize: Point, destDelta: Point, destSize: Point): [Point, Point] => {
	let sourceMax = sourceSize.subtract(Point.P1);
	let destMin = destDelta.scale(-1);
	let destMax = destSize.subtract(destDelta).subtract(Point.P1);
	return [
		source1.min(source2).clamp(Point.P0, sourceMax).clamp(destMin, destMax),
		source1.max(source2).clamp(Point.P0, sourceMax).clamp(destMin, destMax),
	];
};

export let getIndex = (x: number, y: number, width: number, four = false): number => (x + y * width) * (four ? 4 : 1);
export let getPIndex = (p: Point, width: number, four = false): number => getIndex(p.x, p.y, width, four);
export let getIndexP = (index: number, width: number, four = false): Point => {
	index = index / (four ? 4 : 1);
	let x = index % width;
	let y = Math.floor(index / width);
	return new Point(x, y);
};

export let sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
