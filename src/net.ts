import { CookieJar } from "request";
import request from "request-promise-native";

import { INetService } from "./model";

export const URL_BASE = "https://mint.intuit.com/";
export const URL_BASE_ACCOUNTS = "https://accounts.intuit.com/access_client/";
export const URL_SESSION_INIT = "https://pf.intuit.com/fp/tags?js=0&org_id=v60nf4oj&session_id=";

export class RequestNetService implements INetService {

    private readonly jar = request.jar();
    private readonly request = request.defaults({ jar: this.jar });

    public load(url: string): Promise<void> {
        return this.request.get(resolveUrl(url));
    }

    public async postForm(
        url: string,
        form: { [key: string]: string | number },
        headers?: { [key: string]: string },
    ): Promise<any> {
        return this.request.post({
            url: resolveUrl(url),
            json: true,
            form,
            headers,
        });
    }

    public getCookies(): CookieJar {
        return this.jar;
    }

    public setCookie(name: string, value: string) {
        const cookie = `${name}=${value}`;
        this.jar.setCookie(cookie, URL_BASE);
        this.jar.setCookie(cookie, URL_BASE_ACCOUNTS);
        this.jar.setCookie(cookie, URL_SESSION_INIT);
    }

}

function resolveUrl(input: string) {
    if (input.startsWith("http")) {
        return input;
    }

    if (input.startsWith("/")) {
        return URL_BASE + input.substring(1);
    }

    return URL_BASE + input;
}
