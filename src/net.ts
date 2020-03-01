import { CookieJar } from "request";
import request from "request-promise-native";

import { IJsonForm, IMintAuth, INetService } from "./model";

export const URL_BASE = "https://mint.intuit.com/";
export const URL_BASE_ACCOUNTS = "https://accounts.intuit.com/access_client/";
export const URL_SESSION_INIT = "https://pf.intuit.com/fp/tags?js=0&org_id=v60nf4oj&session_id=";

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36";

function checkJsonResponse(response: any) {
    if (typeof response === "string") {
        if (response.includes("Session has expired.")) {
            throw new Error("Session has expired");
        }
        if (response.includes("<response><empty/></response>")) {
            return { success: true };
        }
    }
}

export class RequestNetService implements INetService {

    private readonly jar = request.jar();
    private readonly request = request.defaults({ jar: this.jar });

    private token: string | undefined;
    private requestId = 42;  // magic number? random number?

    public load(url: string): Promise<void> {
        return this.request.get(resolveUrl(url));
    }

    public async getJson(
        url: string,
        qs?: {[key: string]: string},
        headers?: {[key: string]: string},
    ) {
        const response = await this.request.get({
            url: resolveUrl(url),
            json: true,
            headers,
            qs,
        });
        checkJsonResponse(response);
        return response;
    }

    public async jsonForm(
        form: IJsonForm,
    ) {
        const reqId = '' + this.requestId++;
        (form as any).id = reqId;
        const url = "bundledServiceController.xevent?legacy=false&token=" + this.getToken();

        const resp = await this.postForm(url, {
            input: JSON.stringify([form]), // weird
        });

        if (!resp.response) {
            const task = form.service + "/" + form.task;
            throw new Error("Unable to parse response for " + task);
        }

        return resp.response[reqId].response;
    }

    public async postForm(
        url: string,
        form: { [key: string]: string | number },
        headers?: { [key: string]: string },
    ): Promise<any> {
        const fullHeaders = {
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
            "X-Request-With": 'XMLHttpRequest',
            "X-NewRelic-ID": 'UA4OVVFWGwYJV1FTBAE=',
            "Referrer": 'https://mint.intuit.com/login.event?task=L&messageId=5&country=US',

            ...headers,
        };
        const result = await this.request.post({
            url: resolveUrl(url),
            json: true,
            form,
            headers: fullHeaders,
        });
        checkJsonResponse(result);
        return result;
    }

    public async postJson(
        url: string,
        json: any,
        headers?: { [key: string]: string },
    ): Promise<any> {
        const result = await this.request.post({
            url: resolveUrl(url),
            json,
            headers,
        });
        checkJsonResponse(result);
        return result;
    }

    public getCookies(): CookieJar {
        return this.jar;
    }

    public setAuth(auth: IMintAuth) {
        this.token = auth.token;
        for (const cookie of auth.cookies) {
            this.setCookie(cookie.name, cookie.value);
        }
    }

    public setCookie(name: string, value: string) {
        const cookie = `${name}=${value}`;
        this.jar.setCookie(cookie, URL_BASE);
        this.jar.setCookie(cookie, URL_BASE_ACCOUNTS);
        this.jar.setCookie(cookie, URL_SESSION_INIT);
    }

    private getToken(): string {
        const token = this.token;
        if (!token) throw new Error("No token");
        return token;
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
