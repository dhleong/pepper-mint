import { EventEmitter } from "events";

import { IMintAuth, INetService } from "./model";
import { IMintAccount } from "./model/account";
import { IMintCategory } from "./model/category";
import { IMintProvider, IMintProviderAccount } from "./model/provider";
import { IMintTag } from "./model/tag";
import { IMintTransaction, IMintTransactionQuery, INewTransaction, ITransactionEdit } from "./model/transaction";
import { Cache } from "./util/cache";
import { Clock, IClock } from "./util/clock";
import { stringifyDate } from "./util/date";

const INTUIT_API_KEY = "prdakyrespQBtEtvaclVBEgFGm7NQflbRaCHRhAy";
const INTUIT_URL_BASE = "mas/v1";

function accountIsActive(account: IMintProviderAccount) {
    return account.isActive;
}

export class PepperMint extends EventEmitter {

    private readonly cache = new Cache();

    // NOTE: this key might not be static; if that's the case,
    // we can load overview.event and pull it out of the embedded
    // javascript from a JSON object field `browserAuthAPIKey`
    private readonly intuitApiKey = INTUIT_API_KEY;

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

    public async getTransactions(
        query?: IMintTransactionQuery,
    ): Promise<IMintTransaction[]> {
        const args = query || {};
        const offset = args.offset || 0;
        let queryArray = args.query || [];
        if (!Array.isArray(queryArray)) {
            queryArray = [queryArray];
        }
        if (args.category && typeof args.category === "object") {
            args.category = args.category.id;
        }
        if (args.category) {
            queryArray.push(`category:"${args.category}"`);
        }

        let startDate: string | undefined;
        if (args.startDate) startDate = stringifyDate(args.startDate);

        let endDate: string | undefined;
        if (args.endDate) endDate = stringifyDate(args.endDate);

        return this.getJsonData({
            accountId: args.accountId,
            offset,
            comparableType: 8, // ?
            acctChanged: "T", // ?
            query: queryArray.join(","),
            queryNew: "",
            startDate,
            endDate,
            task: "transactions",
        });
    }

    /**
     * Create a new cash transaction; to be used to fake transaction
     * imports. It is not possible to create non-cash transactions
     * associated with a bank account.
     *
     * NB: There is currently very little arg validation,
     *  and the server seems to silently reject issues, too :(
     */
    public async createTransaction(args: INewTransaction) {
        const form: any = {
            amount: args.amount,
            cashTxnType: 'on',
            date: stringifyDate(args.date),
            isInvestment: args.isInvestment,
            merchant: args.merchant,
            mtAccount: args.accountId,
            mtCashSplitPref: 2, // ?
            mtCheckNo: '',
            mtIsExpense: args.isExpense,
            mtType: 'cash',
            note: args.note,
            task: 'txnadd',
            txnId: ':0', // might be required

            token: this.auth.token,
        };

        if (args.category) {
            form.catId = args.category.id;
            form.category = args.category.name;
        }

        // set any tags requested
        if (Array.isArray(args.tags)) {
            for (const tagId of args.tags) {
                form["tag" + tagId] = 2; // what? 2?!
            }
        }

        return this.net.postForm("updateTransaction.xevent", form);
    }

    /**
     * Delete a transaction by its id
     */
    public deleteTransaction(transactionId: number) {
        return this.net.postForm('updateTransaction.xevent', {
            task: "delete",
            txnId: transactionId,
            token: this.auth.token,
        });
    }

    /**
     * Note that the format of the category information is different from
     * that for createTransaction. This is to make it simple to just use a
     * modified result from `getTransactions()`
     */
    public editTransaction(edit: ITransactionEdit) {
        const form = {
            amount: "",
            category: edit.category,
            catId: edit.categoryId,
            categoryTypeFilter: "null",
            date: stringifyDate(edit.date),
            merchant: edit.merchant,
            txnId: edit.id,

            task: "txnedit",
            token: this.auth.token,
        };

        // TODO support tags, adding notes?
        // That form is much more complicated...

        return this.net.postForm("updateTransaction.xevent", form);
    }

    /**
     * DEPRECATED: The name of this method is misleading, but is kept for
     * backwards compatibility. You should prefer to use
     * [getRefreshingProviderIds] instead.
     */
    public async getRefreshingAccountIds() {
        return this.getRefreshingProviderIds();
    }
    /**
     * Check which providers are still refreshing (if any). A provider
     * is, for example, the bank at which your account lives.
     */
    public async getRefreshingProviderIds(): Promise<string[]> {
        const response = await this.getIntuitJson("/refreshJob");
        return response.refreshingCpProviderIds;
    }

    /**
     * Convenience to map the result of getRefreshingAccountIds() to
     * the actual Accounts (IE: similar to that returned from .accounts()).
     *
     * NOTE: The actual Account instances will be those from providers(),
     *  and so some fields will be slightly different than those from
     *  .accounts().
     */
    public async getRefreshingAccounts(): Promise<IMintProviderAccount[]> {
        const [providers, refreshingProviderIds] = await Promise.all([
            this.providers(),
            this.getRefreshingProviderIds(),
        ]);

        const providerById = providers.reduce((m, provider) => {
            m[provider.cpProviderId] = provider;
            return m;
        }, {} as {[key: string]: IMintProvider});

        // no indication of actually which accounts are specifically being
        // refreshed, so we just assume all for a provider
        return refreshingProviderIds.map(id => providerById[id])
        .filter(provider => provider) // unknown provider...?
        .reduce((result, provider) => {
            return result.concat(provider.providerAccounts);
        }, [] as IMintProviderAccount[])
        .filter(accountIsActive);
    }

    /**
     * Get a list of the financial data providers available to this
     * Mint user.
     */
    public async getProviders(): Promise<IMintProvider[]> {
        const response = await this.getIntuitJson("/providers");
        return response.providers;
    }
    public async providers() {
        return this.cache.as("providers", () => {
            return this.getProviders();
        });
    }

    private async getIntuitJson(urlPart: string) {
        return this.net.getJson(INTUIT_URL_BASE + urlPart, undefined, {
            Authorization: 'Intuit_APIKey intuit_apikey=' + this.intuitApiKey + ', intuit_apikey_version=1.0',
        });
    };

    private async getJsonData<T>(args: string | {[key: string]: any}): Promise<T> {
        if (typeof args === "string") {
            args = { task: args };
        }
        (args as any).rnd = this.clock.now();

        const json = await this.net.getJson("getJsonData.xevent", args);
        return json.set[0].data as T;
    }
}
