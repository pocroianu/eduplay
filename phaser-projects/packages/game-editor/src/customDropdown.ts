// packages/game-editor/src/customDropdown.ts

export interface DropdownOption {
	value: string;
	label: string;
	secondaryText?: string;
}

export interface CustomDropdown {
	readonly container: HTMLElement;
	setOptions(options: DropdownOption[], selectedValue: string): void;
	getValue(): string;
	destroy(): void;
}

export interface CustomDropdownConfig {
	icon: string;        // Material Symbols icon name
	label: string;       // e.g. "Template", "Scenario", "Language"
	ariaLabel: string;
	wide?: boolean;      // scenario dropdown is wider
	onChange: (value: string) => void;
}

const activeDropdowns = new Set<() => void>();

export function createCustomDropdown(config: CustomDropdownConfig): CustomDropdown {
	const container = document.createElement("div");
	container.className = `dropdown${config.wide ? " dropdown--wide" : ""}`;

	const trigger = document.createElement("button");
	trigger.type = "button";
	trigger.className = "dropdown__trigger";
	trigger.tabIndex = -1;
	trigger.setAttribute("aria-haspopup", "listbox");
	trigger.setAttribute("aria-expanded", "false");
	trigger.setAttribute("aria-label", config.ariaLabel);
	trigger.innerHTML = `
		<span class="dropdown__icon material-symbols-outlined" aria-hidden="true">${config.icon}</span>
		<span class="dropdown__label">${config.label}</span>
		<span class="dropdown__value"></span>
		<span class="dropdown__chevron material-symbols-outlined" aria-hidden="true">expand_more</span>
	`;

	const panel = document.createElement("div");
	panel.className = "dropdown__panel";
	panel.setAttribute("role", "listbox");
	panel.setAttribute("aria-label", config.ariaLabel);

	container.append(trigger, panel);

	let currentValue = "";
	let options: DropdownOption[] = [];
	let focusedIndex = -1;
	let isOpen = false;

	const valueEl = trigger.querySelector(".dropdown__value") as HTMLElement;
	const chevronEl = trigger.querySelector(".dropdown__chevron") as HTMLElement;

	function close(): void {
		isOpen = false;
		trigger.setAttribute("aria-expanded", "false");
		panel.classList.remove("is-open");
		chevronEl.textContent = "expand_more";
		focusedIndex = -1;
		clearFocus();
		activeDropdowns.delete(close);
	}

	function open(): void {
		// Close any other open dropdowns first
		for (const closeOther of activeDropdowns) {
			closeOther();
		}
		isOpen = true;
		trigger.setAttribute("aria-expanded", "true");
		panel.classList.add("is-open");
		chevronEl.textContent = "expand_less";
		focusedIndex = options.findIndex((o) => o.value === currentValue);
		if (focusedIndex >= 0) {
			applyFocus(focusedIndex);
		}
		activeDropdowns.add(close);
	}

	function toggle(): void {
		if (isOpen) {
			close();
		} else {
			open();
		}
	}

	function select(value: string): void {
		if (value === currentValue) {
			close();
			return;
		}
		currentValue = value;
		const selectedOption = options.find((o) => o.value === value);
		valueEl.textContent = selectedOption?.label ?? value;
		close();
		renderOptions();
		config.onChange(value);
	}

	function clearFocus(): void {
		for (const item of panel.querySelectorAll(".dropdown__option")) {
			item.classList.remove("is-focused");
		}
	}

	function applyFocus(index: number): void {
		clearFocus();
		const items = panel.querySelectorAll(".dropdown__option");
		if (items[index]) {
			items[index].classList.add("is-focused");
			(items[index] as HTMLElement).scrollIntoView({ block: "nearest" });
		}
	}

	function renderOptions(): void {
		panel.innerHTML = "";
		for (const option of options) {
			const item = document.createElement("div");
			item.className = "dropdown__option";
			item.setAttribute("role", "option");
			item.setAttribute("aria-selected", String(option.value === currentValue));
			if (option.value === currentValue) {
				item.classList.add("is-selected");
			}

			const labelSpan = document.createElement("span");
			labelSpan.className = "dropdown__option-label";
			labelSpan.textContent = option.label;
			item.append(labelSpan);

			if (option.secondaryText) {
				const secondarySpan = document.createElement("span");
				secondarySpan.className = "dropdown__option-secondary";
				secondarySpan.textContent = option.secondaryText;
				item.append(secondarySpan);
			}

			item.addEventListener("click", (e) => {
				e.stopPropagation();
				select(option.value);
			});

			panel.append(item);
		}
	}

	trigger.addEventListener("click", (e) => {
		e.stopPropagation();
		toggle();
	});

	trigger.addEventListener("keydown", (e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			if (isOpen && focusedIndex >= 0) {
				select(options[focusedIndex].value);
			} else {
				toggle();
			}
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			if (!isOpen) {
				open();
			} else {
				focusedIndex = Math.min(focusedIndex + 1, options.length - 1);
				applyFocus(focusedIndex);
			}
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			if (isOpen) {
				focusedIndex = Math.max(focusedIndex - 1, 0);
				applyFocus(focusedIndex);
			}
		} else if (e.key === "Escape") {
			close();
		}
	});

	// Close when clicking outside
	const onDocumentClick = (): void => {
		if (isOpen) {
			close();
		}
	};
	document.addEventListener("click", onDocumentClick);

	return {
		container,
		setOptions(newOptions: DropdownOption[], selectedValue: string): void {
			options = newOptions;
			currentValue = selectedValue;
			const selectedOption = options.find((o) => o.value === selectedValue);
			valueEl.textContent = selectedOption?.label ?? selectedValue;
			renderOptions();
		},
		getValue(): string {
			return currentValue;
		},
		destroy(): void {
			document.removeEventListener("click", onDocumentClick);
			container.remove();
		}
	};
}
