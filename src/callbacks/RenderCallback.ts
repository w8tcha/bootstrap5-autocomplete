import Autocomplete from "../autocomplete";
import { Item } from "../interfaces/Item";

// #region types

export type RenderCallback = (item: Item, label: string, inst: Autocomplete) => string;
