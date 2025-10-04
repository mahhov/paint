import {A, Color} from './base.js';

export default class Clipboard {
	static clipboardToText(e: ClipboardEvent): string {
		return e.clipboardData?.getData('text') || '';
	}

	static clipboardToPixelArray(e: ClipboardEvent): Promise<Color[][]> {
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
					let canvas = document.createElement('canvas');
					let ctx = canvas.getContext('2d');
					if (!ctx) return reject('no canvas context');
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
}
