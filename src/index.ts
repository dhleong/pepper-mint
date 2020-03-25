import { EventEmitter } from "events";

import { MintAuth } from "./auth";
import { PepperMint } from "./core";
import { DeferredAuth } from "./deferred";
import { IMintCredentials, INetService } from "./model";
import * as ModelTypes from "./model";
import { RequestNetService } from "./net";

interface IPepperMintPromise extends Promise<PepperMint> {
    mint: EventEmitter;
}

function prepare(
    email: string,
    password: string,
    token?: any,
    cookies?: any,
): IPepperMintPromise {
    const net = new RequestNetService();
    const auth = new MintAuth(net);
    const deferredAuth = new DeferredAuth();
    const mint = new PepperMint(net, deferredAuth);
    const promise = authorize(mint, deferredAuth, net, auth, {
        email,
        password,
        extras: {
            token,
            cookies,
        },
    }) as IPepperMintPromise;
    promise.mint = mint;
    return promise;
}

async function authorize(
    mint: PepperMint,
    deferredAuth: DeferredAuth,
    net: INetService,
    auth: MintAuth,
    creds: IMintCredentials,
) {
    const authData = await auth.authorize(mint, creds);
    deferredAuth.resolve(authData);
    return mint;
}

export = prepare;

/* eslint-disable */
namespace prepare {
    // manually re-export model types in a namespace matching the default export
    // for convenient consumption from typescript, since we sadly can't use the
    // `export * from` syntax within the namespace

    export type ICredentialExtras = ModelTypes.ICredentialExtras;
    export type IMintCredentials = ModelTypes.IMintCredentials;
    export type ICookie = ModelTypes.ICookie;
    export type IMintAuth = ModelTypes.IMintAuth;
    export type IMintAuthorizer = ModelTypes.IMintAuthorizer;
    export type IJsonForm = ModelTypes.IJsonForm;
    export type INetService = ModelTypes.INetService;

    export type IMintAccount = ModelTypes.IMintAccount;

    export type IBudgetRangeQuery = ModelTypes.IBudgetRangeQuery;
    export type IBudgetLastNMonthsQuery = ModelTypes.IBudgetLastNMonthsQuery;
    export type IBudgetQuery = ModelTypes.IBudgetQuery;
    export type IMintBudgetItem = ModelTypes.IMintBudgetItem;
    export type IMintBudgetData = ModelTypes.IMintBudgetData;
    export type IMintBudget = ModelTypes.IMintBudget;
    export type IMintCategory = ModelTypes.IMintCategory;

    export type IMintProviderMetadata = ModelTypes.IMintProviderMetadata;
    export type IMintProviderAccountBase = ModelTypes.IMintProviderAccountBase;
    export type IMintProviderBankAccount = ModelTypes.IMintProviderBankAccount;
    export type IMintProviderCreditAccount = ModelTypes.IMintProviderCreditAccount;
    export type IMintProviderInvestmentAccount = ModelTypes.IMintProviderInvestmentAccount;
    export type IMintProviderLoanAccount = ModelTypes.IMintProviderLoanAccount;
    export type IMintProviderAccount = ModelTypes.IMintProviderAccount;
    export type IMintProvider = ModelTypes.IMintProvider;

    export type IMintTag = ModelTypes.IMintTag;

    export type IMintTransactionQuery = ModelTypes.IMintTransactionQuery;
    export type IMintTransaction = ModelTypes.IMintTransaction;
    export type INewTransaction = ModelTypes.INewTransaction; 
    export type ITransactionEdit = ModelTypes.ITransactionEdit;
}
