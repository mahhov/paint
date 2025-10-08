import Point from './Point.js';
import {clamp, round} from './util.js';

export default class Color {
	static WHITE = Color.fromRgba(255, 255, 255, 255);
	static BLACK = Color.fromRgba(0, 0, 0, 255);
	static CLEAR = Color.fromRgba(0, 0, 0, 0);
	static DARK_GRAY = Color.fromRgba(85, 85, 85, 255);
	static LIGHT_GRAY = Color.fromRgba(170, 170, 170, 255);

	readonly int32: number;

	constructor(int32: number) {
		this.int32 = int32;
	}

	static fromRgba(r: number, g: number, b: number, a: number): Color {
		return new Color(((a << 24) | (b << 16) | (g << 8) | r) >>> 0);
	}

	// todo double check and clean up (ai generated)
	static hsvToRgb(h: number, s: number, v: number): [number, number, number] {
		h /= 60;
		const i = Math.floor(h);
		const f = h - i;
		const p = v * (1 - s);
		const q = v * (1 - f * s);
		const t = v * (1 - (1 - f) * s);

		let r: number, g: number, b: number;
		switch (i % 6) {
			case 0:
				r = v;
				g = t;
				b = p;
				break;
			case 1:
				r = q;
				g = v;
				b = p;
				break;
			case 2:
				r = p;
				g = v;
				b = t;
				break;
			case 3:
				r = p;
				g = q;
				b = v;
				break;
			case 4:
				r = t;
				g = p;
				b = v;
				break;
			case 5:
				r = v;
				g = p;
				b = q;
				break;
			default:
				r = 0;
				g = 0;
				b = 0;
				break;
		}

		return [r, g, b].map(v => round(v * 255)) as [number, number, number];
	}

	// todo double check and clean up (ai generated)
	static rgbToHsv(r: number, g: number, b: number): [number, number, number] {
		const normR = r / 255;
		const normG = g / 255;
		const normB = b / 255;

		const max = Math.max(normR, normG, normB);
		const min = Math.min(normR, normG, normB);
		const delta = max - min;

		let h = 0;
		let s = (max === 0) ? 0 : delta / max;
		let v = max;

		if (delta !== 0) {
			switch (max) {
				case normR:
					h = (normG - normB) / delta + (normG < normB ? 6 : 0);
					break;
				case normG:
					h = (normB - normR) / delta + 2;
					break;
				case normB:
					h = (normR - normG) / delta + 4;
					break;
			}
			h *= 60;
		}

		// Ensure H is 0-360
		h = (h + 360) % 360;

		return [h, s, v];
	}

	// todo double check and clean up (ai generated)
	static fromFloat(float: Point, brightness: number): Color {
		const center = new Point(0.5, 0.5);
		const maxRadius = 0.5;

		// 1. Calculate relative coordinates from the center
		const dx = float.x - center.x;
		const dy = float.y - center.y;

		// 2. Map Polar Coordinates to Hue (H) and Saturation (S)
		const angleRad = Math.atan2(dy, dx);
		const radius = Math.sqrt(dx * dx + dy * dy);

		// Saturation (S): normalized distance from center (0 = center, 1 = edge)
		const s = clamp(radius / maxRadius, 0, 1);

		// Hue (H): angle in degrees (0-360)
		const h = (angleRad * 180 / Math.PI + 360) % 360;

		// Value (V) is the input brightness
		const v = clamp(brightness, 0, 1);

		// 3. Convert H/S/V to R/G/B (0-255)
		const [r, g, b] = Color.hsvToRgb(h, s, v);

		return Color.fromRgba(r, g, b, 255);
	}

	toRgba(): [number, number, number, number] {
		let r = (this.int32) & 0xFF;
		let g = (this.int32 >> 8) & 0xFF;
		let b = (this.int32 >> 16) & 0xFF;
		let a = (this.int32 >> 24) & 0xFF;
		return [r, g, b, a];
	}

	// todo double check and clean up (ai generated)
	toFloat(): [Point, number] {
		const [r, g, b] = this.toRgba();

		// 1. Convert R/G/B (0-255) to H/S/V (0-360, 0-1, 0-1)
		const [h, s, v] = Color.rgbToHsv(r, g, b);

		// 2. Map V (Value) back to brightness
		const brightness = v;

		// 3. Map H (Hue) and S (Saturation) back to 2D coordinates (x, y)
		const maxRadius = 0.5;
		const center = 0.5;

		// Calculate radius and angle
		const radius = s * maxRadius;
		const angleRad = h * Math.PI / 180;

		// Calculate Cartesian coordinates
		const x = center + radius * Math.cos(angleRad);
		const y = center + radius * Math.sin(angleRad);

		// The coordinates are perfectly clamped by the logic, but we include clamp for safety.
		const finalPoint = new Point(clamp(x, 0, 1), clamp(y, 0, 1));

		return [finalPoint, brightness];
	}
}
