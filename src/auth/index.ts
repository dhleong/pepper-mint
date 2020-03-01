import { EventEmitter } from "events";

import { IMintAuthorizer, IMintCredentials, INetService } from "../model";

import { ChromedriverMintAuth } from "./chromedriver-auth";
import { LegacyMintAuth } from "./legacy-auth";

export class MintAuth implements IMintAuthorizer {

    private readonly strategies: IMintAuthorizer[];

    constructor(private readonly net: INetService) {
        this.strategies = [
            new LegacyMintAuth(net),
            new ChromedriverMintAuth(),
        ];
    }

    public async authorize(
        events: EventEmitter,
        credentials: IMintCredentials,
    ) {
        let lastError: Error | null = null;
        for (const strategy of this.strategies) {
            try {
                const auth = await strategy.authorize(events, credentials);
                if (auth) {
                    this.net.setAuth(auth);
                    return auth;
                }
            } catch (e) {
                // fall
                lastError = e;
            }
        }

        throw lastError || new Error("Failed to authorize");
    }
}
