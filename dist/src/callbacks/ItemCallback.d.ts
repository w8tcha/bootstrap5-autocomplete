import { default as Autocomplete } from '../autocomplete';
import { Item } from '../interfaces/Item';
export type ItemCallback = (item: Item | string, inst: Autocomplete) => void;
