export default class Emitter {
	private readonly listeners: Record<string, ((...args: any[]) => void)[]> = {};

	addListener(event: string, listener: (...args: any[]) => void) {
		this.listeners[event] ||= [];
		this.listeners[event].push(listener);
		return this;
	}

	emit(event: string, ...args: any[]) {
		if (this.listeners[event])
			this.listeners[event].forEach(listener => listener(...args));
	}
}
