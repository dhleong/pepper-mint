import { EventEmitter } from "events";

import { MintAuth } from "./auth";
import { PepperMint } from "./core";
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

export = prepare;

/* eslint-disable */
namespace prepare {
    export import types = ModelTypes;
}
