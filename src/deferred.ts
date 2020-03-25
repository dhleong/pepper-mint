import { IMintAuth } from "./model";

export class DeferredAuth implements IMintAuth {

    private realAuth: IMintAuth | undefined;

    public resolve(auth: IMintAuth) {
        this.realAuth = auth;
    }

    public get cookies() {
        const auth = this.realAuth;
        if (!auth) throw new Error("Deferred auth is not yet resolved");
        return auth.cookies;
    }

    public get token() {
        const auth = this.realAuth;
        if (!auth) throw new Error("Deferred auth is not yet resolved");
        return auth.token;
    }
}
