import {boundRect, Point} from './base.js';

export type PasteData = { width: number, height: number, int8Array: Uint8ClampedArray }

export default class Clipboard {
	static clipboardToText(e: ClipboardEvent): string {
		return e.clipboardData?.getData('text') || '';
	}

	static clipboardToPixelArray(e: ClipboardEvent): Promise<PasteData> {
		return new Promise((resolve, reject) => {
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
					let canvas = new OffscreenCanvas(img.width, img.height);
					let ctx = canvas.getContext('2d');
					if (!ctx) return reject('no canvas context');
					ctx.drawImage(img, 0, 0);
					let imageData = ctx.getImageData(0, 0, img.width, img.height);
					resolve({width: imageData.width, height: imageData.height, int8Array: imageData.data});
				};
				img.src = e.target?.result as string;
			};
			reader.readAsDataURL(blob);
		});
	}

	static async copyCanvas(canvas: HTMLCanvasElement) {
		let blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
		if (!blob)
			console.warn('Copy failed to get blob');
		else
			navigator.clipboard.write([new ClipboardItem({[blob.type]: blob})])
				.catch(e => console.warn('Copy failed to write to clipboard', e));
	}

	static async copyCanvasRegion(canvas: HTMLCanvasElement, point1: Point, point2: Point) {
		let [min, max] = boundRect(point1, point2, new Point(canvas.width, canvas.height));
		let delta = max.subtract(min);

		let tempCanvas = document.createElement('canvas');
		tempCanvas.width = delta.x;
		tempCanvas.height = delta.y;
		let tempCtx = tempCanvas.getContext('2d');
		if (!tempCtx) throw new Error('no canvas context');
		tempCtx.drawImage(canvas, min.x, min.y, delta.x, delta.y, 0, 0, delta.x, delta.y);

		return Clipboard.copyCanvas(tempCanvas);
	}
}
