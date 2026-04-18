import Autocomplete from "./autocomplete";
import { Config } from "./interfaces/Config";
import { Item } from "./interfaces/Item";

// #endregion
// #region constants
export const DEFAULTS: Config = {
    showAllSuggestions: false,
    suggestionsThreshold: 1,
    maximumItems: 0,
    autoselectFirst: true,
    ignoreEnter: false,
    tabSelect: false,
    updateOnSelect: false,
    highlightTyped: false,
    highlightClass: "",
    fullWidth: false,
    fixed: false,
    fuzzy: false,
    startsWith: false,
    fillIn: false,
    preventBrowserAutocomplete: false,
    itemClass: "",
    activeClasses: ["bg-primary", "text-white"],
    labelField: "label",
    valueField: "value",
    searchFields: ["label"],
    queryParam: "query",
    items: [],
    source: null,
    hiddenInput: false,
    hiddenValue: "",
    clearControl: "",
    datalist: "",
    server: "",
    serverMethod: "GET",
    serverParams: {},
    serverDataKey: "data",
    fetchOptions: {},
    liveServer: false,
    noCache: true,
    debounceTime: 300,
    notFoundMessage: "",
    onRenderItem: (item: Item, label: string, inst: Autocomplete): string => label,
    onSelectItem: (item: Item | string, inst: Autocomplete): void => { },
    onClearItem: (value: string, inst: Autocomplete): void => { },
    onServerResponse: (response: Response, inst: Autocomplete): Promise<unknown> => response.json(),
    onServerError: (e: Error, signal: AbortSignal, inst: Autocomplete): void => {
        if (e.name === "AbortError" || signal.aborted) return;
        console.error(e);
    },
    onChange: (item: Item | string, inst: Autocomplete): void => { },
    onBeforeFetch: (inst: Autocomplete): void => { },
    onAfterFetch: (inst: Autocomplete): void => { },
};
