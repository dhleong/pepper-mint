import { EventEmitter } from "events";

import { CookieJar } from "request";

export interface ICredentialExtras {
    token?: string;
    cookies?: string | any[];
}

export interface IMintCredentials {
    email: string;
    password: string;
    extras?: ICredentialExtras;
}

export interface ICookie {
    name: string;
    value: string;
}

export interface IMintAuth {
    cookies: ICookie[];
    token: string;
}

export interface IMintAuthorizer {
    authorize(
        events: EventEmitter,
        credentials: IMintCredentials,
    ): Promise<IMintAuth>;
}

export interface IJsonForm {
    args?: {[key: string]: any};
    service: string;
    task: string;
}

export interface INetService {
    load(url: string): Promise<void>;
    getJson(
        url: string,
        qs?: {[key: string]: string},
        headers?: {[key: string]: string},
    ): Promise<any>;
    jsonForm(form: IJsonForm): Promise<any>;
    postForm(
        url: string,
        form: {[key: string]: string | number},
        headers?: {[key: string]: string},
    ): Promise<any>;
    postJson(
        url: string,
        json: any,
        headers?: {[key: string]: string},
    ): Promise<any>;

    setAuth(auth: IMintAuth): void;
    getCookies(): CookieJar;
    setCookie(name: string, value: string): void;
}
