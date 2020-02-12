import { IMintAuthorizer, IMintCredentials, INetService } from "../model";

import { extractSessionCookies } from "./session-cookies";

const URL_BASE_ACCOUNTS = "https://accounts.intuit.com/access_client/";
const URL_SESSION_INIT = "https://pf.intuit.com/fp/tags?js=0&org_id=v60nf4oj&session_id=";

const BROWSER = "chrome";
const BROWSER_VERSION = 58;
const OS_NAME = "mac";

export class LegacyMintAuth implements IMintAuthorizer {

    constructor(
        private readonly net: INetService,
    ) {}

    public async authorize(credentials: IMintCredentials) {
        const session = extractSessionCookies(credentials);
        if (!session || !session.cookies) {
            throw new Error("No session cookies");
        }

        const cookiesMap = session.cookies.reduce(
            (m, cookie) => {
                m[cookie.name] = cookie.value;
                return m;
            },
            {}
        );
        if (!cookiesMap.ius_session) {
            throw new Error("No session cookies");
        }

        // initialize the session
        session.cookies.forEach(cookie => {
            this.net.setCookie(cookie.name, cookie.value);
        });

        await this.net.load(URL_SESSION_INIT + cookiesMap.ius_session);

        const auth = await this.net.postForm(URL_BASE_ACCOUNTS + "sign_in", {
            username: credentials.email,
            password: credentials.password,
        });

        // save the pod number (or whatever) in a cookie
        const json = await this.net.postForm("getUserPod.xevent", {
            clientType: 'Mint',
            authid: auth.iamTicket.userId,
        });
        this.net.setCookie("mintPN", json.mintPN);

        // finally, login
        const tokenJson = await this.net.postForm('loginUserSubmit.xevent', {
            task: 'L',
            browser: BROWSER,
            browserVersion: BROWSER_VERSION,
            os: OS_NAME,
        });

        if (tokenJson.error && tokenJson.error.vError) {
            throw new Error(tokenJson.error.vError.copy);
        }
        if (!(tokenJson.sUser && tokenJson.sUser.token)) {
            throw new Error("Unable to obtain token");
        }

        return {
            cookies: session.cookies,
            token: tokenJson.sUser.token,
        };
    }

}
