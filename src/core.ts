import { EventEmitter } from "events";

import { IMintAuth, INetService } from "./model";
import { IMintAccount } from "./model/account";
import { IMintCategory } from "./model/category";
import { IMintTag } from "./model/tag";
import { Cache } from "./util/cache";
import { Clock, IClock } from "./util/clock";

export class PepperMint extends EventEmitter {

    private readonly cache = new Cache();

    constructor(
        readonly net: INetService,
        readonly auth: IMintAuth,
        private readonly clock: IClock = new Clock(),
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

    public getCategories(): Promise<IMintCategory[]> {
        return this.getJsonData("categories");
    }
    public categories() {
        return this.cache.as("categories", () => {
            return this.getCategories();
        });
    }

    public getCategoryNameById(categories: IMintCategory[], id: number) {
        if (id === 0) return "Uncategorized";

        let found: string | null = null;
        categories.some(el => {
            if (el.id === id) {
                found = el.value;
                return true;
            }

            if (!el.children) return false;

            // there's only one level of depth, so
            // no need for recursion
            return el.children.some(kid => {
                if (kid.id === id) {
                    found = el.value + ": " + kid.value;
                    return true;
                }
            });
        });

        return found;
    };

    public async getTags(): Promise<IMintTag[]> {
        return this.getJsonData("tags");
    }

    private async getJsonData<T>(args: string | {[key: string]: any}): Promise<T> {
        if (typeof args === "string") {
            args = { task: args };
        }
        (args as any).rnd = this.clock.now();

        const json = await this.net.getJson("getJsonData.xevent", args);
        return json.set[0].data as T;
    }
}
