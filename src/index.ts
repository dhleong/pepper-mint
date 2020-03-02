import { EventEmitter } from "events";

import { MintAuth } from "./auth";
import { PepperMint } from "./core";
import { IMintCredentials, INetService } from "./model";
import { RequestNetService } from "./net";

export * from "./model";
export * from "./model/account";
export * from "./model/budget";
export * from "./model/category";
export * from "./model/provider";
export * from "./model/tag";
export * from "./model/transaction";

export interface IPepperMintPromise extends Promise<PepperMint> {
    mint: EventEmitter;
}

export default function prepare(
    email: string,
    password: string,
    token?: any,
    cookies?: any,
): IPepperMintPromise {
    const net = new RequestNetService();
    const auth = new MintAuth(net);
    const events = new EventEmitter();
    const promise = authorize(events, net, auth, {
        email,
        password,
        extras: {
            token,
            cookies,
        },
    }) as IPepperMintPromise;
    promise.mint = events;
    return promise;
}

async function authorize(
    events: EventEmitter,
    net: INetService,
    auth: MintAuth,
    creds: IMintCredentials,
) {
    const authData = await auth.authorize(events, creds);
    return new PepperMint(net, authData);
}
