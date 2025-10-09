import {Edit, FillRect, Line, Rect, Select} from './Edit.js';
import Color from './util/Color.js';
import Point from './util/Point.js';

enum IconInstructionType {SELECT, LINE, RECT, FILL_RECT}

export interface IconInstruction {
	type: IconInstructionType;
	coords: [number, number, number, number];
	color: Color;
}

export let icons: Record<string, IconInstruction[]> = {
	SELECT: [
		{type: IconInstructionType.RECT, coords: [3, 3, 30, 30], color: Color.LIGHT_GRAY},
		{type: IconInstructionType.LINE, coords: [5, 5, 13, 13], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [5, 5, 5, 13], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [5, 5, 13, 5], color: Color.DARK_GRAY},
	],
	MOVE: [
		{type: IconInstructionType.RECT, coords: [11, 11, 21, 21], color: Color.DARK_GRAY},
		// left arrow
		{type: IconInstructionType.LINE, coords: [1, 16, 11, 16], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [1, 16, 5, 14], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [1, 16, 5, 18], color: Color.DARK_GRAY},
		// right arrow
		{type: IconInstructionType.LINE, coords: [31, 16, 21, 16], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [31, 16, 28, 14], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [31, 16, 28, 18], color: Color.DARK_GRAY},
		// up arrow
		{type: IconInstructionType.LINE, coords: [16, 1, 16, 11], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [16, 1, 14, 5], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [16, 1, 18, 5], color: Color.DARK_GRAY},
		// down arrow
		{type: IconInstructionType.LINE, coords: [16, 31, 16, 21], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [16, 31, 14, 28], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [16, 31, 18, 28], color: Color.DARK_GRAY},
	],
	LINE: [
		{type: IconInstructionType.LINE, coords: [1, 31, 31, 1], color: Color.DARK_GRAY},
		{type: IconInstructionType.FILL_RECT, coords: [0, 28, 4, 32], color: Color.DARK_GRAY},
		{type: IconInstructionType.FILL_RECT, coords: [28, 0, 32, 4], color: Color.DARK_GRAY},
	],
	STRAIGHT_LINE: [
		{type: IconInstructionType.LINE, coords: [2, 16, 30, 16], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [16, 2, 16, 30], color: Color.DARK_GRAY},
	],
	GRID_LINE: [
		{type: IconInstructionType.LINE, coords: [2, 11, 30, 11], color: Color.LIGHT_GRAY},
		{type: IconInstructionType.LINE, coords: [2, 21, 30, 21], color: Color.LIGHT_GRAY},
		{type: IconInstructionType.LINE, coords: [11, 2, 11, 30], color: Color.LIGHT_GRAY},
		{type: IconInstructionType.LINE, coords: [21, 2, 21, 30], color: Color.LIGHT_GRAY},
		{type: IconInstructionType.RECT, coords: [11, 11, 21, 21], color: Color.DARK_GRAY},
	],
	RECT: [
		{type: IconInstructionType.RECT, coords: [2, 2, 30, 30], color: Color.DARK_GRAY},
	],
	FILL_RECT: [
		{type: IconInstructionType.FILL_RECT, coords: [2, 2, 30, 30], color: Color.DARK_GRAY},
	],
	CLEAR: [
		{type: IconInstructionType.FILL_RECT, coords: [5, 8, 27, 23], color: Color.LIGHT_GRAY},
		{type: IconInstructionType.FILL_RECT, coords: [5, 23, 27, 25], color: Color.DARK_GRAY},
		{type: IconInstructionType.RECT, coords: [5, 8, 27, 23], color: Color.DARK_GRAY},
		{type: IconInstructionType.RECT, coords: [5, 23, 27, 25], color: Color.DARK_GRAY},
	],
	TEXT: [
		// character 'a'
		{type: IconInstructionType.LINE, coords: [11, 25, 11, 18], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [6, 25, 11, 25], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [6, 25, 6, 20], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [6, 20, 11, 20], color: Color.DARK_GRAY},
		// character 'b'
		{type: IconInstructionType.LINE, coords: [14, 25, 14, 8], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [14, 25, 18, 25], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [18, 25, 18, 19], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [14, 19, 18, 19], color: Color.DARK_GRAY},
		// character 'c'
		{type: IconInstructionType.LINE, coords: [21, 25, 26, 25], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [21, 25, 21, 18], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [21, 18, 26, 18], color: Color.DARK_GRAY},
		// cursor (thicker)
		{type: IconInstructionType.LINE, coords: [29, 7, 29, 28], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [30, 7, 30, 28], color: Color.DARK_GRAY},
	],
	COLOR_PICKER: [
		// color base
		{type: IconInstructionType.FILL_RECT, coords: [5, 5, 27, 27], color: Color.LIGHT_GRAY},
		// magnifier handle (thicker)
		{type: IconInstructionType.LINE, coords: [27, 5, 20, 12], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [26, 4, 19, 11], color: Color.DARK_GRAY},
		// magnifier fill (to imply clear center)
		{type: IconInstructionType.FILL_RECT, coords: [11, 12, 19, 20], color: Color.WHITE},
		// magnifier loop (rect to simulate circular loop)
		{type: IconInstructionType.RECT, coords: [11, 12, 19, 20], color: Color.DARK_GRAY},
	],
	BUCKET_FILL: [
		// bucket rim
		{type: IconInstructionType.FILL_RECT, coords: [8, 5, 24, 7], color: Color.DARK_GRAY},
		// bucket body
		{type: IconInstructionType.FILL_RECT, coords: [9, 7, 23, 25], color: Color.LIGHT_GRAY},
		// pour spout
		{type: IconInstructionType.LINE, coords: [23, 6, 26, 9], color: Color.DARK_GRAY},
		// paint spout fill
		{type: IconInstructionType.FILL_RECT, coords: [24, 8, 26, 12], color: Color.DARK_GRAY},
		// paint puddle
		{type: IconInstructionType.FILL_RECT, coords: [23, 22, 27, 25], color: Color.DARK_GRAY},
	],
	PEN: [
		// eraser
		{type: IconInstructionType.LINE, coords: [27, 8, 23, 4], color: Color.DARK_GRAY}, // back
		{type: IconInstructionType.LINE, coords: [23, 4, 20, 7], color: Color.DARK_GRAY}, // left
		{type: IconInstructionType.LINE, coords: [27, 8, 24, 11], color: Color.DARK_GRAY}, // right
		// shaft
		{type: IconInstructionType.LINE, coords: [24, 11, 20, 7], color: Color.DARK_GRAY}, // back
		{type: IconInstructionType.LINE, coords: [20, 7, 8, 19], color: Color.DARK_GRAY}, // left
		{type: IconInstructionType.LINE, coords: [24, 11, 12, 23], color: Color.DARK_GRAY}, // right
		// tip
		{type: IconInstructionType.LINE, coords: [8, 19, 12, 23], color: Color.DARK_GRAY}, // back
		{type: IconInstructionType.LINE, coords: [8, 19, 6, 25], color: Color.DARK_GRAY}, // left
		{type: IconInstructionType.LINE, coords: [12, 23, 6, 25], color: Color.DARK_GRAY}, // right
	],
	PASTE: [
		// back document
		{type: IconInstructionType.RECT, coords: [7, 6, 29, 29], color: Color.DARK_GRAY},
		// front document
		{type: IconInstructionType.RECT, coords: [4, 3, 26, 26], color: Color.DARK_GRAY},
		// highlight/fill for front document
		{type: IconInstructionType.FILL_RECT, coords: [6, 5, 24, 10], color: Color.LIGHT_GRAY},
	],
	UNDO: [
		// vertical stem
		{type: IconInstructionType.LINE, coords: [26, 6, 26, 26], color: Color.DARK_GRAY},
		// horizontal section
		{type: IconInstructionType.LINE, coords: [26, 6, 10, 6], color: Color.DARK_GRAY},
		// curve bend (approximation using short lines)
		{type: IconInstructionType.LINE, coords: [10, 6, 7, 9], color: Color.DARK_GRAY},
		// vertical section
		{type: IconInstructionType.LINE, coords: [7, 9, 7, 18], color: Color.DARK_GRAY},
		// arrowhead (pointing left/up from bend point)
		{type: IconInstructionType.LINE, coords: [7, 18, 3, 14], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [7, 18, 11, 14], color: Color.DARK_GRAY},
	],
	REDO: [
		// vertical stem
		{type: IconInstructionType.LINE, coords: [6, 6, 6, 26], color: Color.DARK_GRAY},
		// horizontal section
		{type: IconInstructionType.LINE, coords: [6, 6, 22, 6], color: Color.DARK_GRAY},
		// curve bend (approximation using short lines)
		{type: IconInstructionType.LINE, coords: [22, 6, 25, 9], color: Color.DARK_GRAY},
		// vertical section
		{type: IconInstructionType.LINE, coords: [25, 9, 25, 18], color: Color.DARK_GRAY},
		// arrowhead (pointing right/up from bend point)
		{type: IconInstructionType.LINE, coords: [25, 18, 29, 14], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [25, 18, 21, 14], color: Color.DARK_GRAY},
	],
	SAVE: [
		// floppy disk body
		{type: IconInstructionType.FILL_RECT, coords: [5, 5, 27, 27], color: Color.LIGHT_GRAY},
		// floppy disk notch/top detail
		{type: IconInstructionType.FILL_RECT, coords: [19, 5, 27, 12], color: Color.WHITE},
		// floppy disk magnetic area (dark center)
		{type: IconInstructionType.FILL_RECT, coords: [9, 17, 23, 24], color: Color.DARK_GRAY},
		// outline
		{type: IconInstructionType.RECT, coords: [5, 5, 27, 27], color: Color.DARK_GRAY},
	],
	START_NEW: [
		// circle shape (approximated with three lines for a clean, chunky look)
		// top right curve
		{type: IconInstructionType.LINE, coords: [16, 5, 26, 10], color: Color.DARK_GRAY},
		// right vertical curve
		{type: IconInstructionType.LINE, coords: [26, 10, 26, 22], color: Color.DARK_GRAY},
		// bottom curve
		{type: IconInstructionType.LINE, coords: [26, 22, 16, 27], color: Color.DARK_GRAY},
		// bottom left curve
		{type: IconInstructionType.LINE, coords: [16, 27, 6, 22], color: Color.DARK_GRAY},
		// left vertical curve
		{type: IconInstructionType.LINE, coords: [6, 22, 6, 10], color: Color.DARK_GRAY},
		// top left curve
		{type: IconInstructionType.LINE, coords: [6, 10, 16, 5], color: Color.DARK_GRAY},
		// arrowhead (pointing left/up)
		{type: IconInstructionType.LINE, coords: [6, 10, 2, 14], color: Color.DARK_GRAY},
		{type: IconInstructionType.LINE, coords: [6, 10, 10, 14], color: Color.DARK_GRAY},
	],
};

export let colorIcon = (color: Color): IconInstruction[] =>
	[{type: IconInstructionType.FILL_RECT, coords: [1, 1, 31, 31], color}];

let iconCoordinates = (point32: Point, position: Point, size: Point) => {
	return point32.scale(1 / 32).multiply(size).add(position).round;
};

let iconCoordinates2 = (x1: number, y1: number, x2: number, y2: number, position: Point, size: Point): [Point, Point] => {
	return [iconCoordinates(new Point(x1, y1), position, size), iconCoordinates(new Point(x2, y2), position, size)];
};

export let iconToEdits = (instructions: IconInstruction[], position: Point, size: Point): Edit[] =>
	instructions.map(instruction => {
		let editCoords = iconCoordinates2(...instruction.coords, position, size);
		switch (instruction.type) {
			case IconInstructionType.SELECT:
				return new Select(...editCoords);
			case IconInstructionType.LINE:
				return new Line(...editCoords, instruction.color);
			case IconInstructionType.RECT:
				return new Rect(...editCoords, instruction.color);
			case IconInstructionType.FILL_RECT:
				return new FillRect(...editCoords, instruction.color);
		}
	});
