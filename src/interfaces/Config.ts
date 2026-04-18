import { ErrorCallback } from "../callbacks/ErrorCallback";
import { FetchCallback } from "../callbacks/FetchCallback";
import { ItemCallback } from "../callbacks/ItemCallback";
import { RenderCallback } from "../callbacks/RenderCallback";
import { ServerCallback } from "../callbacks/ServerCallback";
import { SourceCallback } from "../callbacks/SourceCallback";
import { ValueCallback } from "../callbacks/ValueCallback";
import { Item } from "./Item";
import { ServerParams } from "./ServerParams";


export interface Config {
    /** Show all suggestions even if they don't match */
    showAllSuggestions: boolean;
    /** Number of chars required to show suggestions */
    suggestionsThreshold: number;
    /** Maximum number of items to display */
    maximumItems: number;
    /** Always select the first item */
    autoselectFirst: boolean;
    /** Ignore enter if no items are selected (play nicely with autoselectFirst=0) */
    ignoreEnter: boolean;
    /** Tab will trigger selection if active */
    tabSelect: boolean;
    /** Update input value on selection (doesn't play nice with autoselectFirst) */
    updateOnSelect: boolean;
    /** Highlight matched part of the label */
    highlightTyped: boolean;
    /** Class added to the mark label */
    highlightClass: string;
    /** Match the width on the input field */
    fullWidth: boolean;
    /** Use fixed positioning (solve overflow issues) */
    fixed: boolean;
    /** Fuzzy search */
    fuzzy: boolean;
    /** Must start with the string. Defaults to false (it matches any position). */
    startsWith: boolean;
    /** Show fill in icon */
    fillIn: boolean;
    /** Additional measures to prevent browser autocomplete */
    preventBrowserAutocomplete: boolean;
    /** Applied to the dropdown item. Accepts space separated classes. */
    itemClass: string;
    /** By default: ["bg-primary", "text-white"] */
    activeClasses: string[];
    /** Key for the label */
    labelField: string;
    /** Key for the value */
    valueField: string;
    /** Key for the search */
    searchFields: string[];
    /** Key for the query parameter for server */
    queryParam: string;
    /** An array of label/value objects or an object with key/values */
    items: Item[] | Record<string, string>;
    /** A function that provides the list of items */
    source: SourceCallback | null;
    /** Create a hidden input which stores the valueField */
    hiddenInput: boolean;
    /** Populate the initial hidden value. Mostly useful with liveServer. */
    hiddenValue: string;
    /** Selector that will clear the input on click. */
    clearControl: string;
    /** The id of the source datalist */
    datalist: string;
    /** Endpoint for data provider */
    server: string;
    /** HTTP request method for data provider, default is GET */
    serverMethod: string;
    /** Parameters to pass along to the server. */
    serverParams: ServerParams;
    /** By default: data */
    serverDataKey: string;
    /** Any other fetch options */
    fetchOptions: RequestInit;
    /** Should the endpoint be called each time on input */
    liveServer: boolean;
    /** Prevent caching by appending a timestamp */
    noCache: boolean;
    /** Debounce time for live server */
    debounceTime: number;
    /** Display a no suggestions found message. Leave empty to disable */
    notFoundMessage: string;
    /** Callback function that returns the label */
    onRenderItem: RenderCallback;
    /** Callback function to call on selection */
    onSelectItem: ItemCallback;
    /** Callback function to call on clear */
    onClearItem: ValueCallback;
    /** Callback function to process server response. Must return a Promise */
    onServerResponse: ServerCallback;
    /** Callback function to process server errors */
    onServerError: ErrorCallback;
    /** Callback function to call on change-event. Returns currently selected item if any */
    onChange: ItemCallback;
    /** Callback function before fetch */
    onBeforeFetch: FetchCallback;
    /** Callback function after fetch */
    onAfterFetch: FetchCallback;
}
