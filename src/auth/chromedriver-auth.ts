import { EventEmitter } from "events";

import webdriver, { By, until } from "selenium-webdriver";

import { IMintAuthorizer, IMintCredentials } from "../model";

const URL_BASE = "https://mint.intuit.com/";
const URL_LOGIN = URL_BASE + "login.event";

export class ChromedriverMintAuth implements IMintAuthorizer {

    public async authorize(
        events: EventEmitter,
        credentials: IMintCredentials,
    ) {
        require("chromedriver");

        const driver = await this.createDriver();
        try {
            return await this.authWithDriver(events, driver, credentials);
        } finally {
            await driver.close();
            events.emit("browser-login", "done");
        }
    }

    private async authWithDriver(
        events: EventEmitter,
        driver: webdriver.WebDriver,
        credentials: IMintCredentials,
    ) {
        events.emit('browser-login', 'init');

        await driver.get(URL_LOGIN);
        await driver.wait(until.elementLocated(By.id("ius-sign-in-submit-btn")));
        await driver.findElement(By.id("ius-userid")).sendKeys(credentials.email);
        await driver.findElement(By.id("ius-password")).sendKeys(credentials.password);
        await driver.findElement(By.id("ius-sign-in-submit-btn")).submit();

        // we will probably need 2fa... wait until actually logged in
        await driver.wait(until.urlIs(URL_BASE + "overview.event"));
        events.emit('browser-login', 'login');

        const el = await driver.wait(elementAttrMatches(By.id("javascript-user"), 'value', v => {
            return v && v.length > 0 && v !== '{}';
        }));

        events.emit('browser-login', 'RESOLVE!');
        const jsonString = await el.getAttribute("value");
        const json = JSON.parse(jsonString);

        events.emit('browser-login', 'cookie');
        if (!(json && json.token)) {
            throw new Error("No user token: " + json);
        }

        const cookies = await driver.manage().getCookies();
        return {
            token: json.token,
            cookies,
        };
    }

    private async createDriver() {
        const driver = await new webdriver.Builder()
            .forBrowser('chrome')
            .build();

        if (!driver) {
            throw new Error(
                "token not provided, and unable to " +
                "load chromedriver + selenium"
            );
        }

        return driver;
    }
}

function elementAttrMatches(
    locator: webdriver.Locator,
    attrName: string,
    predicate: (attr: string) => any | undefined,
) {
    return new webdriver.WebElementCondition(
        'until element[' + attrName + '] matches',
        (async (driver: webdriver.WebDriver) => {
            const els = await driver.findElements(locator);
            if (!els.length) return;

            const el = els[0];
            const attr = await el.getAttribute(attrName);
            if (predicate(attr)) {
                return el;
            }
        }) as any,
    );
}
