type Class = new (...args: any[]) => any;

export default class Serializer {
	private typeMap: Record<string, Class | null>;

	constructor(typeMap: Record<string, Class | null>) {
		this.typeMap = typeMap;
	}

	private static mapEntries(obj: Record<string, any>, handler: typeof this.serialize | typeof this.deserialize): Record<string, any> {
		return Object.fromEntries(Object.entries(obj)
			.map(([key, value]) => [key, handler(value)]));
	}

	static serialize(obj: any): any {
		if (Array.isArray(obj))
			return obj.map(value => Serializer.serialize(value));
		if (obj && typeof obj === 'object') {
			let x = Serializer.mapEntries(obj, value => Serializer.serialize(value));
			x.type__ = obj.constructor.name;
			return x;
		}
		return obj;
	}

	// todo make static
	deserialize(obj: any): any {
		if (Array.isArray(obj))
			return obj.map(value => this.deserialize(value));
		if (obj && typeof obj === 'object') {
			let x = Serializer.mapEntries(obj, value => this.deserialize(value));
			let Type = this.typeMap[obj.type__];
			if (Type === undefined) {
				console.warn('Missing type:', obj.type__);
				return;
			}
			if (Type === null) return null;
			return Object.assign(Object.create(Type.prototype), x);
		}
		return obj;
	}
}
