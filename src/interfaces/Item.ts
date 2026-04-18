
export interface Item {
    label: string;
    value: string;
    group?: string;
    items?: Item[];
    data?: Record<string, string>;
    [key: string]: unknown;
}
