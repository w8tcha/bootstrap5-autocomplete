import Autocomplete from "../autocomplete";


export type ServerCallback = (response: Response, inst: Autocomplete) => Promise<unknown>;
