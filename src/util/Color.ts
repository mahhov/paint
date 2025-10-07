export default class Color {
	static WHITE = Color.fromRgba(255, 255, 255, 255);
	static BLACK = Color.fromRgba(0, 0, 0, 255);
	static CLEAR = Color.fromRgba(0, 0, 0, 0);
	static DARK_GRAY = Color.fromRgba(60, 60, 60, 255);
	static LIGHT_GRAY = Color.fromRgba(180, 180, 180, 255);

	readonly int32: number;

	constructor(int32: number) {
		this.int32 = int32;
	}

	static fromRgba(r: number, g: number, b: number, a: number) {
		return new Color(((a << 24) | (b << 16) | (g << 8) | r) >>> 0);
	}

	static fromInt32IgnoreAlpha(int32: number) {
		return new Color((int32 | 255 << 24) >>> 0);
	}
}
