import {sleep} from './util.js';

export default class Debouncer {
	private readonly handler: () => Promise<void>;
	private inProgress = false;
	private hasQueuedCall = false;

	constructor(handler: () => Promise<void>) {
		this.handler = handler;
	}

	public queue() {
		this.hasQueuedCall = true;
	}

	public allow() {
		if (this.hasQueuedCall && !this.inProgress)
			this.invoke();
	}

	private async invoke() {
		this.inProgress = true;
		try {
			this.hasQueuedCall = false;
			await this.handler();
			await sleep(300);
		} catch (error) {
			console.warn('Debouncer failed', error);
		} finally {
			this.inProgress = false;
		}
	}
}
