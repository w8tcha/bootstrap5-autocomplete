/**
 * Bootstrap 5 autocomplete
 * https://github.com/lekoala/bootstrap5-autocomplete
 * @license MIT
 */

import { Config } from "./interfaces/Config";
import { DEFAULTS } from "./DEFAULTS";
import { Item } from "./interfaces/Item";

const LOADING_CLASS = "is-loading";
const ACTIVE_CLASS = "is-active";
const SHOW_CLASS = "show";
const NEXT = "next";
const PREV = "prev";

const INSTANCE_MAP = new WeakMap<HTMLInputElement, Autocomplete>();
let counter = 0;
let activeCounter = 0;

// #endregion

// #region functions

function debounce<T extends (...args: unknown[]) => void>(func: T, timeout = 300): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func(...args);
    }, timeout);
  };
}

function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalize(str: string | number): string {
  if (!str) return "";
  return removeDiacritics(str.toString()).toLowerCase();
}

function fuzzyMatch(str: string, lookup: string): boolean {
  if (str.indexOf(lookup) >= 0) return true;
  let pos = 0;
  for (let i = 0; i < lookup.length; i++) {
    const c = lookup[i];
    if (c === " ") continue;
    pos = str.indexOf(c, pos) + 1;
    if (pos <= 0) return false;
  }
  return true;
}

function insertAfter(el: HTMLElement, newEl: HTMLElement): HTMLElement {
  return el.parentNode!.insertBefore(newEl, el.nextSibling);
}

function decodeHtml(html: string): string {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}

function setAttrs(el: HTMLElement, attributes: Record<string, string>): void {
  for (const [k, v] of Object.entries(attributes)) {
    el.setAttribute(k, v);
  }
}

function zwijit(el: HTMLElement): void {
  el.ariaLabel = el.innerText;
  el.innerHTML = el.innerText
    .split("")
    .map((char) => char + "&zwj;")
    .join("");
}

function nested(str: string, obj: unknown = window): unknown {
  return str.split(".").reduce((r: unknown, p: string) => (r as Record<string, unknown>)[p], obj);
}

// #endregion

export default class Autocomplete {
  private _searchInput!: HTMLInputElement;
  private _config!: Config;
  private _isMouse: boolean | undefined;
  private _preventInput: boolean | undefined;
  private _keyboardNavigation: boolean | undefined;
  private _searchFunc: (() => void | undefined) | undefined;
  private _hiddenInput!: HTMLInputElement | null;
  private _dropElement!: HTMLUListElement;
  private _items!: Item[];
  private _abortController: AbortController | null | undefined;
  private _timer: number | null | undefined;

  constructor(el: HTMLInputElement, config: Partial<Config> = {}) {
    if (!(el instanceof HTMLElement)) {
      console.error("Invalid element", el);
      return;
    }
    INSTANCE_MAP.set(el, this);
    counter++;
    activeCounter++;
    this._searchInput = el;

    this._configure(config);

    this._isMouse = false;
    this._preventInput = false;
    this._keyboardNavigation = false;
    this._abortController = null;
    this._timer = null;
    this._hiddenInput = null;
    this._items = [];

    this._searchFunc = debounce(() => {
      this._loadFromServer(true);
    }, this._config!.debounceTime);

    this._configureSearchInput();
    this._configureDropElement();

    if (this._config!.fixed) {
      document.addEventListener("scroll", this, true);
      window.addEventListener("resize", this);
    }

    const clearControl = this._getClearControl();
    if (clearControl) {
      clearControl.addEventListener("click", this);
    }

    (["focus", "change", "blur", "input", "beforeinput", "keydown"] as const).forEach((type) => {
      this._searchInput.addEventListener(type, this);
    });
    (["mousemove", "mouseenter", "mouseleave"] as const).forEach((type) => {
      this._dropElement.addEventListener(type, this);
    });

    this._fetchData();
  }

  // #region Core

  static init(selector = "input.autocomplete", config: Partial<Config> = {}): void {
    const nodes = document.querySelectorAll<HTMLInputElement>(selector);
    nodes.forEach((el) => {
      this.getOrCreateInstance(el, config);
    });
  }

  static getInstance(el: HTMLInputElement): Autocomplete | null {
    return INSTANCE_MAP.has(el) ? INSTANCE_MAP.get(el)! : null;
  }

  static getOrCreateInstance(el: HTMLInputElement, config: Partial<Config> = {}): Autocomplete {
    return this.getInstance(el) || new this(el, config);
  }

  dispose(): void {
    activeCounter--;

    (["focus", "change", "blur", "input", "beforeinput", "keydown"] as const).forEach((type) => {
      this._searchInput.removeEventListener(type, this);
    });
    (["mousemove", "mouseenter", "mouseleave"] as const).forEach((type) => {
      this._dropElement.removeEventListener(type, this);
    });

    const clearControl = this._getClearControl();
    if (clearControl) {
      clearControl.removeEventListener("click", this);
    }

    if (this._config.fixed && activeCounter <= 0) {
      document.removeEventListener("scroll", this, true);
      window.removeEventListener("resize", this);
    }

    this._dropElement.parentElement?.removeChild(this._dropElement);
    INSTANCE_MAP.delete(this._searchInput);
  }

  private _getClearControl(): Element | null {
    if (this._config.clearControl) {
      return document.querySelector(this._config.clearControl);
    }
    return null;
  }

  handleEvent = (event: Event): void => {
    const debounced = ["scroll", "resize"];
    if (debounced.includes(event.type)) {
      if (this._timer) window.cancelAnimationFrame(this._timer);
      this._timer = window.requestAnimationFrame(() => {
        (this as unknown as Record<string, (e: Event) => void>)[`on${event.type}`](event);
      });
    } else {
      (this as unknown as Record<string, (e: Event) => void>)[`on${event.type}`](event);
    }
  };

  private _configure(config: Partial<Config> = {}): void {
    this._config = Object.assign({}, DEFAULTS);

    const o: Record<string, unknown> = { ...config, ...this._searchInput.dataset };

    const parseBool = (value: unknown): boolean =>
      ["true", "false", "1", "0", true, false].includes(value as string | boolean) &&
      !!JSON.parse(value as string);

    for (const [key, defaultValue] of Object.entries(DEFAULTS)) {
      if (o[key] === undefined) continue;
      const value = o[key];

      switch (typeof defaultValue) {
        case "number":
          (this._config as unknown as Record<string, unknown>)[key] = parseInt(value as string);
          break;
        case "boolean":
          (this._config as unknown as Record<string, unknown>)[key] = parseBool(value);
          break;
        case "string":
          (this._config as unknown as Record<string, unknown>)[key] = (value as string | number).toString();
          break;
        case "object":
          if (Array.isArray(defaultValue)) {
            if (typeof value === "string") {
              const separator = value.includes("|") ? "|" : ",";
              (this._config as unknown as Record<string, unknown>)[key] = value.split(separator);
            } else {
              (this._config as unknown as Record<string, unknown>)[key] = value;
            }
          } else {
            (this._config as unknown as Record<string, unknown>)[key] =
              typeof value === "string" ? JSON.parse(value) : value;
          }
          break;
        case "function":
          (this._config as unknown as Record<string, unknown>)[key] =
            typeof value === "string" ? (window as unknown as Record<string, unknown>)[value] : value;
          break;
        default:
          (this._config as unknown as Record<string, unknown>)[key] = value;
      }
    }
  }

  // #endregion

  // #region Html

  private _configureSearchInput(): void {
    this._searchInput.autocomplete = "off";
    this._searchInput.spellcheck = false;
    setAttrs(this._searchInput, {
      "aria-autocomplete": "list",
      "aria-haspopup": "menu",
      "aria-expanded": "false",
      role: "combobox",
    });

    if (this._searchInput.id && this._config.preventBrowserAutocomplete) {
      const label = document.querySelector<HTMLElement>(`[for="${this._searchInput.id}"]`);
      if (label) zwijit(label);
    }

    this._hiddenInput = null;
    if (this._config.hiddenInput) {
      this._hiddenInput = document.createElement("input");
      this._hiddenInput.type = "hidden";
      this._hiddenInput.value = this._config.hiddenValue;
      this._hiddenInput.name = this._searchInput.name;
      this._searchInput.name = "_" + this._searchInput.name;
      insertAfter(this._searchInput, this._hiddenInput);
    }
  }

  private _configureDropElement(): void {
    this._dropElement = document.createElement("ul");
    this._dropElement.id = "ac-menu-" + counter;
    this._dropElement.classList.add("dropdown-menu", "autocomplete-menu", "p-0");
    this._dropElement.style.maxHeight = "280px";
    if (!this._config.fullWidth) {
      this._dropElement.style.maxWidth = "360px";
    }
    if (this._config.fixed) {
      this._dropElement.style.position = "fixed";
    }
    this._dropElement.style.overflowY = "auto";
    this._dropElement.style.overscrollBehavior = "contain";
    this._dropElement.style.textAlign = "unset";

    insertAfter(this._searchInput, this._dropElement);
    this._searchInput.setAttribute("aria-controls", this._dropElement.id);
  }

  // #endregion

  // #region Events

  onclick(e: MouseEvent): void {
    if (e.target instanceof Element && e.target.matches(this._config.clearControl)) {
      this.clear();
    }
  }

  onbeforeinput(e: InputEvent): void {
    if (this._preventInput) return;
    if (this._hiddenInput && this._hiddenInput.value) {
      this._config.onClearItem(this._searchInput.value, this);
      this._hiddenInput.value = "";
    }
  }

  oninput(e: InputEvent): void {
    if (this._preventInput) return;
    this.showOrSearch();
  }

  onchange(e: Event): void {
    const search = this._searchInput.value;
    const item = this._items.find((item) => item.label === search);
    this._config.onChange(item ?? search, this);
  }

  onblur(e: FocusEvent): void {
    const related = e.relatedTarget;
    if (
      this._isMouse &&
      related instanceof HTMLElement &&
      (related.classList.contains("modal") || related.classList.contains("autocomplete-menu"))
    ) {
      this._searchInput.focus();
      return;
    }
    setTimeout(() => {
      this.hideSuggestions();
    }, 100);
  }

  onfocus(e: FocusEvent): void {
    this.showOrSearch();
  }

  onkeydown(e: KeyboardEvent): void {
    const key = e.keyCode || e.key;
    switch (key) {
      case 13:
      case "Enter":
        if (this.isDropdownVisible()) {
          const selection = this.getSelection();
          if (selection) selection.click();
          if (selection || !this._config.ignoreEnter) e.preventDefault();
        }
        break;
      case 9:
      case "Tab":
        if (this.isDropdownVisible() && this._config.tabSelect) {
          const selection = this.getSelection();
          if (selection) {
            selection.click();
            e.preventDefault();
          }
        }
        break;
      case 38:
      case "ArrowUp":
        e.preventDefault();
        this._keyboardNavigation = true;
        this._moveSelection(PREV);
        break;
      case 40:
      case "ArrowDown":
        e.preventDefault();
        this._keyboardNavigation = true;
        if (this.isDropdownVisible()) {
          this._moveSelection(NEXT);
        } else {
          this.showOrSearch(false);
        }
        break;
      case 27:
      case "Escape":
        if (this.isDropdownVisible()) {
          this._searchInput.focus();
          this.hideSuggestions();
        }
        break;
    }
  }

  onmouseenter(e: MouseEvent): void {
    this._isMouse = true;
  }

  onmousemove(e: MouseEvent): void {
    this._isMouse = true;
    this._keyboardNavigation = false;
  }

  onmouseleave(e: MouseEvent): void {
    this._isMouse = false;
    this.removeSelection();
  }

  onscroll(e: Event): void {
    this._positionMenu();
  }

  onresize(e: Event): void {
    this._positionMenu();
  }

  // #endregion

  // #region Api

  getConfig(): Config;
  getConfig(k: keyof Config): Config[keyof Config];
  getConfig(k?: keyof Config): Config | Config[keyof Config] {
    if (k !== undefined) return this._config[k];
    return this._config;
  }

  setConfig<K extends keyof Config>(k: K, v: Config[K]): void {
    this._config[k] = v;
  }

  setData(src: Item[] | Record<string, string>): void {
    this._items = [];
    this._addItems(src);
  }

  enable(): void {
    this._searchInput.setAttribute("disabled", "");
  }

  disable(): void {
    this._searchInput.removeAttribute("disabled");
  }

  isDisabled(): boolean {
    return (
      this._searchInput.hasAttribute("disabled") ||
      this._searchInput.disabled ||
      this._searchInput.hasAttribute("readonly")
    );
  }

  isDropdownVisible(): boolean {
    return this._dropElement.classList.contains(SHOW_CLASS);
  }

  clear(): void {
    const v = this._searchInput.value;
    this._searchInput.value = "";
    if (this._hiddenInput) this._hiddenInput.value = "";
    this._config.onClearItem(v, this);
  }

  // #endregion

  // #region Selection management

  getSelection(): HTMLAnchorElement | null {
    return this._dropElement.querySelector<HTMLAnchorElement>("a." + ACTIVE_CLASS);
  }

  removeSelection(): void {
    const selection = this.getSelection();
    if (selection) selection.classList.remove(...this._activeClasses());
  }

  private _activeClasses(): string[] {
    return [...this._config.activeClasses, ACTIVE_CLASS];
  }

  private _isItemEnabled(li: HTMLElement): boolean {
    if (li.style.display === "none") return false;
    const fc = li.firstElementChild;
    return fc?.tagName === "A" && !fc.classList.contains("disabled");
  }

  private _moveSelection(dir: string = NEXT, sel: HTMLElement | null = null): HTMLElement | null {
    const active = this.getSelection();

    if (!active) {
      if (dir === PREV) return sel;
      if (!sel) {
        sel = this._dropElement.firstChild as HTMLElement | null;
        while (sel && !this._isItemEnabled(sel)) {
          sel = sel.nextSibling as HTMLElement | null;
        }
      }
    } else {
      const sibling = dir === NEXT ? "nextSibling" : "previousSibling";
      sel = active.parentNode as HTMLElement | null;
      do {
        sel = (sel as Node)[sibling as "nextSibling" | "previousSibling"] as HTMLElement | null;
      } while (sel && !this._isItemEnabled(sel as HTMLElement));

      if (sel) {
        active.classList.remove(...this._activeClasses());
        if (dir === PREV) {
          sel.parentNode &&
            ((sel.parentNode as HTMLElement).scrollTop =
              sel.offsetTop - (sel.parentNode as HTMLElement).offsetTop);
        } else {
          if (sel.offsetTop > (sel.parentNode as HTMLElement).offsetHeight - sel.offsetHeight) {
            (sel.parentNode as HTMLElement).scrollTop += sel.offsetHeight;
          }
        }
      } else if (active) {
        sel = active.parentElement;
      }
    }

    if (sel) {
      const a = sel.querySelector<HTMLAnchorElement>("a")!;
      a.classList.add(...this._activeClasses());
      this._searchInput.setAttribute("aria-activedescendant", a.id);
      if (this._config.updateOnSelect) {
        this._searchInput.value = a.dataset.label ?? "";
      }
    } else {
      this._searchInput.setAttribute("aria-activedescendant", "");
    }
    return sel;
  }

  // #endregion

  // #region Implementation

  private _shouldShow(): boolean {
    if (this.isDisabled()) return false;
    return this._searchInput.value.length >= this._config.suggestionsThreshold;
  }

  showOrSearch(check = true): void {
    if (check && !this._shouldShow()) {
      this.hideSuggestions();
      return;
    }
    if (this._config.liveServer) {
      if (typeof this._searchFunc !== 'undefined') {
        this._searchFunc();
      }
    } else if (this._config.source) {
      this._config.source(this._searchInput.value, (items: Item[]) => {
        this.setData(items);
        this._showSuggestions();
      });
    } else {
      this._showSuggestions();
    }
  }

  private _createGroup(name: string): HTMLLIElement {
    const newChild = this._createLi();
    const newChildSpan = document.createElement("span");
    newChild.append(newChildSpan);
    newChildSpan.classList.add("dropdown-header", "text-truncate");
    newChildSpan.innerHTML = name;
    return newChild;
  }

  private _createItem(lookup: string, item: Item): HTMLLIElement {
    let label = item.label;

    if (this._config.highlightTyped) {
      const idx = normalize(label).indexOf(lookup);
      if (idx !== -1) {
        label =
          label.substring(0, idx) +
          `<mark class="${this._config.highlightClass}">${label.substring(idx, idx + lookup.length)}</mark>` +
          label.substring(idx + lookup.length, label.length);
      }
    }

    label = this._config.onRenderItem(item, label, this);

    const newChild = this._createLi();
    const newChildLink = document.createElement("a");
    newChild.append(newChildLink);
    newChildLink.id = this._dropElement.id + "-" + this._dropElement.children.length;
    newChildLink.classList.add("dropdown-item", "text-truncate");
    if (this._config.itemClass) {
      newChildLink.classList.add(...this._config.itemClass.split(" "));
    }
    newChildLink.setAttribute("data-value", item.value);
    newChildLink.setAttribute("data-label", item.label);
    newChildLink.setAttribute("tabindex", "-1");
    newChildLink.setAttribute("role", "menuitem");
    newChildLink.setAttribute("href", "#");
    newChildLink.innerHTML = label;

    if (item.data) {
      for (const [key, value] of Object.entries(item.data)) {
        newChildLink.dataset[key] = value;
      }
    }

    if (this._config.fillIn) {
      const fillIn = document.createElement("button");
      fillIn.type = "button";
      fillIn.classList.add("btn", "btn-link", "border-0");
      fillIn.innerHTML = `<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M2 2.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1H3.707l10.147 10.146a.5.5 0 0 1-.708.708L3 3.707V8.5a.5.5 0 0 1-1 0z"/>
      </svg>`;
      newChild.append(fillIn);
      newChild.classList.add("d-flex", "justify-content-between");
      fillIn.addEventListener("click", () => {
        this._searchInput.value = item.label;
        this._searchInput.focus();
      });
    }

    newChildLink.addEventListener("mouseenter", () => {
      if (this._keyboardNavigation || !this._isMouse) return;
      this.removeSelection();
      const a = newChild.querySelector<HTMLAnchorElement>("a")!;
      a.classList.add(...this._activeClasses());
      this._searchInput.setAttribute("aria-activedescendant", a.id);
    });
    newChildLink.addEventListener("mousedown", (event: MouseEvent) => {
      event.preventDefault();
    });
    newChildLink.addEventListener("click", (event: MouseEvent) => {
      event.preventDefault();
      this._preventInput = true;
      this._searchInput.value = decodeHtml(item.label);
      if (this._hiddenInput) this._hiddenInput.value = item.value;
      this._config.onSelectItem(item, this);
      this.hideSuggestions();
      this._preventInput = false;
    });

    return newChild;
  }

  private _getActiveElement(root: Document | ShadowRoot = document): Element | null {
    const activeEl = root.activeElement;
    if (!activeEl) return null;
    if (activeEl.shadowRoot) return this._getActiveElement(activeEl.shadowRoot);
    return activeEl;
  }

  private _showSuggestions(): void {
    if (this._getActiveElement() !== this._searchInput) return;

    const lookup = normalize(this._searchInput.value);
    this._dropElement.innerHTML = "";

    let count = 0;
    let firstItem: HTMLElement | null = null;
    const groups: string[] = [];

    for (const entry of this._items) {
      const showAllSuggestions = this._config.showAllSuggestions || lookup.length === 0;
      let isMatched = lookup.length === 0 && this._config.suggestionsThreshold === 0;

      if (lookup.length > 0) {
        this._config.searchFields.forEach((sf) => {
          const text = normalize(entry[sf] as string);
          let found = false;
          if (this._config.fuzzy) {
            found = fuzzyMatch(text, lookup);
          } else {
            const idx = text.indexOf(lookup);
            found = this._config.startsWith ? idx === 0 : idx >= 0;
          }
          if (found) isMatched = true;
        });
      }

      const selectFirst = isMatched || lookup.length === 0;
      if (showAllSuggestions || isMatched) {
        count++;

        if (entry.group && !groups.includes(entry.group)) {
          const newItem = this._createGroup(entry.group);
          this._dropElement.appendChild(newItem);
          groups.push(entry.group);
        }

        const newItem = this._createItem(lookup, entry);
        if (!firstItem && selectFirst) firstItem = newItem;
        this._dropElement.appendChild(newItem);

        if (this._config.maximumItems > 0 && count >= this._config.maximumItems) break;
      }
    }

    if (firstItem && this._config.autoselectFirst) {
      this.removeSelection();
      this._moveSelection(NEXT, firstItem);
    }

    if (count === 0) {
      if (this._config.notFoundMessage) {
        const newChild = this._createLi();
        newChild.innerHTML = `<span class="dropdown-item">${this._config.notFoundMessage}</span>`;
        this._dropElement.appendChild(newChild);
        this._showDropdown();
      } else {
        this.hideSuggestions();
      }
    } else {
      this._showDropdown();
    }
  }

  private _createLi(): HTMLLIElement {
    const newChild = document.createElement("li");
    newChild.setAttribute("role", "presentation");
    return newChild;
  }

  private _showDropdown(): void {
    this._dropElement.classList.add(SHOW_CLASS);
    this._dropElement.setAttribute("role", "menu");
    setAttrs(this._searchInput, { "aria-expanded": "true" });
    this._positionMenu();
  }

  toggleSuggestions(check = true): void {
    if (this._dropElement.classList.contains(SHOW_CLASS)) {
      this.hideSuggestions();
    } else {
      this.showOrSearch(check);
    }
  }

  hideSuggestions(): void {
    this._dropElement.classList.remove(SHOW_CLASS);
    setAttrs(this._searchInput, { "aria-expanded": "false" });
    this.removeSelection();
  }

  getInput(): HTMLInputElement {
    return this._searchInput;
  }

  getDropMenu(): HTMLUListElement {
    return this._dropElement;
  }

  getHiddenInput(): HTMLInputElement | null {
    return this._hiddenInput;
  }

  private _positionMenu(): void {
    const bounds = this._searchInput.getBoundingClientRect();
    const isRTL =
      this._searchInput.dir === "rtl" ||
      (this._searchInput.dir === "" && document.dir === "rtl");
    const fullWidth = this._config.fullWidth;
    const fixed = this._config.fixed;

    let left: number | null = null;
    let top: number | null = null;

    if (fixed) {
      left = bounds.x;
      top = bounds.y + bounds.height;
      if (isRTL && !fullWidth) {
        left -= this._dropElement.offsetWidth - bounds.width;
      }
    }

    this._dropElement.style.transform = "unset";

    if (fullWidth) {
      this._dropElement.style.width = this._searchInput.offsetWidth + "px";
    }
    if (left !== null) this._dropElement.style.left = left + "px";
    if (top !== null) this._dropElement.style.top = top + "px";

    const dropBounds = this._dropElement.getBoundingClientRect();
    const h = window.innerHeight;

    if (dropBounds.y + dropBounds.height > h) {
      const topOffset = fullWidth ? bounds.height + 4 : bounds.height;
      this._dropElement.style.transform = `translateY(calc(-100.1% - ${topOffset}px))`;
    }
  }

  private _fetchData(): void {
    this._items = [];
    this._addItems(this._config.items);

    const dl = this._config.datalist;
    if (dl) {
      const datalist = document.querySelector(`#${dl}`);
      if (datalist) {
        const items: Item[] = Array.from(datalist.children).map((o) => ({
          value: o.getAttribute("value") ?? o.innerHTML.toLowerCase(),
          label: o.innerHTML,
        }));
        this._addItems(items);
      } else {
        console.error(`Datalist not found ${dl}`);
      }
    }

    this._setHiddenVal();

    if (this._config.server && !this._config.liveServer) {
      this._loadFromServer();
    }
  }

  private _setHiddenVal(): void {
    if (this._config.hiddenInput && !this._config.hiddenValue) {
      for (const entry of this._items) {
        if (entry.label == this._searchInput.value && this._hiddenInput) {
          this._hiddenInput.value = entry.value;
        }
      }
    }
  }

  private _normalizeData(src: Item[] | Record<string, string>): Item[] {
    if (Array.isArray(src)) return src;
    return Object.entries(src).map(([value, label]) => ({ value, label }));
  }

  private _addItems(src: Item[] | Record<string, string>): void {
    const normalized = this._normalizeData(src);
    for (const entry of normalized) {
      if (entry.group && entry.items) {
        entry.items.forEach((e) => (e.group = entry.group));
        this._addItems(entry.items);
        continue;
      }

      const label = typeof entry === "string" ? entry : entry.label;
      const item: Item = typeof entry !== "object" ? { label: entry, value: entry } : { ...entry };

      item.label = (entry[this._config.labelField] as string) ?? label;
      item.value = (entry[this._config.valueField] as string) ?? label;

      if (item.label) this._items.push(item);
    }
  }

  private _loadFromServer(show = false): void {
    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();

    this._config.onBeforeFetch(this);

    let extraParams: Record<string, unknown> = this._searchInput.dataset.serverParams
      ? JSON.parse(this._searchInput.dataset.serverParams)
      : {};
    if (typeof extraParams === "string") extraParams = JSON.parse(extraParams);

    const params: Record<string, unknown> = Object.assign({}, this._config.serverParams, extraParams);
    params[this._config.queryParam] = this._searchInput.value;
    if (this._config.noCache) params.t = Date.now();

    if (params.related) {
      const relatedItems: string[] = Array.isArray(params.related)
        ? (params.related as string[])
        : [params.related as string];

      relatedItems.forEach((related) => {
        const input = document.getElementById(related) as HTMLInputElement | null;
        if (input && "value" in input) {
          const inputName = input.getAttribute("name");
          if (inputName) params[inputName] = input.value;
        }
      });
    }

    const urlParams = new URLSearchParams(params as Record<string, string>);
    let url = this._config.server;
    const fetchOptions: RequestInit = Object.assign({}, this._config.fetchOptions, {
      method: this._config.serverMethod || "GET",
      signal: this._abortController.signal,
    });

    if (fetchOptions.method === "POST") {
      fetchOptions.body = urlParams;
    } else {
      url += url.indexOf("?") === -1 ? "?" : "&";
      url += urlParams.toString();
    }

    this._searchInput.classList.add(LOADING_CLASS);

    fetch(url, fetchOptions)
      .then((r) => this._config.onServerResponse(r, this))
      .then((suggestions) => {
        const data = (nested(this._config.serverDataKey, suggestions) ?? suggestions) as Item[];
        this.setData(data);
        this._setHiddenVal();
        this._abortController = null;
        if (show) this._showSuggestions();
      })
      .catch((e: Error) => {
        this._config.onServerError(e, this._abortController!.signal, this);
      })
      .finally(() => {
        this._searchInput.classList.remove(LOADING_CLASS);
        this._config.onAfterFetch(this);
      });
  }

  // #endregion
}