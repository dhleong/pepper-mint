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

export interface IMintAuth {
    cookies: any[];
    token: string;
}

export interface IMintAuthorizer {
    authorize(credentials: IMintCredentials): Promise<IMintAuth>;
}

export interface INetService {
    load(url: string): Promise<void>;
    postForm(
        url: string,
        form: {[key: string]: string | number},
        headers?: {[key: string]: string},
    ): Promise<any>;

    getCookies(): CookieJar;
    setCookie(name: string, value: string): void;
}
