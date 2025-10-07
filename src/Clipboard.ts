import Point from './util/Point.js';
import {boundRect} from './util/util.js';

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

	static async copyCanvasRegion(image: ImageBitmap, point1: Point, point2: Point) {
		let [min, max] = boundRect(point1, point2, new Point(image.width, image.height));
		let delta = max.subtract(min);
		let canvas = new OffscreenCanvas(delta.x, delta.y);
		let ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('no canvas context');
		ctx.drawImage(image, min.x, min.y, delta.x, delta.y, 0, 0, delta.x, delta.y);
		let blob: Blob = await canvas.convertToBlob({type: 'image/png'});
		navigator.clipboard.write([new ClipboardItem({[blob.type]: blob})])
			.catch(e => console.warn('Copy failed to write to clipboard', e));
	}
}
