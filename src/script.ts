class Point {
  x: number;
  y: number;

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
}

class Color {
  r: number;
  g: number;
  b: number;

  constructor(r: number, g: number, b: number) {
    this.r = r;
    this.g = g;
    this.b = b;
  }
}

let A = (n: number) => [...Array(n)];

enum Tool {
  SELECT, // copy, paste, move, delete
  LINE,
  RECT,
  TEXT,
  COLOR_PICKER,
  FILL,
}

class Editor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private pixels: Color[][];
  private mouseActive = false;
  private mouseStart = new Point();
  private mouseEnd = new Point();
  private tool = Tool.SELECT;
  private color = new Color(0, 0, 0);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.pixels = A(canvas.width).map(() => A(canvas.height).map(() => new Color(255, 255, 255)));

    canvas.addEventListener('mousedown', e => {
      this.mouseActive = true;
      this.mouseStart = new Point(e.x, e.y);
    });

    canvas.addEventListener('mouseup', e => {
      if (!this.mouseActive)
        return;
      this.mouseActive = false;
      this.mouseEnd = new Point(e.x, e.y);

    });

    canvas.addEventListener('keydown', e => {
    });

    document.addEventListener('paste', async e => {
      let pos = this.tool === Tool.SELECT ? this.mouseStart : new Point();
      Editor.clipboardPixels(e)
          .then(pixels => {
            this.paste(pos, pixels);
            this.draw();
          })
          .catch(e => console.warn(e));
    });

    this.draw();
  }

  private static clipboardPixels(e: ClipboardEvent): Promise<Color[][]> {
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
          let pixels = A(img.width).map((_, x) => A(img.height).map((_, y) => {
            let index = (x + y * img.width) * 4;
            let rgb = [...imageData.data.subarray(index, index + 3)] as [number, number, number];
            return new Color(...rgb);
          }));
          resolve(pixels);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(blob);
    });
  }

  private draw() {
    const imageData = this.ctx.createImageData(this.pixels.length, this.pixels[0].length);
    this.pixels.forEach((column, x) =>
        column.forEach((color, y) => {
          let index = (x + y * this.pixels.length) * 4;
          imageData.data[index] = color.r;
          imageData.data[index + 1] = color.g;
          imageData.data[index + 2] = color.b;
          imageData.data[index + 3] = 255;
        }));
    this.ctx.putImageData(imageData, 0, 0);
  }

  private isInBounds(p: Point) {
    return p.x > 0 && p.x < this.pixels.length && p.y > 0 && p.y < this.pixels[0].length;
  }

  private get(p: Point) {
    return this.isInBounds(p) ?
        this.pixels[p.x][p.y] :
        new Color(0, 0, 0);
  }

  private set(p: Point, c: Color) {
    if (this.isInBounds(p))
      this.pixels[p.x][p.y] = c;
  }

  private copy(p1: Point, p2: Point) {

  }

  private paste(pos: Point, pixels: Color[][]) {
    pixels.forEach((column, x) =>
        column.forEach((color, y) =>
            this.set(pos.add(new Point(x, y)), color)));
  }

  private undo() {
  }

  private redo() {
  }

  private line(p1: Point, p2: Point, color: Color) {
    let delta = p2.subtract(p1);
    let steps = Math.max(Math.abs(delta.x), Math.abs(delta.y));
    for (let i = 0; i <= steps; i++)
      this.set(p1.add(delta.scale(i / steps)), color)
  }

  private rectOutline(p1: Point, p2: Point, color: Color) {
    for (let x = p1.x; x <= p2.x; x++) {
      this.set(new Point(x, p1.y), color)
      this.set(new Point(x, p2.y), color)
    }
    for (let y = p1.y; y <= p2.y; y++) {
      this.set(new Point(p1.x, y), color)
      this.set(new Point(p2.x, y), color)
    }
  }

  private rectFill(p1: Point, p2: Point, color: Color) {
    for (let x = p1.x; x <= p2.x; x++)
      for (let y = p1.y; y <= p2.y; y++)
        this.set(new Point(x, y), color)
  }

  private text(p1: Point, text: string, color: Color) {
  }

  private move(p1: Point, p2: Point, destination: Point) {
    let delta = p2.subtract(p1);
    for (let x = 0; x < delta.x; x++)
      for (let y = 0; y < delta.y; y++) {
        let p = new Point(x, y);
        this.set(destination.add(p), this.get(p1.add(p)));
      }
  }
}

new Editor(document.querySelector('canvas')!);

// paste
// copy
// select & move
// select & delete
// add line
// add text
// customize color
// fill
// rectangle
// move current editing item
// undo/redo
// preview
// tool selector
// color selector
