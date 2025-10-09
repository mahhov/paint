export default class Debouncer {
	private readonly handler: () => Promise<void>;
	private inProgress: boolean = false;
	private hasQueuedCall: boolean = false;

	constructor(handler: () => Promise<void>) {
		this.handler = handler;
	}

	public async invoke() {
		if (this.inProgress) {
			this.hasQueuedCall = true;
			return;
		}
		this.inProgress = true;
		try {
			do {
				this.hasQueuedCall = false;
				await this.handler();
			} while (this.hasQueuedCall);
		} catch (error) {
			console.warn('Debouncer failed', error);
		} finally {
			this.inProgress = false;
		}
	}
}
