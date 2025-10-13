import {BucketFill, Clear, Edit, FillRect, GridLine, Line, Move, Paste, Pen, Preview, Rect, Select, StraightLine, TextEdit} from './Edit.js';
import EditStack, {DirtyMode} from './EditStack.js';
import TextEditor from './TextEditor.js';
import Color from './util/Color.js';
import Point from './util/Point.js';

type Class = new (...args: any[]) => any;
type CustomSerializerType<Original extends any, Serialized extends any> = {
	serialize: (original: Original) => Serialized,
	deserialize: (serialized: Serialized) => Original,
};
type TypeMapValue = Class | CustomSerializerType<any, any> | null;
type TypeMap = Record<string, TypeMapValue>;

type SerializedEditStack = {
	edits: Edit[],
	pendingEdit: Edit | null,
	postEdits: Edit[],
	redoEdits: Edit[],
};

let typeMap: TypeMap = {
	EditStack: {
		serialize: (editStack: EditStack): SerializedEditStack => ({
			edits: Serializer.serialize(editStack.edits),
			pendingEdit: Serializer.serialize(editStack.pendingEdit),
			postEdits: Serializer.serialize(editStack.postEdits),
			redoEdits: Serializer.serialize(editStack.redoEdits),
		}),
		deserialize: (serializedEditStack: SerializedEditStack): EditStack => {
			let editStack = new EditStack();
			editStack.edits = Serializer.deserialize(serializedEditStack.edits);
			editStack.pendingEdit = Serializer.deserialize(serializedEditStack.pendingEdit);
			editStack.postEdits = Serializer.deserialize(serializedEditStack.postEdits);
			editStack.redoEdits = Serializer.deserialize(serializedEditStack.redoEdits);
			editStack.maxDirty = Serializer.deserialize(DirtyMode.ALL_EDITS);
			return editStack;
		},
	} as CustomSerializerType<EditStack, SerializedEditStack>,
	Edit,
	Select,
	Preview,
	Move,
	Line,
	StraightLine,
	GridLine,
	Rect,
	FillRect,
	Clear,
	TextEdit,
	TextEditor: {
		serialize: (textEditor: TextEditor): string => textEditor.state.text,
		deserialize: (text: string): TextEditor => {
			let textEditor = new TextEditor();
			textEditor.type(text);
			return textEditor;
		},
	} as CustomSerializerType<TextEditor, string>,
	BucketFill,
	Paste,
	Pen,
	Point,
	Color,
	Uint8ClampedArray: {
		serialize: (int8: Uint8ClampedArray): Uint8ClampedArray => int8,
		deserialize: (int8: Uint8ClampedArray): Uint8ClampedArray => int8,
	} as CustomSerializerType<Uint8ClampedArray, Uint8ClampedArray>,
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

		// Type custom serializer
		if (typeof Type === 'object') {
			let x = (Type as CustomSerializerType<any, any>).serialize(obj);
			return {type__: obj.constructor.name, wrapped: x};
		}

		// Type class
		let x = Serializer.mapEntries(obj, value => Serializer.serialize(value));
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
			return (Type as CustomSerializerType<any, any>).deserialize(obj.wrapped);

		// Type class
		let x = Serializer.mapEntries(obj, value => Serializer.deserialize(value));
		return Object.assign(Object.create((Type as Class).prototype), x);
	}
}
