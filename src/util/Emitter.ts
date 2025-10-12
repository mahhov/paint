export type EventMap = Record<string, any | void>;

export default class Emitter<T extends EventMap> {
	private readonly listeners: Partial<Record<keyof T, Function[]>> = {};

	addListener<K extends keyof T>(event: K, listener: (arg: T[K]) => void): this {
		this.listeners[event] ||= [];
		this.listeners[event].push(listener);
		return this;
	}

	emit<K extends keyof T>(event: K, ...arg: T[K] extends void ? [] : [T[K]]) {
		this.listeners[event]?.forEach(listener => listener(...arg));
	}
}
