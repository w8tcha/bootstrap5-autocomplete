import { Item } from "../interfaces/Item";


export type SourceCallback = (value: string, callback: (items: Item[]) => void) => void;
