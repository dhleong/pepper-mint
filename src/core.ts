import { EventEmitter } from "events";

import { IMintAuth, INetService } from "./model";

export class PepperMint extends EventEmitter {
    constructor(
        readonly net: INetService,
        readonly auth: IMintAuth,
    ) {
        super();
    }
}
