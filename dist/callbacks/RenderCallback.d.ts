import { default as Autocomplete } from '../autocomplete';
import { Item } from '../interfaces/Item';
export type RenderCallback = (item: Item, label: string, inst: Autocomplete) => string;
