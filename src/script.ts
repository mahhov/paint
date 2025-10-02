class Point {
	readonly x: number;
	readonly y: number;

	constructor(x: number = 0, y: number = x) {
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

	atMost(point: Point) {
		return this.x <= point.x && this.y <= point.y;
	}

	atLeast(point: Point) {
		return this.x >= point.x && this.y >= point.y;
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
	CLEAR,
	MOVE,
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
		let raw = this.getRaw(p);
		return new Color(raw[0], raw[1], raw[2], raw[3]);
	}

	getRaw(p: Point) {
		let index = (p.x + p.y * this.width) * 4;
		return this.imageData.data.subarray(index, index + 4);
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

	setRaw(p: Point, raw: Uint8ClampedArray) {
		let index = (p.x + p.y * this.width) * 4;
		this.imageData.data[index] = raw[0];
		this.imageData.data[index + 1] = raw[1];
		this.imageData.data[index + 2] = raw[2];
		this.imageData.data[index + 3] = raw[3];
	}

	clear() {
		console.time('clear');
		FillRect.points(new Point(), this.size, point => this.set(point, this.defaultColor));
		console.timeEnd('clear');
	}

	isInBounds(p: Point) {
		return p.x > 0 && p.x < this.width && p.y > 0 && p.y < this.height;
	}
}

class Edit {
	readonly points: Point[];

	constructor(points: Point[]) {
		this.points = points;
	}

	validCommit() {
		return this.points.length >= 2 && this.points[1].subtract(this.points[0]).magnitude2 >= EditCreator.nearRange ** 2;
	}

	synchronizePoints(index: number) {}

	draw(pixels: Pixels, sourcePixels: Pixels) {
	}
}

class Select extends Edit {
	constructor(start: Point, end: Point) {
		super([start, end]);
	}

	draw(pixels: Pixels, sourcePixels: Pixels) {
		let colors = [Color.CLEAR, Color.GREEN, Color.CLEAR, Color.BLACK];
		Rect.points(this.points[0], this.points[1], (point, i) =>
			pixels.set(point, colors[i % colors.length]));
	}
}

class Move extends Edit {
	private delta = new Point();

	constructor(start: Point, end: Point) {
		super([start, end, Move.center(start, end)]);
	}

	static center(p1: Point, p2: Point) {
		return p1.add(p2).scale(.5).round;
	}

	synchronizePoints(index: number) {
		let center = Move.center(this.points[0], this.points[1]);
		if (index === 2)
			this.delta = this.points[2].subtract(center);
		else
			this.points[2] = center.add(this.delta);
	}

	draw(pixels: Pixels, sourcePixels: Pixels) {
		console.time('move draw');
		if (pixels !== sourcePixels) {
			let destinationPoints = [this.points[0].add(this.delta), this.points[1].add(this.delta)];
			let min = destinationPoints[0].min(destinationPoints[1]);
			let max = destinationPoints[0].max(destinationPoints[1]);
			FillRect.points(this.points[0], this.points[1], point => {
				if (!point.atLeast(min) || !point.atMost(max))
					pixels.set(point, Color.WHITE);
				let newPoint = point.add(this.delta);
				if (pixels.isInBounds(newPoint))
					pixels.setRaw(newPoint, sourcePixels.getRaw(point));
			});
		}
		console.timeEnd('move draw');
	}
}

class Line extends Edit {
	private readonly color: Color;

	constructor(start: Point, end: Point, color: Color) {
		super([start, end]);
		this.color = color;
	}

	draw(pixels: Pixels, sourcePixels: Pixels) {
		let delta = this.points[1].subtract(this.points[0]);
		let steps = Math.max(Math.abs(delta.x), Math.abs(delta.y));
		for (let i = 0; i <= steps; i++)
			pixels.set(this.points[0].add(delta.scale(i / steps).round), this.color);
	}
}

class Rect extends Edit {
	private readonly color: Color;

	constructor(start: Point, end: Point, color: Color) {
		super([start, end]);
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

	draw(pixels: Pixels, sourcePixels: Pixels) {
		Rect.points(this.points[0], this.points[1], point => pixels.set(point, this.color));
	}
}

class FillRect extends Edit {
	private readonly color: Color;

	constructor(start: Point, end: Point, color: Color) {
		super([start, end]);
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

	draw(pixels: Pixels, sourcePixels: Pixels) {
		FillRect.points(this.points[0], this.points[1], point => pixels.set(point, this.color));
	}
}

class Clear extends Edit {
	constructor(start: Point, end: Point) {
		super([start, end]);
	}

	draw(pixels: Pixels, sourcePixels: Pixels) {
		FillRect.points(this.points[0], this.points[1], point => pixels.set(point, Color.WHITE));
	}
}

class TextEdit extends Edit {
	private readonly size: number;
	private readonly color: Color;

	constructor(pos: Point, size: number, color: Color) {
		super([pos]);
		this.size = size;
		this.color = color;
	}

	draw(pixels: Pixels, sourcePixels: Pixels) {
	}
}

class BucketFill extends Edit {
	private readonly color: Color;

	constructor(pos: Point, color: Color) {
		super([pos]);
		this.color = color;
	}

	validCommit() {
		return true;
	}

	draw(pixels: Pixels, sourcePixels: Pixels) {
	}
}

class Paste extends Edit {
	private readonly pixelArray: Color[][];

	constructor(pos: Point, pixelArray: Color[][]) {
		super([pos, pos.add(new Point(pixelArray.length, pixelArray[0].length))]);
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

	validCommit() {
		return true;
	}

	draw(pixels: Pixels, sourcePixels: Pixels) {
		this.pixelArray.forEach((column, x) =>
			column.forEach((color, y) =>
				pixels.set(this.points[0].add(new Point(x, y)), color)));
	}
}

class EditCreator {
	static nearRange = 15;

	mouseDown = new Point();
	mouseUp = new Point();
	mouseIsDown = false;

	selectedPoint = -1;

	// constructor(canvas: HTMLCanvasElement) {
	//
	// }

	static toolIsInstant(tool: Tool) {
		return tool === Tool.COLOR_PICKER;
	}

	getNearPoint(points: Point[], point: Point) {
		let magnitudes = points.map(p => p.subtract(point).magnitude2);
		let minIndex = magnitudes.indexOf(Math.min(...magnitudes));
		return magnitudes[minIndex] < EditCreator.nearRange ** 2 ? minIndex : -1;
		// todo use rectangle region similar to that drawn
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

			let nearPendingPoint = this.pendingEdit ? this.editCreator.getNearPoint(this.pendingEdit.points, this.editCreator.mouseDown) : -1;
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

			if (e.key === 'Delete' && this.pendingEdit instanceof Select)
				this.addEdit(new Clear(this.pendingEdit.points[0], this.pendingEdit.points[1]));

			if (e.key === 'Escape' || e.key === 'Delete') {
				this.pendingEdit = null;
				this.draw(DrawMode.PENDING_EDIT);
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
				e: Tool.CLEAR,
				m: Tool.MOVE,
			}[e.key];
			if (tool === undefined) return;
			this.tool = tool;
			let edit = null;
			if (tool === Tool.MOVE && this.pendingEdit && this.pendingEdit.points.length >= 2)
				edit = new Move(this.pendingEdit.points[0], this.pendingEdit.points[1]);
			this.startNewEdit(edit);
		});

		document.addEventListener('paste', e =>
			Paste.clipboardPixelArray(e)
				.then(pixelArray => {
					let paste = new Paste(this.editCreator.mouseUp, pixelArray);
					this.startNewEdit(paste);
					this.startNewEdit(new Select(paste.points[0], paste.points[1]));
				})
				.catch(e => console.warn(e)));

		let drawLoop = async () => {
			await this.drawOnScreen();
			requestAnimationFrame(drawLoop);
		};
		drawLoop();
	}

	// handle mouse events to create, start, resume edits

	private handleInstantEdit() {
		this.color = this.pixels.get(this.editCreator.mouseUp);
	}

	private startNewEdit(edit: Edit | null = this.createPendingEdit(this.editCreator.mouseUp)) {
		let commit = this.pendingEdit?.validCommit();
		if (commit)
			this.addEdit(this.pendingEdit!);
		this.pendingEdit = edit;
		if (this.pendingEdit)
			this.editCreator.selectedPoint = 0;
		if (commit)
			this.draw(DrawMode.LAST_EDIT);
		else if (this.pendingEdit)
			this.draw(DrawMode.PENDING_EDIT);
	}

	private resumeEdit() {
		if (!this.pendingEdit) return; // should this be moved to callsites?
		this.pendingEdit.points[this.editCreator.selectedPoint] = this.editCreator.mouseUp;
		this.pendingEdit.synchronizePoints(this.editCreator.selectedPoint);
		this.draw(DrawMode.PENDING_EDIT);
	}

	private createPendingEdit(point: Point): Edit {
		switch (this.tool) {
			case Tool.SELECT:
				return new Select(point, point);
			case Tool.LINE:
				return new Line(point, point, this.color);
			case Tool.RECT:
				return new Rect(point, point, this.color);
			case Tool.FILL_RECT:
				return new FillRect(point, point, this.color);
			case Tool.TEXT:
				return new TextEdit(point, 12, this.color);
			case Tool.COLOR_PICKER:
				let never: never;
			case Tool.BUCKET_FILL:
				return new BucketFill(point, this.color);
			case Tool.CLEAR:
				return new Clear(point, point);
			case Tool.MOVE:
				return new Move(point, point);
		}
	}

	// manage edit, undo, redo stacks

	private addEdit(edit: Edit) {
		this.edits.push(edit);
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
	}

	private draw(drawMode: DrawMode) {
		if (drawMode === DrawMode.FULL) {
			this.pixels.clear();
			this.edits
				.filter(edit => !(edit instanceof Select))
				.forEach(edit => edit.draw(this.pixels, this.pixels));

		} else if (drawMode === DrawMode.LAST_EDIT) {
			let edit = this.edits.at(-1)!;
			if (!(edit instanceof Select))
				edit.draw(this.pixels, this.pixels);
		}

		this.pendingDirty = true;
	}

	private async drawOnScreen() {
		if (this.pendingDirty) {
			this.pendingDirty = false;
			this.pendingPixels.clear();
			if (this.pendingEdit) {
				this.pendingEdit.draw(this.pendingPixels, this.pixels);
				let r = new Point(EditCreator.nearRange / 2).round;
				this.pendingEdit.points.forEach(p =>
					new Select(p.subtract(r), p.add(r)).draw(this.pendingPixels, this.pixels));
			}
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
//   tool selector UI
//   color selector UI
//   zoom & pan
//   save/load
//   layers
//   middle mouse to pan
//   scroll to zoom
//   right click to clear
//   text, bucket fill, & pencil tool
//   shift to draw horizontal or vertical lines
//   cut & copy
