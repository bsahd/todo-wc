function h(tagName, attributes = {}, ...childrens) {
	var element = document.createElement(tagName);
	for (const [attributeName, attributeData] of Object.entries(attributes)) {
		if ("listeners" == attributeName) {
			for (const [eventName, eventListener] of Object.entries(attributeData)) {
				element.addEventListener(eventName, eventListener);
			}
		} else {
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

	on(event, listener) {
		if (!this.listeners[event]) {
			this.listeners[event] = [];
		}
		this.listeners[event].push(listener);
	}

	emit(event, ...args) {
		const listeners = this.listeners[event] || [];
		listeners.forEach((listener) => {
			listener(...args);
		});
	}

	off(event, listenerToRemove) {
		const listeners = this.listeners[event];
		if (listeners) {
			this.listeners[event] = listeners.filter((listener) => listener !== listenerToRemove);
		}
	}
}

const gevent = new MyEventEmitter();
gevent.on("toast", (e) => {
	console.log(e);
	toast.append(h("toast-item", {}, e));
});

const todo = document.getElementById("todo");
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
document.getElementById("addmany").addEventListener("click", () => {
	new Array(128).fill(null).forEach((_, a) => gevent.emit("addtodo", "elem #" + a));
});
function delay(s) {
	if (s == 0) {
		return;
	}
	return new Promise((o) => setTimeout(o, s));
}
customElements.define(
	"todo-item",
	class extends HTMLElement {
		static observedAttributes = ["text"];
		constructor() {
			super();
		}
		connectedCallback() {
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
				this.text,
			);
			this.append(
				h(
					"button",
					{
						type: "button",
						listeners: {
							click: this.btnUpDownClick.bind(this, true),
						},
					},
					"↑",
				),
				h(
					"button",
					{
						type: "button",
						listeners: {
							click: this.btnUpDownClick.bind(this, false),
						},
					},
					"↓",
				),
				this.textelem,
			);
			this.addEventListener("dragenter", (event) => {
				event.preventDefault();
				this.classList.add("dragt");
			});
			this.addEventListener("dragover", (event) => {
				event.preventDefault();
			});
			this.addEventListener("dragleave", (event) => {
				event.preventDefault();
				this.classList.remove("dragt");
			});
			this.addEventListener("drop", (event) => {
				event.preventDefault();
				const data = event.dataTransfer.getData("text/plain");
				this.classList.remove("dragt");
				this.dragdrop(data);
			});
			this.addEventListener("dragstart", (event) =>
				event.dataTransfer.setData("text/plain", this.text),
			);

			this.setAttribute("draggable", "true");
			gevent.emit("toast", `connecting todo ${this.text}`);
			gevent.on("allclear", this.removebinded);
			gevent.on("removetodo", this.removetodobinded);
		}
		removebinded = this.remove.bind(this);
		removetodobinded = this.removetodo.bind(this);
		removetodo(e) {
			if (e == this.text) {
				this.remove();
			}
		}
		dragdrop(todon) {
			const prev = Array.from(todo.children).filter((e) => e.text == todon)[0];
			todo.insertBefore(prev, this);
			gevent.emit("toast", `moving todo ${todon} to before ${this.text}`);
		}
		async btnUpDownClick(updown) {
			this.classList.add(updown ? "moveup" : "movedown");
			const preva =
				todo.children[Array.from(todo.children).indexOf(this) + (updown ? -1 : 1)];
			preva?.classList.add(updown ? "movedown" : "moveup");
			await delay(reduceanim ? 0 : 500);
			this.classList.remove(updown ? "moveup" : "movedown");
			preva?.classList.remove(updown ? "movedown" : "moveup");
			const prev = todo.children[Array.from(todo.children).indexOf(this) + (updown ? -1 : 2)];
			todo.insertBefore(this, prev);
			gevent.emit("toast", `moving todo ${this.text}${updown ? " up" : " down"}`);
		}

		get text() {
			return this.getAttribute("text");
		}

		set text(text) {
			return this.setAttribute("text", text);
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
			gevent.emit("toast", `todo ${this.text} attribute ${name} changed`);
		}
		disconnectedCallback() {
			gevent.off("allclear", this.removebinded);
			gevent.off("removetodo", this.removetodobinded);
			gevent.emit("toast", `disconnected todo ${this.text}`);
		}
	},
);
customElements.define(
	"toast-item",
	class extends HTMLElement {
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
	},
);
function getTodoList() {
	return Array.from(todo.children).map((e) => e.text);
}

gevent.on("addtodo", (e) => {
	if (getTodoList().includes(e)) {
		gevent.emit("toast", `error: todo ${e} exists`);
		throw "todo exists";
	}
	const inselem = h("todo-item", { text: e });
	inselem.insert();
	todo.append(inselem);
});
gevent.on("removetodo", (e) => {});
gevent.on("renametodo", (e) => {
	if (getTodoList().filter((l) => e.after == l).length > 1) {
		gevent.emit("toast", `error: todo ${e.after} exists`);
		e.failcb();
		throw "todo exists";
	}
	e.okcb();
});
