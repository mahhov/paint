import {BucketFill, Clear, Edit, FillRect, Line, Move, Paste, Rect, Select, StraightLine, TextEdit} from './Edit.js';
import EditCreator from './EditCreator.js';
import Color from './util/Color.js';
import Point from './util/Point.js';

type Class = new (...args: any[]) => any;
type CustomSerializerType<Original extends object, Serialized extends object> = {
	serialize: (original: Original) => Serialized,
	deserialize: (serialized: Serialized) => Original,
};
type TypeMapValue = Class | CustomSerializerType<any, any> | null;
type TypeMap = Record<string, TypeMapValue>;

let typeMap: TypeMap = {
	EditCreator,
	Edit,
	Select,
	Move,
	Line,
	StraightLine,
	Rect,
	FillRect,
	Clear,
	TextEdit,
	BucketFill,
	Paste,
	Point,
	Color,
	Uint8ClampedArray: {
		serialize: (int8: Uint8ClampedArray): { data: number[] } => ({data: Array.from(int8)}),
		deserialize: (obj: { data: number[] }): Uint8ClampedArray => new Uint8ClampedArray(obj.data),
	} as CustomSerializerType<Uint8ClampedArray, { data: number[] }>,
};

export default class Serializer {
	private static mapEntries(obj: Record<string, any>, handler: (arg: any) => any): Record<string, any> {
		return Object.fromEntries(Object.entries(obj)
			.map(([key, value]) => [key, handler(value)]));
	}

	static serialize(obj: any): any {
		// primitive
		if (obj === null || typeof obj !== 'object')
			return obj;

		// array
		if (Array.isArray(obj))
			return obj.map(value => Serializer.serialize(value));

		let typeName = obj.constructor.name;
		let Type: TypeMapValue | undefined = typeMap[obj.constructor.name];

		// object literal
		if (typeName === 'Object')
			return Serializer.mapEntries(obj, value => Serializer.serialize(value));

		// unmapped class instance
		if (Type === undefined) {
			console.warn('Missing type:', typeName);
			return;
		}

		// Type null
		if (Type === null)
			return null;

		// Type custom serializer or class
		let x = typeof Type === 'object' ?
			(Type as CustomSerializerType<any, any>).serialize(obj) : // Type custom serializer
			Serializer.mapEntries(obj, value => Serializer.serialize(value)); // Type class
		x.type__ = obj.constructor.name;
		return x;
	}

	static deserialize(obj: any): any {
		// primitive
		if (obj === null || typeof obj !== 'object')
			return obj;

		// array
		if (Array.isArray(obj))
			return obj.map(value => Serializer.deserialize(value));

		// object literal
		if (!obj.type__)
			return Serializer.mapEntries(obj, value => Serializer.deserialize(value));

		let x = Serializer.mapEntries(obj, value => Serializer.deserialize(value));
		let Type: TypeMapValue | undefined = typeMap[obj.type__];

		// unmapped class instance
		if (Type === undefined) {
			console.warn('Missing type:', obj.type__);
			return;
		}

		// Type null
		if (Type === null)
			return null;

		// Type custom serializer
		if (typeof Type === 'object')
			return (Type as CustomSerializerType<any, any>).deserialize(x);

		// Type class
		return Object.assign(Object.create((Type as Class).prototype), x);
	}
}
