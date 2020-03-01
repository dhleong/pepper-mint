import { EventEmitter } from "events";

import { IMintAuth, INetService } from "./model";
import { IMintAccount } from "./model/account";
import { Cache } from "./util/cache";

export class PepperMint extends EventEmitter {

    private readonly cache = new Cache();

    constructor(
        readonly net: INetService,
        readonly auth: IMintAuth,
    ) {
        super();
    }

    public async getAccounts() {
        const result = await this.net.jsonForm({
            args: {
                types: [
                    "BANK",
                    "CREDIT",
                    "INVESTMENT",
                    "LOAN",
                    "MORTGAGE",
                    "OTHER_PROPERTY",
                    "REAL_ESTATE",
                    "VEHICLE",
                    "UNCLASSIFIED",
                ],
            },
            service: "MintAccountService",
            task: "getAccountsSorted",
        });
        return result as IMintAccount[];
    }
    public accounts() {
        return this.cache.as("accounts", () => {
            return this.getAccounts();
        });
    }
}
