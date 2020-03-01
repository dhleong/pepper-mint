export interface IMintCategory {
    children?: IMintCategory[];
    id: number;
    isL1: boolean;
    isStandard?: boolean;
    value: string;
}
