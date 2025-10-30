import Point from './util/Point.js';

export enum InputState {
	DOWN, UP, PRESSED, RELEASED
}

abstract class Binding {
	private readonly listenerStates: InputState[] = [];
	private state = InputState.UP;
	private readonly listener = () => { };

	protected constructor(listenerStates: InputState[], listener: () => void) {
		this.listenerStates = listenerStates;
		this.listener = listener;
	}

	static updateState(state: InputState) {
		switch (state) {
			case InputState.DOWN:
			case InputState.PRESSED:
				return InputState.DOWN;
			case InputState.UP:
			case InputState.RELEASED:
				return InputState.UP;
		}
	}

	press() {
		if (this.state === InputState.UP)
			this.state = InputState.PRESSED;
	}

	release() {
		if (this.state === InputState.DOWN)
			this.state = InputState.RELEASED;
	}

	keyDown(e: KeyboardEvent) {return false;}

	keyUp(e: KeyboardEvent) {}

	mouseDown(button: MouseButton) {}

	mouseUp(button: MouseButton) {}

	mouseWheel(down: boolean) { }

	tick() {
		if (this.listenerStates.includes(this.state))
			this.listener();
		this.state = KeyBinding.updateState(this.state);
	}
}

export enum KeyModifier {
	CONTROL,
	SHIFT,
	ALT
}

export class KeyBinding extends Binding {
	private readonly key: string;
	private readonly modifiers: KeyModifier[] = [];

	constructor(key: string, modifiers: KeyModifier[], listenerStates: InputState[], listener: () => void) {
		super(listenerStates, listener);
		this.key = key.toLowerCase();
		this.modifiers = modifiers;
	}

	keyDown(e: KeyboardEvent) {
		if (this.filter(e).every(v => v)) {
			this.press();
			return true;
		}
		return false;
	}

	keyUp(e: KeyboardEvent) {
		if (this.filter(e).some(v => v))
			this.release();
	}

	private filter(e: KeyboardEvent) {
		return [
			this.key === e.key.toLowerCase(),
			this.modifiers.includes(KeyModifier.CONTROL) === e.ctrlKey,
			this.modifiers.includes(KeyModifier.SHIFT) === e.shiftKey,
			this.modifiers.includes(KeyModifier.ALT) === e.altKey];
	}
}

export enum MouseButton {
	LEFT, MIDDLE, RIGHT, BACK, FORWARD
}

export class MouseBinding extends Binding {
	private readonly button: MouseButton;

	constructor(button: MouseButton, listenerStates: InputState[], listener: () => void) {
		super(listenerStates, listener);
		this.button = button;
	}

	mouseDown(button: MouseButton) {
		if (this.button === button)
			this.press();
	}

	mouseUp(button: MouseButton) {
		if (this.button === button)
			this.release();
	}
}

export class MouseWheelBinding extends Binding {
	private readonly down: boolean;

	constructor(down: boolean, listener: () => void) {
		super([InputState.PRESSED], listener);
		this.down = down;
	}

	mouseWheel(down: boolean) {
		if (this.down === down)
			this.press();
	}

	tick() {
		super.tick();
		this.release();
	}
}

export class Input {
	private readonly bindings: Binding[] = [];
	mouseDownPosition = Point.P0;
	mouseLastPosition = Point.P0;
	mousePosition = Point.P0;
	shiftDown = false;

	constructor(mouseTarget: HTMLCanvasElement) {
		window.addEventListener('blur', () =>
			Object.values(this.bindings).forEach(binding => binding.release()));

		document.addEventListener('keydown', e => {
			if (e.repeat) return;
			if (e.key === 'Shift')
				this.shiftDown = true;
			if (Object.values(this.bindings).some(binding => binding.keyDown(e)))
				e.preventDefault();
		});
		document.addEventListener('keyup', e => {
			if (e.repeat) return;
			if (e.key === 'Shift')
				this.shiftDown = false;
			Object.values(this.bindings).forEach(binding => binding.keyUp(e));
		});

		mouseTarget.addEventListener('mousedown', e => {
			Object.values(this.bindings).forEach(binding => binding.mouseDown(e.button));
			this.mouseLastPosition = this.mousePosition;
			this.mouseDownPosition = this.mousePosition;
		});
		window.addEventListener('mouseup', e =>
			Object.values(this.bindings).forEach(binding => binding.mouseUp(e.button)));
		mouseTarget.addEventListener('mousemove', e => {
			this.shiftDown = e.shiftKey;
			this.mousePosition = new Point((e.x - mouseTarget.offsetLeft), e.y - mouseTarget.offsetTop);
		});
		mouseTarget.addEventListener('wheel', e => {
			if (e.deltaY < 0)
				Object.values(this.bindings).forEach(binding => binding.mouseWheel(false));
			else
				Object.values(this.bindings).forEach(binding => binding.mouseWheel(true));
		});

		document.addEventListener('contextmenu', e => e.preventDefault());
	}

	addBinding(binding: Binding) {
		this.bindings.push(binding);
	}

	get mouseMoved() {
		return !this.mousePosition.equals(this.mouseLastPosition);
	}

	tick() {
		Object.values(this.bindings).forEach(binding => binding.tick());
		this.mouseLastPosition = this.mousePosition;
	}
}
