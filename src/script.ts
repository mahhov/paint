class Point {
	readonly x: number;
	readonly y: number;

	constructor(x: number = 0, y: number = 0) {
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

	get round() {
		return new Point(Math.round(this.x), Math.round(this.y));
	}
}

class Color {
	static WHITE = new Color(255, 255, 255);
	static BLACK = new Color(0, 0, 0);

	readonly r: number;
	readonly g: number;
	readonly b: number;

	constructor(r: number, g: number, b: number) {
		this.r = r;
		this.g = g;
		this.b = b;
	}

	get invert() {
		return new Color(255 - this.r, 255 - this.g, 255 - this.b);
	}
}

let A = (n: number) => [...Array(n)];

enum Tool {
	SELECT, // copy, paste, move, delete
	LINE,
	RECT,
	FILL_RECT,
	TEXT,
	COLOR_PICKER,
	BUCKET_FILL,
}

class Pixels {
	private readonly data: Color[][];

	constructor(width: number, height: number) {
		this.data = A(width).map(() => A(height).map(() => Color.WHITE));
	}

	get width() {
		return this.data.length;
	}

	get height() {
		return this.data[0].length;
	}

	get size() {
		return new Point(this.width, this.height);
	}

	get(p: Point) {
		return this.isInBounds(p) ?
			this.data[p.x][p.y] :
			Color.BLACK;
	}

	set(p: Point, c: Color) {
		if (this.isInBounds(p))
			this.data[p.x][p.y] = c;
	}

	clear() {
		FillRect.points(new Point(), this.size).forEach(point => this.set(point, Color.WHITE));
	}

	private isInBounds(p: Point) {
		return p.x > 0 && p.x < this.width && p.y > 0 && p.y < this.height;
	}
}

class Edit {
	draw(pixels: Pixels) {
	}
}

class Select extends Edit {
	private readonly start: Point;
	private readonly end: Point;

	constructor(start: Point, end: Point) {
		super();
		this.start = start;
		this.end = end;
	}

	draw(pixels: Pixels) {
		Rect.points(this.start, this.end)
			.filter((_, i) => i % 2)
			.forEach(point => pixels.set(point, pixels.get(point).invert));
	}
}

class Move extends Edit {
	private readonly start: Point;
	private readonly end: Point;
	private readonly delta: Point;

	constructor(start: Point, end: Point, delta: Point) {
		super();
		this.start = start;
		this.end = end;
		this.delta = delta;
	}

	draw(pixels: Pixels) {
		FillRect.points(this.start, this.end).forEach(point =>
			pixels.set(point.add(this.delta), pixels.get(point)));
	}
}

class Line extends Edit {
	private readonly start: Point;
	private readonly end: Point;
	private readonly color: Color;

	constructor(start: Point, end: Point, color: Color) {
		super();
		this.start = start;
		this.end = end;
		this.color = color;
	}

	draw(pixels: Pixels) {
		let delta = this.end.subtract(this.start);
		let steps = Math.max(Math.abs(delta.x), Math.abs(delta.y));
		for (let i = 0; i <= steps; i++)
			pixels.set(this.start.add(delta.scale(i / steps).round), this.color);
	}
}

class Rect extends Edit {
	private readonly start: Point;
	private readonly end: Point;
	private readonly color: Color;

	constructor(start: Point, end: Point, color: Color) {
		super();
		this.start = start;
		this.end = end;
		this.color = color;
	}

	static points(start: Point, end: Point) {
		let min = start.min(end);
		let max = start.max(end);
		let points = [];
		for (let x = min.x; x <= max.x; x++)
			points.push(new Point(x, min.y));
		for (let x = min.x; x <= max.x; x++)
			points.push(new Point(x, max.y));
		for (let y = min.y; y <= max.y; y++)
			points.push(new Point(min.x, y));
		for (let y = min.y; y <= max.y; y++)
			points.push(new Point(max.x, y));
		return points;
	}

	draw(pixels: Pixels) {
		Rect.points(this.start, this.end).forEach(point => pixels.set(point, this.color));
	}
}

class FillRect extends Edit {
	private readonly start: Point;
	private readonly end: Point;
	private readonly color: Color;

	constructor(start: Point, end: Point, color: Color) {
		super();
		this.start = start;
		this.end = end;
		this.color = color;
	}

	static points(start: Point, end: Point) {
		let min = start.min(end);
		let max = start.max(end);
		let points = [];
		for (let x = min.x; x <= max.x; x++)
			for (let y = min.y; y <= max.y; y++)
				points.push(new Point(x, y));
		return points;
	}

	draw(pixels: Pixels) {
		FillRect.points(this.start, this.end).forEach(point => pixels.set(point, this.color));
	}
}

class Clear extends Edit {
	private readonly start: Point;
	private readonly end: Point;

	constructor(start: Point, end: Point) {
		super();
		this.start = start;
		this.end = end;
	}

	draw(pixels: Pixels) {
		let points = FillRect.points(this.start, this.end);
		points.forEach(point => pixels.set(point, Color.WHITE));
	}
}

class TextEdit extends Edit {
	private readonly pos: Point;
	private readonly size: number;
	private readonly color: Color;

	constructor(pos: Point, size: number, color: Color) {
		super();
		this.pos = pos;
		this.size = size;
		this.color = color;
	}

	draw(pixels: Pixels) {
		// todo draw text edit
	}
}

class BucketFill extends Edit {
	private readonly pos: Point;
	private readonly color: Color;

	constructor(pos: Point, color: Color) {
		super();
		this.pos = pos;
		this.color = color;
	}

	draw(pixels: Pixels) {
		// todo draw bucket fill
	}
}

class Paste extends Edit {
	private readonly pos: Point;
	private readonly pixelArray: Color[][];

	constructor(pos: Point, pixelArray: Color[][]) {
		super();
		this.pos = pos;
		this.pixelArray = pixelArray;
	}

	static async clipboardPixelArray(e: ClipboardEvent): Promise<Color[][]> {
		return new Promise((resolve, reject) => {
			let canvas = document.createElement('canvas');
			let ctx = canvas.getContext('2d');
			if (!ctx) return reject('no canvas context');

			if (!e.clipboardData) return reject('no clipboard data');
			let clipboardItem = [...e.clipboardData.items]
				.find(item => item.type.startsWith('image/'));
			if (!clipboardItem) return reject('no clipboard image data');
			let blob = clipboardItem.getAsFile();
			if (!blob) return reject(('no clipboard image blob data'));
			let reader = new FileReader();

			reader.onload = e => {
				let img = document.createElement('img');
				img.onload = () => {
					canvas.width = img.width;
					canvas.height = img.height;
					ctx.drawImage(img, 0, 0);
					let imageData = ctx.getImageData(0, 0, img.width, img.height);
					let pixelArray = A(img.width).map((_, x) => A(img.height).map((_, y) => {
						let index = (x + y * img.width) * 4;
						let rgb = [...imageData.data.subarray(index, index + 3)] as [number, number, number];
						return new Color(...rgb);
					}));
					resolve(pixelArray);
				};
				img.src = e.target?.result as string;
			};
			reader.readAsDataURL(blob);
		});
	}

	draw(pixels: Pixels) {
		this.pixelArray.forEach((column, x) =>
			column.forEach((color, y) =>
				pixels.set(this.pos.add(new Point(x, y)), color)));
	}
}

class Editor {
	private readonly canvas: HTMLCanvasElement;
	private readonly ctx: CanvasRenderingContext2D;
	private readonly pixels: Pixels;
	private readonly edits: Edit[] = [];
	private redoEdits: Edit[] = [];
	private mouseActive = false;
	private mouseStart = new Point();
	private mouseEnd = new Point();
	private tool = Tool.SELECT;
	private color = Color.BLACK;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d')!;
		this.pixels = new Pixels(canvas.width, canvas.height);

		canvas.addEventListener('mousedown', e => {
			this.mouseActive = true;
			this.mouseStart = new Point(e.x, e.y);
		});

		canvas.addEventListener('mousemove', e => {
			if (this.mouseActive)
				this.mouseEnd = new Point(e.x, e.y);
		});

		canvas.addEventListener('mouseup', e => {
			this.mouseActive = false;
			switch (this.tool) {
				case Tool.SELECT:
					this.addEdit(new Select(this.mouseStart, this.mouseEnd));
					break;
				case Tool.LINE:
					this.addEdit(new Line(this.mouseStart, this.mouseEnd, this.color));
					break;
				case Tool.RECT:
					this.addEdit(new Rect(this.mouseStart, this.mouseEnd, this.color));
					break;
				case Tool.FILL_RECT:
					this.addEdit(new FillRect(this.mouseStart, this.mouseEnd, this.color));
					break;
				case Tool.TEXT:
					// todo adding text
					break;
				case Tool.COLOR_PICKER:
					this.color = this.pixels.get(this.mouseEnd);
					break;
				case Tool.BUCKET_FILL:
					this.addEdit(new BucketFill(this.mouseEnd, this.color));
					break;
			}
		});

		document.addEventListener('keydown', e => {
			if (e.ctrlKey) {
				if (e.key === 'z' && !e.shiftKey)
					this.undoEdit();
				if (e.key === 'z' && e.shiftKey || e.key === 'y')
					this.redoEdit();
				return;
			}

			if (e.key === 'Delete') {
				this.addEdit(new Clear(this.mouseStart, this.mouseEnd));
				return;
			}

			let tool = {
				s: Tool.SELECT,
				l: Tool.LINE,
				r: Tool.RECT,
				f: Tool.FILL_RECT,
				t: Tool.TEXT,
				c: Tool.COLOR_PICKER,
				b: Tool.BUCKET_FILL,
			}[e.key];
			if (tool === this.tool)
				this.tool = Tool.SELECT;
			else if (tool !== undefined)
				this.tool = tool;
		});

		document.addEventListener('paste', async e => {
			let pos = this.tool === Tool.SELECT ? this.mouseStart : new Point();
			Paste.clipboardPixelArray(e)
				.then(pixelArray => {
					this.addEdit(new Paste(pos, pixelArray));
				})
				.catch(e => console.warn(e));
		});
	}

	private addEdit(edit: Edit) {
		this.edits.push(edit);
		this.redoEdits = [];
		this.drawToCanvas();
	}

	private undoEdit() {
		if (!this.edits.length) return;
		this.redoEdits.push(this.edits.pop()!);
		this.drawToCanvas();
	}

	private redoEdit() {
		if (!this.redoEdits.length) return;
		this.edits.push(this.redoEdits.pop()!);
		this.drawToCanvas();
	}

	private copy() {
		// todo copy
	}

	private drawToCanvas() {
		this.pixels.clear();
		this.edits
			.filter((edit, i, a) => !(edit instanceof Select) || i === a.length - 1)
			.forEach(edit => edit.draw(this.pixels));

		let imageData = this.ctx.createImageData(this.pixels.width, this.pixels.height);
		FillRect.points(new Point(), this.pixels.size)
			.forEach(point => {
				let color = this.pixels.get(point);
				let index = (point.x + point.y * this.pixels.width) * 4;
				imageData.data[index] = color.r;
				imageData.data[index + 1] = color.g;
				imageData.data[index + 2] = color.b;
				imageData.data[index + 3] = 255;
			});
		this.ctx.putImageData(imageData, 0, 0);
	}
}

new Editor(document.querySelector('canvas')!);

// todo
//   select & move
//   move current editing item
//   preview ongoing edit
//   preview ongoing selection region
//   tool selector
//   color selector
//   zoom & pan
//   save/load
//   layers
