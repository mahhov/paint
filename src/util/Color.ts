import Point from './Point.js';
import {round} from './util.js';

export default class Color {
	static WHITE = Color.fromRgba(255, 255, 255, 255);
	static BLACK = Color.fromRgba(0, 0, 0, 255);
	static CLEAR = Color.fromRgba(0, 0, 0, 0);
	static DARK_GRAY = Color.fromRgba(85, 85, 85, 255);
	static LIGHT_GRAY = Color.fromRgba(170, 170, 170, 255);
	static PREVIEW_FILL = Color.fromRgba(255, 0, 0, 255);
	static PREVIEW_HIGHLIGHT = Color.fromRgba(255, 0, 0, 150);

	readonly int32: number;

	constructor(int32: number) {
		this.int32 = int32;
	}

	static fromRgba(r: number, g: number, b: number, a: number): Color {
		return new Color(((a << 24) | (b << 16) | (g << 8) | r) >>> 0);
	}

	static hslToRgb(h: number, s: number, l: number): [number, number, number] {
		let r: number, g: number, b: number;

		if (s === 0)
			r = g = b = l;

		else {
			let hue2rgb = (p: number, q: number, t: number) => {
				if (t < 0) t += 1;
				if (t > 1) t -= 1;
				if (t < 1 / 6) return p + (q - p) * 6 * t;
				if (t < 1 / 2) return q;
				if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
				return p;
			};

			let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			let p = 2 * l - q;

			r = hue2rgb(p, q, h / 360 + 1 / 3);
			g = hue2rgb(p, q, h / 360);
			b = hue2rgb(p, q, h / 360 - 1 / 3);
		}
		return [round(r * 255), round(g * 255), round(b * 255)];
	}

	static rgbToHsl(r: number, g: number, b: number): [number, number, number] {
		r /= 255;
		g /= 255;
		b /= 255;

		let max = Math.max(r, g, b);
		let min = Math.min(r, g, b);
		let delta = max - min;

		let h = 0;
		let s = 0;
		let l = (max + min) / 2;

		if (delta) {
			s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
			switch (max) {
				case r:
					h = (g - b) / delta + (g < b ? 6 : 0);
					break;
				case g:
					h = (b - r) / delta + 2;
					break;
				case b:
					h = (r - g) / delta + 4;
					break;
			}
			h *= 60;
		}
		return [round(h), s, l];
	}

	static fromFloat(float: Point, brightness: number): Color {
		float = float.subtract(new Point(.5));
		let angle = Math.atan2(float.y, float.x);
		let radius = float.magnitude2 ** .5;
		let s = radius / .5;
		let h = (angle * 180 / Math.PI + 360) % 360;
		let rgb = Color.hslToRgb(h, s, brightness);
		return Color.fromRgba(...rgb, 255);
	}

	static subtract(color1: number, color2: number) {
		if (color1 === color2) return color1;
		let rgba1 = new Color(color1).toRgba();
		let rgba2 = new Color(color2).toRgba();
		let diff = rgba1[0] + rgba1[1] + rgba1[2] - (rgba2[0] + rgba2[1] + rgba2[2]);
		return diff > 0 ?
			Color.fromRgba(0, Math.min(100 + diff, 255), 0, 255).int32 :
			Color.fromRgba(Math.min(100 - diff, 255), 0, 0, 255).int32;
	}

	toRgba(): [number, number, number, number] {
		let r = (this.int32) & 0xFF;
		let g = (this.int32 >> 8) & 0xFF;
		let b = (this.int32 >> 16) & 0xFF;
		let a = (this.int32 >> 24) & 0xFF;
		return [r, g, b, a];
	}

	toFloat(): [Point, number] {
		let rgba = this.toRgba();
		let [h, s, l] = Color.rgbToHsl(rgba[0], rgba[1], rgba[2]);
		let radius = s * .5;
		let angle = h * Math.PI / 180;
		let x = .5 + radius * Math.cos(angle);
		let y = .5 + radius * Math.sin(angle);
		return [new Point(x, y), l];
	}
}
