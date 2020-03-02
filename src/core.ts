import { EventEmitter } from "events";

import { IMintAuth, INetService } from "./model";
import { IMintAccount } from "./model/account";
import { IBudgetQuery, IMintBudget } from "./model/budget";
import { IMintCategory } from "./model/category";
import { IMintProvider, IMintProviderAccount } from "./model/provider";
import { IMintTag } from "./model/tag";
import { IMintTransaction, IMintTransactionQuery, INewTransaction, ITransactionEdit } from "./model/transaction";
import { delayMillis } from "./util/async";
import { budgetForKey, formatBudgetQuery } from "./util/budget";
import { Cache } from "./util/cache";
import { Clock, IClock } from "./util/clock";
import { stringifyDate } from "./util/date";

const INTUIT_API_KEY = "prdakyrespQBtEtvaclVBEgFGm7NQflbRaCHRhAy";
const INTUIT_URL_BASE = "mas/v1";

const DEFAULT_REFRESH_AGE_MILLIS = 24 * 3600 * 1000; // 24 hours

function accountIsActive(account: IMintAccount | IMintProviderAccount) {
    return account.isActive;
}

export type DoneRefreshingPredicate = (ids: (IMintAccount | IMintProviderAccount)[]) => boolean;

/**
 * Coerce the "doneRefreshing" arg passed to various functions
 *  into the appropriate predicate
 */
function coerceDoneRefreshing(
    arg: number | DoneRefreshingPredicate | undefined,
): DoneRefreshingPredicate {
    if (!arg || typeof(arg) === 'number') {
        const maxRefreshingIds = arg || 0;
        return (accounts: any[]) => {
            return accounts.length <= maxRefreshingIds;
        };
    }

    return arg;
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

    public async getBudgets(): Promise<IMintBudget>;
    public async getBudgets(query: IBudgetQuery | Date): Promise<IMintBudget[]>;
    public async getBudgets(arg: IBudgetQuery | Date = new Date()) {
        const args = formatBudgetQuery(this.clock, arg);
        const [ categories, json ] = await Promise.all([
            this.categories(),
            this.net.getJson("getBudget.xevent", args),
        ]);

        const data = json.data;
        const incomeKeys = Object.keys(data.income).map(key => parseInt(key, 10));

        if (arg instanceof Date) {
            // single month
            const budgetKey = Math.min(...incomeKeys).toString();
            return budgetForKey(this, categories, data, budgetKey);
        }

        // list of months
        incomeKeys.sort();
        return incomeKeys.map(key =>
            budgetForKey(this, categories, data, key.toString())
        );
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

    /**
     * Refresh account FI Data
     */
    public async initiateAccountRefresh() {
        await this.postIntuitJson("/refreshJob", { allProviders: true });
    }

    /**
     * This is a convenience function on top of `refreshIfNeeded()`
     *  and `waitForRefresh()`. Options is an object with keys:
     *      - maxAgeMillis: see refreshIfNeeded()
     *      - doneRefreshing: see waitForRefresh()
     *      - maxRefreshingIds: Deprecated; see waitForRefresh()
     *
     * @return A Promise that resolves to this PepperMint instance
     *  when refreshing is done (or if it wasn't needed)
     */
    public async refreshAndWaitIfNeeded(
        options: {
            maxAgeMillis?: number;
            doneRefreshing?: DoneRefreshingPredicate;
            maxRefreshingIds?: number;
        } = {},
    ) {
        const waitArg = options.doneRefreshing || options.maxRefreshingIds;

        while (true) {
            const didRefresh = await this.refreshIfNeeded(
                options.maxAgeMillis,
                waitArg,
            );
            if (!didRefresh) {
                // done!
                return this;
            }
        }
    }

    /**
     * If any accounts haven't been updated in the last `maxAgeMillis`
     *  milliseconds (by default, 24 hours), this will initiate an account
     *  refresh.
     *
     * @param doneRefreshing As with `waitForRefresh()`.
     * @returns A promise that resolves to `true` once the refresh is
     *  initiated, else `false`. If a refresh *will be* initiated,
     *  a 'refreshing' event is emitted with a list of the accounts being
     *  refreshed.
     */
    public async refreshIfNeeded(
        maxAgeMillis: number = DEFAULT_REFRESH_AGE_MILLIS,
        doneRefreshing?: number | DoneRefreshingPredicate,
    ) {
        maxAgeMillis = maxAgeMillis || DEFAULT_REFRESH_AGE_MILLIS;
        doneRefreshing = coerceDoneRefreshing(doneRefreshing);

        const accounts = await this.accounts();

        const now = this.clock.now().getTime();
        const needRefreshing = accounts.filter(account => {
            if (account.isError || account.fiLoginStatus.startsWith("FAILED")) {
                // ignore accounts we *can't* refresh
                return false;
            }

            return now - account.lastUpdated > maxAgeMillis;
        }).filter(accountIsActive);

        if (doneRefreshing(needRefreshing)) {
            // no refresh needed!
            return false;
        } else {
            this.emit("refreshing", needRefreshing);
            await this.initiateAccountRefresh();
            return true;
        }
    }

    /**
     * Wait until an account refresh is completed. This will poll
     *  `getRefreshingAccount()` every few seconds, and emit a
     *  'refreshing' event with the status, then finally resolve
     *  to this PepperMint instance when done.
     *
     * @param doneRefreshing A predicate function that takes a list of accounts
     *  and returns True if refreshing is "done." If not provided,
     *  this defaults to checking for an empty list---that is, there are no
     *  more accounts being refreshed. For backwards compatibility, this
     *  may also be the max number of still-refreshing ids remaining to
     *  be considered "done." This is 0 by default, of course.
     */
    public async waitForRefresh(doneRefreshing?: number | DoneRefreshingPredicate) {
        doneRefreshing = coerceDoneRefreshing(doneRefreshing);

        while (true) {
            const refreshing = await this.getRefreshingAccounts();
            if (doneRefreshing(refreshing)) {
                // done!
                return this;
            }

            this.emit("refreshing", refreshing);

            await delayMillis(10000);
        }
    }

    private async getIntuitJson(urlPart: string) {
        return this.net.getJson(INTUIT_URL_BASE + urlPart, undefined, {
            Authorization: 'Intuit_APIKey intuit_apikey=' + this.intuitApiKey + ', intuit_apikey_version=1.0',
        });
    };

    private async postIntuitJson(urlPart: string, body: any) {
        return this.net.postJson(INTUIT_URL_BASE + urlPart, body, {
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
