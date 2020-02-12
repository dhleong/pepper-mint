import { IMintCredentials } from "../model";

export function extractSessionCookies(
    creds: IMintCredentials,
) {
    const { extras } = creds;
    if (!extras) return;

    const { cookies, token } = extras;

    if (
        cookies
        && Array.isArray(cookies)
        && cookies.length
    ) {
        // newest, normal version
        return { cookies, token };
    }

    if (
        token
        && !cookies
        && token.includes("ius_session")
    ) {

        // attempt backwards compatibility with old `cookies` arg
        const tryMatch = function(regex: RegExp) {
            const m = regex.exec(token);
            if (m) return m[1];
        };

        return {
            token,
            cookies: [
                {
                    name: 'ius_session',
                    value: tryMatch(/ius_session=([^;]+)/),
                },
                {
                    name: 'thx_guid',
                    value: tryMatch(/thx_guid=([^;]+)/),
                },
            ],
        };

    }

    if (
        token
        && !cookies
        && typeof(token) !== 'string'
    ) {
        // map of old cookies
        return {
            token,
            cookies: [
                { name: 'ius_session', value: (token as any).ius_session },
                { name: 'thx_guid', value: (token as any).thx_guid },
            ],
        };
    }
}
