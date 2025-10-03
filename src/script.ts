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
	readonly width: number;
	readonly height: number;
	private readonly defaultColor: Color;
	readonly imageData: ImageData;
	private readonly cachedClearedImageDataData: Uint8ClampedArray;

	constructor(width: number, height: number, ctx: CanvasRenderingContext2D, defaultColor: Color) {
		this.width = width;
		this.height = height;
		this.defaultColor = defaultColor;
		this.imageData = ctx.createImageData(width, height);

		let rawDefaultColor = new Uint8ClampedArray([this.defaultColor.r, this.defaultColor.g, this.defaultColor.b, this.defaultColor.a]);
		this.cachedClearedImageDataData = new Uint8ClampedArray(width * height * rawDefaultColor.length);
		for (let i = 0; i < this.cachedClearedImageDataData.length; i += rawDefaultColor.length)
			this.cachedClearedImageDataData.set(rawDefaultColor, i);
		this.clear();
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
		this.imageData.data.set(this.cachedClearedImageDataData);
	}

	isInBounds(p: Point) {
		return p.x >= 0 && p.x < this.width && p.y >= 0 && p.y < this.height;
	}

	debug() {
		let seen1: Record<string, number> = {};
		for (let i = 0; i < this.width; i++)
			for (let j = 0; j < this.width; j++) {
				let x = this.get(new Point(i, j));
				let y = [x.r, x.g, x.b, x.a].toString();
				seen1[y] ||= 0;
				seen1[y]++;
			}

		let seen2: Record<string, number> = {};
		for (let i = 0; i < this.imageData.data.length; i += 4) {
			let x = this.imageData.data.subarray(i, i + 4).toString();
			seen2[x] ||= 0;
			seen2[x]++;
		}

		console.log(seen1, seen2);
	}
}

class Edit {
	protected readonly points_: Point[];

	constructor(points: Point[]) {
		this.points_ = points;
	}

	get points(): readonly Point[] {
		return this.points_;
	}

	setPoint(index: number, point: Point) {
		this.points_[index] = point;
	}

	validCommit() {
		return this.points_.length >= 2 && this.points[1].subtract(this.points[0]).magnitude2 >= EditCreator.nearRange ** 2;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
	}
}

class Select extends Edit {
	constructor(start: Point, end: Point) {
		super([start, end]);
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		if (pending) {
			let colors = [Color.WHITE, Color.BLACK];
			Rect.points(this.points[0], this.points[1], (point, i) =>
				pixels.set(point, colors[i % colors.length]));
		}
	}
}

class Move extends Edit {
	private delta = new Point();

	constructor(start: Point, end: Point) {
		super([start, end, start, end, Move.center(start, end)]);
	}

	static center(p1: Point, p2: Point) {
		return p1.add(p2).scale(.5).round;
	}

	setPoint(index: number, point: Point) {
		this.points_[index] = point;
		let center = Move.center(this.points[0], this.points[1]);
		switch (index) {
			case 0:
			case 1:
				this.points_[index + 2] = this.points[index].add(this.delta);
				this.points_[4] = center.add(this.delta);
				break;
			case 2:
			case 3:
				this.points_[index - 2] = this.points[index].subtract(this.delta);
				this.points_[4] = center.add(this.delta);
				break;
			case 4:
				this.delta = this.points[4].subtract(center);
				this.points_[2] = this.points[0].add(this.delta);
				this.points_[3] = this.points[1].add(this.delta);
				break;
		}
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		let min = this.points[0].min(this.points[1]);
		let max = this.points[0].max(this.points[1]).add(new Point(1));
		let iterateClear = max.subtract(min);
		let clearLine = new Uint8ClampedArray(iterateClear.x * 4).fill(255);

		let destMin = min.add(this.delta).max(new Point());
		let destMax = max.add(this.delta).min(pixels.size);
		let sourceMin = destMin.subtract(this.delta);
		let sourceMax = destMax.subtract(this.delta);
		let iterateCopy = sourceMax.subtract(sourceMin);
		let copyLines = [];

		for (let y = 0; y < iterateCopy.y; y++)
			copyLines[y] = sourcePixels.imageData.data.slice((sourceMin.x + (sourceMin.y + y) * pixels.width) * 4, (sourceMin.x + iterateCopy.x + (sourceMin.y + y) * pixels.width) * 4);
		for (let y = 0; y < iterateClear.y; y++)
			pixels.imageData.data.set(clearLine, (min.x + (min.y + y) * pixels.width) * 4);
		for (let y = 0; y < iterateCopy.y; y++)
			pixels.imageData.data.set(copyLines[y], (destMin.x + (destMin.y + y) * pixels.width) * 4);

		// if (pending) {
			new Select(this.points[0], this.points[1]).draw(pixels, sourcePixels, pending);
			new Select(this.points[2], this.points[3]).draw(pixels, sourcePixels, pending);
			// let colors = [Color.WHITE, Color.BLACK];
			// Rect.points(this.points[0], this.points[1], (point, i) =>
			// 	pixels.set(point, colors[i % colors.length]));
			// Rect.points(this.points[2], this.points[3], (point, i) =>
			// 	pixels.set(point, colors[i % colors.length]));
		// }
	}
}

class Line extends Edit {
	private readonly color: Color;

	constructor(start: Point, end: Point, color: Color) {
		super([start, end]);
		this.color = color;
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
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

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
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

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
		FillRect.points(this.points[0], this.points[1], point => pixels.set(point, this.color));
	}
}

class Clear extends Edit {
	constructor(start: Point, end: Point) {
		super([start, end]);
	}

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
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

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
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

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
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

	draw(pixels: Pixels, sourcePixels: Pixels, pending: boolean) {
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

	getNearPoint(points: readonly Point[], point: Point) {
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
	private tool = Tool.MOVE;
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
				s: Tool.MOVE,
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
		this.editCreator.selectedPoint = 0;
		this.draw(DrawMode.PENDING_EDIT);
	}

	private resumeEdit() {
		if (!this.pendingEdit) return; // should this be moved to callsites?
		this.pendingEdit.setPoint(this.editCreator.selectedPoint, this.editCreator.mouseUp);
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
			this.edits.forEach(edit => edit.draw(this.pixels, this.pixels, false));

		} else if (drawMode === DrawMode.LAST_EDIT)
			this.edits.at(-1)!.draw(this.pixels, this.pixels, false);

		this.pendingDirty = true;
	}

	private async drawOnScreen() {
		if (this.pendingDirty) {
			this.pendingDirty = false;
			this.pendingPixels.clear();
			if (this.pendingEdit) {
				this.pendingEdit.draw(this.pendingPixels, this.pixels, true);
				let r = new Point(EditCreator.nearRange / 2).round;
				this.pendingEdit.points.forEach(p =>
					new Select(p.subtract(r), p.add(r)).draw(this.pendingPixels, this.pixels, true));
			}
		}

		this.ctx.putImageData(this.pixels.imageData, 0, 0);
		let pending = await createImageBitmap(this.pendingPixels.imageData);
		this.ctx.drawImage(pending, 0, 0);
	}
}

window.editor = new Editor(document.querySelector('canvas')!);

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
