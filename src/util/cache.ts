export class Cache {
    private readonly cache: {[key: string]: any} = {};

    public async as<T>(name: string, block: () => Promise<T>) {
        const cached = this.cache[name];
        if (cached) return cached as T;

        // TODO probably, limit cache duration
        const result = await block();
        this.cache[name] = result;
        return result;
    }
}
