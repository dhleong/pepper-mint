export interface IClock {
    now(): Date;
}

export class Clock implements IClock {
    public now(): Date {
        return new Date();
    }
}
