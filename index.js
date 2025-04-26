"use strict";
function h(tagName, attributes = {}, ...childrens) {
	var element = document.createElement(tagName);
	for (const [attributeName, attributeData] of Object.entries(attributes)) {
		if ("listeners" == attributeName) {
			for (const [eventName, eventListener] of Object.entries(attributeData)) {
				element.addEventListener(eventName, eventListener);
			}
		} else if (attributeData !== null) {
			element.setAttribute(attributeName, attributeData);
		}
	}
	element.append(...childrens);
	return element;
}

class MyEventEmitter {
	constructor() {
		this.listeners = {};
	}

	on(event, listener, signal) {
		console.log("on");
		if (!this.listeners[event]) {
			this.listeners[event] = [];
		}
		this.listeners[event].push(listener);
		signal?.addEventListener("abort", () => {
			console.log("off");
			this.off(event, listener);
		});
	}

	emit(event, ...args) {
		const listeners = this.listeners[event] || [];
		listeners.forEach((listener) => {
			listener(...args);
		});
	}

	off(event, listenerToRemove) {
		this.listeners[event].splice(this.listeners[event].indexOf(listenerToRemove), 1);
	}
}

const gevent = new MyEventEmitter();
gevent.on("toast", (e) => {
	console.log(e);
	toast.append(h("toast-item", {}, e));
});

const todoEl = document.getElementById("todo");
const toast = document.getElementById("toast");
const reduceanim = window.matchMedia(`(prefers-reduced-motion: reduce)`)?.matches;
document.getElementById("textinelem").addEventListener("keydown", (e) => {
	if (e.key == "Enter") {
		e.preventDefault();
		gevent.emit("addtodo", e.currentTarget.value);
		e.currentTarget.value = "";
	}
});
document.getElementById("clearall").addEventListener("click", () => {
	window.scrollTo({ top: 0 });
	gevent.emit("allclear");
});
document.getElementById("clearchecked").addEventListener("click", () => {
	gevent.emit("removechecked");
});

function delay(s) {
	if (s == 0) {
		return;
	}
	return new Promise((o) => setTimeout(o, s));
}

class TodoListElement extends HTMLElement{
	constructor(){
		super()
	}
	get todos(){
		return Array.from(this.children)
	}
}
customElements.define("todo-list",TodoListElement,)

class TodoItemElement extends HTMLElement {
	static observedAttributes = ["text", "done"];
	constructor() {
		super();
	}
	connectedCallback() {
		this.disconnectAbort = new AbortController();

		this.addEventListener(
			"dragenter",
			(event) => {
				event.preventDefault();
				this.classList.add("dragt");
			},
			{ signal: this.disconnectAbort.signal }
		);
		this.addEventListener(
			"dragover",
			(event) => {
				event.preventDefault();
			},
			{ signal: this.disconnectAbort.signal }
		);
		this.addEventListener(
			"dragleave",
			(event) => {
				event.preventDefault();
				this.classList.remove("dragt");
			},
			{ signal: this.disconnectAbort.signal }
		);
		this.addEventListener(
			"drop",
			(event) => {
				event.preventDefault();
				const data = event.dataTransfer.getData("text/plain");
				this.classList.remove("dragt");
				this.dragdrop(data);
			},
			{ signal: this.disconnectAbort.signal }
		);
		this.addEventListener(
			"dragstart",
			(event) => event.dataTransfer.setData("text/plain", this.text),
			{ signal: this.disconnectAbort.signal }
		);

		this.setAttribute("draggable", "true");

		gevent.on(
			"allclear",
			() => {
				this.remove();
			},
			this.disconnectAbort.signal
		);
		gevent.on(
			"removechecked",
			() => {
				console.log(`removechecked in "${this.text}" done:${this.done}`);
				if (this.done=="true") {
					this.remove();
				}
			},
			this.disconnectAbort.signal
		);
		gevent.on(
			"removetodo",
			(e) => {
				if (e == this.text) {
					this.remove();
				}
			},
			this.disconnectAbort.signal
		);
		gevent.emit("toast", `connecting todo ${this.text}`);
		this.innerHTML = "";
		this.textelem = h(
			"span",
			{
				listeners: {
					click: () => {
						const after = prompt("new todo", this.text);
						if (after == this.text || after == null) {
							return;
						}
						if (after == "") {
							gevent.emit("removetodo", this.text);

							return;
						}
						this.text = after;
					},
					keydown: (e) => {
						if (e.key == "Enter") {
							e.preventDefault();
							const after = prompt("new todo", this.text);
							if (after == this.text || after == null) {
								return;
							}
							if (after == "") {
								gevent.emit("removetodo", this.text);
								return;
							}
							this.text = after;
						}
					},
				},
				tabindex: 0,
			},
			this.text
		);
		this.checkelem = h("input", {
			type: "checkbox",
			listeners: {
				change: (e) => {
					this.done = e.target.checked;
				},
			},
			checked: this.done ? "on" : null,
		});
		this.append(
			h(
				"button",
				{
					type: "button",
					listeners: {
						click: this.btnUpDownClick.bind(this, true),
					},
				},
				"↑"
			),
			h(
				"button",
				{
					type: "button",
					listeners: {
						click: this.btnUpDownClick.bind(this, false),
					},
				},
				"↓"
			),
			this.checkelem,
			this.textelem
		);
	}
	dragdrop(todon) {
		const prev = todoEl.todos.filter((e) => e.text == todon)[0];
		todoEl.insertBefore(prev, this);
		gevent.emit("toast", `moving todo ${todon} to before ${this.text}`);
	}
	async btnUpDownClick(updown) {
		this.classList.add(updown ? "moveup" : "movedown");
		const preva = todoEl.todos[todoEl.todos.indexOf(this) + (updown ? -1 : 1)];
		preva?.classList.add(updown ? "movedown" : "moveup");
		await delay(reduceanim ? 0 : 500);
		this.classList.remove(updown ? "moveup" : "movedown");
		preva?.classList.remove(updown ? "movedown" : "moveup");
		const prev = todoEl.todos[todoEl.todos.indexOf(this) + (updown ? -1 : 2)];
		todoEl.insertBefore(this, prev);
		gevent.emit("toast", `moving todo ${this.text}${updown ? " up" : " down"}`);
	}

	get text() {
		return this.getAttribute("text");
	}

	set text(text) {
		this.setAttribute("text", text);
	}

	get done() {
		return this.getAttribute("done");
	}

	set done(done) {
		this.setAttribute("done", done);
	}

	async insert() {
		this.classList.add("insert");
		await delay(reduceanim ? 0 : 500);
		this.classList.remove("insert");
	}

	async remove() {
		gevent.emit("toast", `removing todo ${this.text}`);
		this.classList.add("remove");
		await delay(reduceanim ? 0 : 500);
		super.remove();
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (name == "text" && this.textelem) {
			this.textelem.innerText = newValue;
			gevent.emit("renametodo", {
				before: oldValue,
				after: newValue,
				okcb: () => {},
				failcb: () => {
					this.text = oldValue;
				},
			});
		}
		if (name == "done" && this.checkelem) {
			this.checkelem.checked = newValue == "true";
		}
		gevent.emit("toast", `todo ${this.text} attribute ${name} changed`);
	}
	disconnectedCallback() {
		this.disconnectAbort.abort();
		gevent.emit("toast", `disconnected todo ${this.text}`);
	}
}
customElements.define("todo-item", TodoItemElement);
class ToastItemElement extends HTMLElement {
	constructor() {
		super();
	}
	connectedCallback() {
		setTimeout(this.remove.bind(this), 1000);
		this.insert();
	}
	async insert() {
		this.classList.add("insert");
		await delay(reduceanim ? 0 : 500);
		this.classList.remove("insert");
	}

	async remove() {
		this.classList.add("remove");
		await delay(reduceanim ? 0 : 500);
		super.remove();
	}
}
customElements.define("toast-item", ToastItemElement);

gevent.on("addtodo", (e) => {
	if (todoEl.todos.some(l=>l.text==e)) {
		gevent.emit("toast", `error: todo ${e} exists`);
		throw "todo exists";
	}
	const inselem = h("todo-item", { text: e });
	inselem.insert();
	todoEl.append(inselem);
});
gevent.on("removetodo", (e) => {});
gevent.on("renametodo", (e) => {
	if (todoEl.todos.some((l) => e.after == l.text).length > 1) {
		gevent.emit("toast", `error: todo ${e.after} exists`);
		e.failcb();
		throw "todo exists";
	}
	e.okcb();
});
