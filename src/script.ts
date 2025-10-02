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

	get magnitude2() {
		return this.x ** 2 + this.y ** 2;
	}
}

class Color {
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
	private readonly width: number;
	private readonly height: number;
	private readonly defaultColor: Color;
	readonly imageData: ImageData;

	constructor(width: number, height: number, ctx: CanvasRenderingContext2D, defaultColor: Color) {
		this.width = width;
		this.height = height;
		this.defaultColor = defaultColor;
		this.imageData = ctx.createImageData(width, height);
	}

	get size() {
		return new Point(this.width, this.height);
	}

	get(p: Point) {
		if (!this.isInBounds(p))
			return this.defaultColor;

		let index = (p.x + p.y * this.width) * 4;
		let rgba = [...this.imageData.data.subarray(index, index + 4)] as [number, number, number, number];
		return new Color(...rgba);
	}

	set(p: Point, c: Color) {
		if (this.isInBounds(p)) {
			let index = (p.x + p.y * this.width) * 4;
			this.imageData.data[index] = c.r;
			this.imageData.data[index + 1] = c.g;
			this.imageData.data[index + 2] = c.b;
			this.imageData.data[index + 3] = c.a;
		}
	}

	clear() {
		FillRect.points(new Point(), this.size, point => this.set(point, this.defaultColor));
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
		let colors = [Color.CLEAR, Color.GREEN, Color.CLEAR, Color.BLACK];
		Rect.points(this.start, this.end, (point, i) =>
			pixels.set(point, colors[i % colors.length]));
		// todo invert won't work since select is on different layer
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
		FillRect.points(this.start, this.end, point => pixels.set(point.add(this.delta), pixels.get(point)));
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

	static points(start: Point, end: Point, handler: (point: Point, index: number) => void) {
		let min = start.min(end);
		let max = start.max(end);
		let i = 0;
		for (let x = min.x; x <= max.x; x++)
			handler(new Point(x, min.y), i++);
		for (let x = min.x; x <= max.x; x++)
			handler(new Point(x, max.y), i++);
		for (let y = min.y; y <= max.y; y++)
			handler(new Point(min.x, y), i++);
		for (let y = min.y; y <= max.y; y++)
			handler(new Point(max.x, y), i++);
	}

	draw(pixels: Pixels) {
		Rect.points(this.start, this.end, point => pixels.set(point, this.color));
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

	static points(start: Point, end: Point, handler: (point: Point, index: number) => void) {
		let min = start.min(end);
		let max = start.max(end);
		let i = 0;
		for (let x = min.x; x <= max.x; x++)
			for (let y = min.y; y <= max.y; y++)
				handler(new Point(x, y), i++);
	}

	draw(pixels: Pixels) {
		FillRect.points(this.start, this.end, point => pixels.set(point, this.color));
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
		FillRect.points(this.start, this.end, point => pixels.set(point, Color.WHITE));
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

class EditCreator {
	mouseDown = new Point();
	mouseUp = new Point();
	mouseIsDown = false;

	points: [Point, Point] = [new Point(), new Point()];
	selectedPoint = -1;

	// constructor(canvas: HTMLCanvasElement) {
	//
	// }

	static toolIsInstant(tool: Tool) {
		switch (tool) {
			case Tool.SELECT:
			case Tool.LINE:
			case Tool.RECT:
			case Tool.FILL_RECT:
			case Tool.TEXT:
				return false;
			case Tool.COLOR_PICKER:
			case Tool.BUCKET_FILL:
				return true;
		}
	}

	getNearPoint(point: Point) {
		let magnitudes = this.points.map(p => p.subtract(point).magnitude2);
		let minI = magnitudes[0] < magnitudes[1] ? 0 : 1;
		return magnitudes[minI] < 200 ? minI : -1;
	}

	pointsMoved() {
		return this.points[1].subtract(this.points[0]).magnitude2 >= 200;
	}
}

enum DrawMode {
	FULL,
	LAST_EDIT,
	PENDING_EDIT
}

class Editor {
	private readonly ctx: CanvasRenderingContext2D;
	private readonly pixels: Pixels;
	private readonly pendingPixels: Pixels;
	private pendingDirty = false;
	private readonly edits: Edit[] = [];
	private redoEdits: Edit[] = [];
	private readonly editCreator = new EditCreator();
	private pendingEdit: Edit | null = null;
	private tool = Tool.SELECT;
	private color = Color.BLACK;

	constructor(canvas: HTMLCanvasElement) {
		this.ctx = canvas.getContext('2d')!;
		this.pixels = new Pixels(canvas.width, canvas.height, this.ctx, Color.WHITE);
		this.pendingPixels = new Pixels(canvas.width, canvas.height, this.ctx, Color.CLEAR);

		canvas.addEventListener('mousedown', e => {
			this.editCreator.mouseDown = new Point(e.offsetX, e.offsetY);
			this.editCreator.mouseUp = this.editCreator.mouseDown;
			this.editCreator.mouseIsDown = true;

			let nearPendingPoint = this.editCreator.getNearPoint(this.editCreator.mouseDown);
			if (EditCreator.toolIsInstant(this.tool))
				this.handleInstantEdit();
			else if (nearPendingPoint === -1)
				this.startNewEdit();
			else {
				this.editCreator.selectedPoint = nearPendingPoint;
				this.resumeEdit();
			}
		});

		canvas.addEventListener('mousemove', e => {
			if (!this.editCreator.mouseIsDown) return;
			this.editCreator.mouseUp = new Point(e.offsetX, e.offsetY);

			if (EditCreator.toolIsInstant(this.tool))
				this.handleInstantEdit();
			else if (this.editCreator.selectedPoint !== -1)
				this.resumeEdit();
		});

		canvas.addEventListener('mouseup', e => {
			if (!this.editCreator.mouseIsDown) return;
			this.editCreator.mouseUp = new Point(e.offsetX, e.offsetY);
			this.editCreator.mouseIsDown = false;

			if (EditCreator.toolIsInstant(this.tool))
				this.handleInstantEdit();
			else if (this.editCreator.selectedPoint !== -1)
				this.resumeEdit();
		});

		document.addEventListener('keydown', e => {
			if (e.ctrlKey) {
				if (e.key === 'z' && !e.shiftKey)
					this.undoEdit();
				if (e.key === 'z' && e.shiftKey || e.key === 'y')
					this.redoEdit();
				return;
			}

			// todo
			// if (e.key === 'Delete') {
			// 	this.addEdit(new Clear(this.mouseStart, this.mouseEnd));
			// 	return;
			// }

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
			// todo
			// let pos = this.tool === Tool.SELECT ? this.mouseStart : new Point();
			let pos = new Point();
			Paste.clipboardPixelArray(e)
				.then(pixelArray => {
					this.addEdit(new Paste(pos, pixelArray));
				})
				.catch(e => console.warn(e));
		});

		let drawLoop = async () => {
			await this.drawOnScreen();
			requestAnimationFrame(drawLoop);
		};
		drawLoop();
	}

	// handle mouse events to create, start, resume edits

	private handleInstantEdit() {
		let edit = this.createPendingEdit();
		if (edit) this.addEdit(edit);
		this.pendingEdit = null;
		this.draw(DrawMode.LAST_EDIT);
	}

	private startNewEdit() {
		let commit = this.editCreator.pointsMoved();
		if (commit)
			this.addEdit(this.pendingEdit!);
		this.editCreator.points = [this.editCreator.mouseUp, this.editCreator.mouseUp];
		this.editCreator.selectedPoint = 1;
		this.pendingEdit = this.createPendingEdit();
		this.draw(commit ? DrawMode.LAST_EDIT : DrawMode.PENDING_EDIT);
	}

	private resumeEdit() {
		this.editCreator.points[this.editCreator.selectedPoint] = this.editCreator.mouseUp;
		this.pendingEdit = this.createPendingEdit();
		this.draw(DrawMode.PENDING_EDIT);
	}

	private createPendingEdit() {
		switch (this.tool) {
			case Tool.SELECT:
				return new Select(this.editCreator.points[0], this.editCreator.points[1]);
			case Tool.LINE:
				return new Line(this.editCreator.points[0], this.editCreator.points[1], this.color);
			case Tool.RECT:
				return new Rect(this.editCreator.points[0], this.editCreator.points[1], this.color);
			case Tool.FILL_RECT:
				return new FillRect(this.editCreator.points[0], this.editCreator.points[1], this.color);
			case Tool.TEXT:
				return new TextEdit(this.editCreator.points[this.editCreator.selectedPoint], 12, this.color);
			case Tool.COLOR_PICKER:
				this.color = this.pixels.get(this.editCreator.points[this.editCreator.selectedPoint]);
				return null;
			case Tool.BUCKET_FILL:
				return new BucketFill(this.editCreator.points[this.editCreator.selectedPoint], this.color);
		}
	}

	// manage edit, undo, redo stacks

	private addEdit(edit: Edit) {
		this.edits.push(edit);
		this.redoEdits = [];
		this.draw(DrawMode.LAST_EDIT);
	}

	private undoEdit() {
		if (this.pendingEdit) {
			this.redoEdits.push(this.pendingEdit);
			this.pendingEdit = null;
		}
		if (this.edits.length)
			this.pendingEdit = this.edits.pop()!;
		this.draw(DrawMode.FULL);
	}

	private redoEdit() {
		if (!this.redoEdits.length) return;
		let commit = !!this.pendingEdit;
		if (commit)
			this.edits.push(this.pendingEdit!);
		this.pendingEdit = this.redoEdits.pop()!;
		this.draw(commit ? DrawMode.LAST_EDIT : DrawMode.PENDING_EDIT);
	}

	// other

	private copy() {
		// todo copy
	}

	private draw(drawMode: DrawMode) {
		if (drawMode === DrawMode.FULL) {
			this.pixels.clear();
			this.edits
				.filter(edit => !(edit instanceof Select))
				.forEach(edit => edit.draw(this.pixels));

		} else if (drawMode === DrawMode.LAST_EDIT) {
			let edit = this.edits.at(-1)!;
			if (!(edit instanceof Select))
				edit.draw(this.pixels);
		}

		this.pendingDirty = true;
	}

	private async drawOnScreen() {
		if (this.pendingDirty) {
			this.pendingDirty = false;
			this.pendingPixels.clear();
			if (this.pendingEdit)
				this.pendingEdit.draw(this.pendingPixels);
		}

		this.ctx.putImageData(this.pixels.imageData, 0, 0);
		let pending = await createImageBitmap(this.pendingPixels.imageData);
		this.ctx.drawImage(pending, 0, 0);
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
