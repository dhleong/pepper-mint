#!/usr/bin/env node

var EventEmitter = require('events').EventEmitter,
    util = require('util'),
    request = require('request'),
    Q = require('q'),

    _until = require('./webdriver-util'),

    URL_BASE = 'https://mint.intuit.com/',
    URL_BASE_ACCOUNTS = 'https://accounts.intuit.com/access_client/',
    URL_LOGIN = URL_BASE + 'login.event',
    URL_SERVICE_BASE = 'https://mintappservice.api.intuit.com/v1',
    URL_SESSION_INIT = 'https://pf.intuit.com/fp/tags?js=0&org_id=v60nf4oj&session_id=',
    USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
    // BROWSER = 'chrome',
    // BROWSER_VERSION = 58,
    // OS_NAME = 'mac',

    INTUIT_API_KEY = 'prdakyrespQBtEtvaclVBEgFGm7NQflbRaCHRhAy',
    DEFAULT_REFRESH_AGE_MILLIS = 24 * 3600 * 100; // 24 hours

require('chromedriver');
var webdriver = require('selenium-webdriver'),
    By = webdriver.By,
    until = webdriver.until;

var MONTH_NUMBERS = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12',
};

module.exports = Prepare;
module.exports.setHttpService = SetHttpService;
module.exports.PepperMint = PepperMint;

// default http service factory
var _requestService = function(args) {
    return request.defaults(args);
};

function accountIsActive(account) {
    return account.isActive;
}

/** Create a function that will cache the result of callback(mint) */
function cacheAs(name, callback) {
    return function() {
        var self = this;
        var cached = this._cache[name];

        // TODO probably, limit cache duration
        if (!cached) {
            return callback(this).then(function(result) {
                self._cache[name] = result;
                return result;
            });
        }

        return Q.resolve(cached);
    };
}

/**
 * Coerce the "doneRefreshing" arg passed to various functions
 *  into the appropriate predicate
 */
function coerceDoneRefreshing(arg) {
    if (arg === undefined || typeof(arg) === 'number') {
        var maxRefreshingIds = arg || 0;
        return function(ids) {
            return ids.length <= maxRefreshingIds;
        };
    }

    return arg;
}

function ensureDateStringFormatted(date) {
    if (date.indexOf('/') !== -1) {
        // it's good! (probably)
        return date;
    }

    var parts = date.split(' ');
    if (parts.length !== 2) {
        // not something we can handle; just return as-is
        return date;
    }

    var month = MONTH_NUMBERS[parts[0]];
    if (!month) {
        // as above
        return date;
    }

    var day = parts[1];
    var year = new Date().getFullYear();

    return month + '/' + day + '/' + year;
}

function stringifyDate(date) {
    if (typeof(date) === 'string') {
        return ensureDateStringFormatted(date);
    }

    var month = date.getMonth() + 1;
    if (month < 10) {
        month = `0${month}`;
    }

    var day = date.getDate();
    if (day < 10) {
        day = `0${day}`;
    }

    var year = date.getFullYear();
    return month + '/' + day + '/' + year;
}

/**
 * Public "login" interface. Eg:
 * require('pepper-mint')(user, password)
 * .then(function(mint) {
 *  // do fancy stuff here
 * });
 *
 * If you need access to events before login is completed,
 *  the PepperMint class instance is stored on the returned
 *  Promise as `.mint`.
 */
function Prepare(email, password, token, cookies) {
    var mint = new PepperMint();
    mint.token = token;

    var promise = Q.Promise(function(resolve, reject) {
        // start login next frame so clients can register event handlers
        // for browser-login
        setTimeout(function() {
            mint._extractCookies(token, cookies);

            _login(mint, email, password, function(err) {
                if (err) return reject(err);

                resolve(mint);
            });
        }, 0);
    });
    promise.mint = mint;
    return promise;
}

/**
 * If you don't like `request` for whatever reason
 *  (it's unreasonably slow with node-webkit + angular,
 *  for some reason), you can provide a new one here.
 *
 * @param service the Factory for the http service. Called
 *  with {jar: cookieJar}, where the cookieJar is a 
 *  request-compatible object containing the cookie jar.
 */
function SetHttpService(service) {
    _requestService = service;
    return module.exports;
}

/** wrap a Promise with JSON body parsing on success */
function _jsonify(promise) {
    return promise.then(function(body) {
        if (!body.iamTicket) {
            if (~body.indexOf("Session has expired.")) {
                throw new Error("Session has expired");
            }
            if (~body.indexOf("<response><empty/></response>")) {
                return { success: true };
            }
            try {
                return JSON.parse(body);
            } catch (e) {
                throw e;
            }
        } else {
            return body;
        }
    });
}

/* non-public login util function, so the credentials aren't saved on any object */
function _login(mint, email, password, callback) {
    return mint._getSessionCookies(email, password)
    .spread(function(token, sessionCookies) {
        // initialize the session
        sessionCookies.forEach(function(cookie) {
            mint._setCookie(cookie.name, cookie.value);
        });
        mint.sessionCookies = sessionCookies;
        mint.token = token;

        callback(null, mint);
    }).catch(function(err) {
        callback(err);
    });
}

/**
 * Main public interface object. NOTE: In general you should
 *  not use this constructor directly, but rather use the
 *  exposed login function.
 *
 * Events:
 *  - `refreshing`: Emitted after a call to waitForRefresh()
 *                  or refreshIfNeeded() with a list of accounts
 *                  that are being refreshed.
 *  - `browser-login`: Emitted at various stages when a browser
 *                     is used as part of login in order to get
 *                     necessary cookies. The argument is a string
 *                     indicating the current state, one of:
 *          - `init`: Browser login has started
 *          - `login`: Waiting for login to complete; it is likely
 *                     waiting for the user to complete two-factor auth
 *          - `cookie`: Auth cookies are being fetched
 *          - `done`: Browser login is done, and PepperMint will proceed
 *                    with normal initialization
 */
function PepperMint() {
    EventEmitter.call(this);

    this.requestId = 42; // magic number? random number?

    this.jar = request.jar();
    this.request = _requestService({jar: this.jar});

    // NOTE: this key might not be static; if that's the case,
    // we can load overview.event and pull it out of the embedded
    // javascript from a JSON object field `browserAuthAPIKey`
    this.intuitApiKey = INTUIT_API_KEY;

    this._cache = {};
}
util.inherits(PepperMint, EventEmitter);

/**
 * Returns a promise that fetches accounts
 */
PepperMint.prototype.getAccounts = function() {
    var self = this;
    return self._jsonForm({
        args: {
            types: [
                "BANK",
                "CREDIT",
                "INVESTMENT",
                "LOAN",
                "MORTGAGE",
                "OTHER_PROPERTY",
                "REAL_ESTATE",
                "VEHICLE",
                "UNCLASSIFIED",
            ],
        },
        service: "MintAccountService",
        task: "getAccountsSorted",
    });
};
PepperMint.prototype.accounts = cacheAs('accounts', function(mint) {
    return mint.getAccounts();
});

function budgetForKey(mint, categories, data, budgetKey) {

    var income = data.income[budgetKey];
    var spending = data.spending[budgetKey];

    [income.bu, spending.bu, income.bu, spending.ub].forEach(function(budgetSet) {
        budgetSet.forEach(function(budget) {
            budget.category = mint.getCategoryNameById(
                categories,
                budget.cat
            );
        });
    });

    return {
        income: income.bu,
        spending: spending.bu,
        unbudgeted: {
            income: income.ub,
            spending: spending.ub,
        },
    };
}

function firstDayOfNextMonth(date) {
    if (date.getMonth() == 11) {
        return new Date(date.getFullYear() + 1, 0);
    } else {
        return new Date(date.getFullYear(), date.getMonth() + 1);
    }
}

PepperMint.prototype._getBudgetsArgs = function() {
    var date, start, end, options;
    switch (arguments.length) {
    case 0:
        date = this._now();
        break;
    case 1:
        if (arguments[0] instanceof Date) {
            date = arguments[0];
        } else {
            options = arguments[0];
        }
        break;
    case 2:
        // DEPRECATED:
        start = arguments[0];
        end = arguments[1];
        break;
    }

    if (date) {
        start = new Date(date.getFullYear(), date.getMonth());
        end = firstDayOfNextMonth(date);
    } else if (options && options.months <= 0) {
        throw new Error("Invalid `months` argument: " + options.months);
    } else if (options && options.months) {
        var now = this._now();
        end = firstDayOfNextMonth(now);

        // there may be a way to do this without a loop,
        // but this is simple and understandable, and even if
        // someone requests 100 years of data, this won't take too long.
        var startYear = end.getFullYear();
        var startMonth = end.getMonth() - options.months;
        while (startMonth < 0) {
            --startYear;
            startMonth += 12;
        }

        start = new Date(startYear, startMonth);
    } else if (options) {
        start = options.start;
        end = options.end;
    }

    function formatDate(d) {
        return (d.getMonth() + 1)
            + '/' + d.getDate()
            + '/' + d.getFullYear();
    }

    return {
        startDate: formatDate(start),
        endDate: formatDate(end),
        rnd: this._random(),
        options: options,
    };
};

/**
 * Get budgets. By default, fetches the budget for the current month.
 * Alternatively, you can provide a single Date, and we will fetch
 * the budget for the month containing that date; or you can provide
 * an options map:
 *
 * {
 *  start: <date>,
 *  end: <date>
 * }
 *
 * In this case, we will fetch a *list* of budgets for the months between
 * `start` and `end`. For the common case, you can instead provide:
 *
 * {
 *  months: <number>
 * }
 *
 * to get a *list* of budgets for the past `months` months. 0 is invalid,
 * and 1 fetches the most recent month (but wrapped in a list).
 *
 * In either case, when using an options map the budgets are returned sorted
 * from *oldest* month to *newest* month.
 */
PepperMint.prototype.getBudgets = function() {
    var args = this._getBudgetsArgs.apply(this, arguments);
    var self = this;

    // if supplied, the options map is returned as part of args.
    // pull it out here:
    var options = args.options;
    delete args.options;

    // fetch both in parallel
    return Q.spread([
        this.categories(),
        this._getJson('getBudget.xevent', args),
    ], function(categories, json) {
        var data = json.data;
        var incomeKeys = Object.keys(data.income).map(function(k) {
            return parseInt(k);
        });

        if (!options) {
            // single month
            var budgetKey = Math.min.apply(Math, incomeKeys).toString();

            return budgetForKey(self, categories, data, budgetKey);
        }

        // list of months
        incomeKeys.sort();
        return incomeKeys.map(key =>
            budgetForKey(self, categories, data, key.toString())
        );
    });
};

/**
 * Promised category list fetch
 */
PepperMint.prototype.getCategories = function() {
    return this._getJsonData('categories');
};
PepperMint.prototype.categories = cacheAs('categories', function(mint) {
    return mint.getCategories();
});


/**
 * Given the result from `getCategories()` and a category id,
 *  return the category's name
 */
PepperMint.prototype.getCategoryNameById = function(categories, id) {
    if (id === 0) return "Uncategorized";

    var found = null;
    categories.some(function(el) {
        if (el.id === id) {
            found = el.value;
            return true;
        }

        if (!el.children) return false;

        // there's only one level of depth, so
        // no need for recursion
        return el.children.some(function(kid) {
            if (kid.id === id) {
                found = el.value + ": " + kid.value;
                return true;
            }
        });
    });

    return found;
};

/**
 * Promised tags list fetch
 */
PepperMint.prototype.getTags = function() {
    return this._getJsonData('tags');
};



/**
 * Returns a promise that fetches transactions,
 *  optionally filtered by account and offset
 *
 * Args should look like: {
 *   accountId: 1234 // optional
 * , category: { id: 7 } // optional; the id itself also works
 * , offset: 0 // optional
 * , query: [  // optional
 *      "coffee",
 *   ]
 * , startDate: new Date(), // optional
 * , endDate: new Date(), // optional
 * }
 */
PepperMint.prototype.getTransactions = function(args) {
    args = args || {};
    var offset = args.offset || 0;
    var query = args.query || [];
    if (!Array.isArray(query)) {
        query = [query];
    }
    if (args.category && typeof(args.category) === 'object') {
        args.category = args.category.id;
    }
    if (args.category) {
        query.push('category:"' + args.category + '"');
    }

    return this._getJsonData({
        accountId: args.accountId,
        offset: offset,
        comparableType: 8, // ?
        acctChanged: 'T',  // ?
        query: query.join(','),
        queryNew: "",
        startDate: stringifyDate(args.startDate),
        endDate: stringifyDate(args.endDate),
        task: 'transactions',
    });
};

/**
 * Create a new cash transaction;
 *  to be used to fake transaction imports.
 *
 * NB: There is currently very little arg validation,
 *  and the server seems to silently reject issues, too :(
 *
 * Args should look like: {
 *  accountId: 1234 // apparently ignored, but good to have, I guess?
 *  amount: 4.2
 *  category: {
 *      id: id
 *    , name: name
 *  }
 *  date: "MM/DD/YYYY"
 *  isExpense: bool
 *  isInvestment: bool
 *  merchant: "Merchant Name"
 *  note: "Note, if any"
 *  tags: [1234, 5678] // set of ids
 * }
 *
 * @param category Optional; if not provided, will just show
 *  up as UNCATEGORIZED, it seems
 *
 */
PepperMint.prototype.createTransaction = function(args) {

    var self = this;
    var form = {
        amount: args.amount,
        cashTxnType: 'on',
        date: stringifyDate(args.date),
        isInvestment: args.isInvestment,
        merchant: args.merchant,
        mtAccount: args.accountId,
        mtCashSplitPref: 2,             // ?
        mtCheckNo: '',
        mtIsExpense: args.isExpense,
        mtType: 'cash',
        note: args.note,
        task: 'txnadd',
        txnId: ':0',                    // might be required

        token: this.token,
    };

    if (args.category) {
        args.catId = args.category.id;
        args.category = args.category.name;
    }

    // set any tags requested
    if (Array.isArray(args.tags)) {
        args.tags.forEach(function(id) {
            form['tag' + id] = 2; // what? 2?!
        });
    }

    return self._form('updateTransaction.xevent', form);
};


/**
 * Delete a transaction by its id
 */
PepperMint.prototype.deleteTransaction = function(transactionId) {
    return this._form('updateTransaction.xevent', {
        task: 'delete',
        txnId: transactionId,
        token: this.token,
    });
};

/**
 * Edit a transaction.
 *
 * Args should look like: {
 *   id: '1234:0'
 *   category: 'Bills & Utilities',
 *   categoryId: 707,
 *   date: "MM/DD/YYYY"
 *   merchant: "Junky's Quality Parts",
 * }
 *
 * Note that the format of the category information
 *  is different from that for createTransaction. This is
 *  to make it simple to just use a modified result from
 *  `getTransactions()`
 */
PepperMint.prototype.editTransaction = function(args) {
    var form = {
        amount: '',
        category: args.category,
        catId: args.categoryId,
        categoryTypeFilter: 'null',
        date: stringifyDate(args.date),
        merchant: args.merchant,
        task: 'txnedit',
        txnId: args.id,

        token: this.token,
    };

    // TODO support tags, adding notes?
    // That form is much more complicated...

    return this._form('updateTransaction.xevent', form);
};

/**
 * Check which accounts are still refreshing (if any).
 *
 * NOTE: This actually returns *provider ids*, not account IDs.
 */
PepperMint.prototype.getRefreshingAccountIds = function() {
    return this._getIntuitJson('/refreshJob').then(function(response) {
        return response.refreshingCpProviderIds;
    });
};

/**
 * Convenience to map the result of getRefreshingAccountIds() to
 * the actual Accounts (IE: similar to that returned from .accounts()).
 *
 * NOTE: The actual Account instances will be those from providers(),
 *  and so some fields will likely be slightly different than those
 *  from .accounts().
 */
PepperMint.prototype.getRefreshingAccounts = function() {
    var self = this;
    return this.providers().then(function(providers) {
        var providerById = providers.reduce(function(m, provider) {
            m[provider.cpProviderId] = provider;
            return m;
        }, {});

        return self.getRefreshingAccountIds().then(function(ids) {
            // no indication of actually which accounts are being
            // refreshed, so we just assume all for a provider
            return ids.map(function(id) {
                return providerById[id];
            })
            .filter(provider => provider) // unknown provider...?
            .reduce(function(result, provider) {
                return result.concat(provider.providerAccounts);
            }, []).filter(accountIsActive);
        });
    });
};

/**
 * Get a list of the financial data providers available to this
 *  account. Each provider can indicate the Accounts it provides
 *  via `.providerAccounts`
 */
PepperMint.prototype.getProviders = function() {
    return this._getIntuitJson('/providers').then(function(response) {
        return response.providers;
    });
};
PepperMint.prototype.providers = cacheAs('providers', function(mint) {
    return mint.getProviders();
});

/**
 * Refresh account FI Data
 */
PepperMint.prototype.initiateAccountRefresh = function() {
    return this._form('refreshFILogins.xevent', {
        token: this.token,
    });
};

/**
 * This is a convenience function on top of `refreshIfNeeded()`
 *  and `waitForRefresh()`. Options is an object with keys:
 *      - maxAgeMillis: see refreshIfNeeded()
 *      - doneRefreshing: see waitForRefresh()
 *      - maxRefreshingIds: Deprecated; see waitForRefresh()
 *
 * @return A Promise that resolves to this PepperMint instance
 *  when refreshing is done (or if it wasn't needed)
 */
PepperMint.prototype.refreshAndWaitIfNeeded = function(options) {
    var self = this;
    var waitArg = options.doneRefreshing || options.maxRefreshingIds;
    return this.refreshIfNeeded(
        options.maxAgeMillis,
        waitArg
    ).then(function(didRefresh) {
        if (didRefresh) {
            return self.waitForRefresh(waitArg);
        } else {
            return self;
        }
    });
};

/**
 * If any accounts haven't been updated in the last `maxAgeMillis`
 *  milliseconds (by default, 24 hours), this will initiate an account
 *  refresh.
 *
 * @param doneRefreshing As with `waitForRefresh()`.
 * @returns A promise that resolves to `true` once the refresh is
 *  initiated, else `false`. If a refresh *will be* initiated,
 *  a 'refreshing' event is emitted with a list of the accounts being
 *  refreshed.
 */
PepperMint.prototype.refreshIfNeeded = function(maxAgeMillis, doneRefreshing) {
    maxAgeMillis = maxAgeMillis || DEFAULT_REFRESH_AGE_MILLIS;
    doneRefreshing = coerceDoneRefreshing(doneRefreshing);

    var self = this;
    return this.accounts().then(function(accounts) {
        var now = self._now().getTime();
        var needRefreshing = accounts.filter(function(account) {
            return now - account.lastUpdated > maxAgeMillis;
        }).filter(accountIsActive);

        if (doneRefreshing(needRefreshing)) {
            // no refresh needed!
            return false;
        } else {
            self.emit('refreshing', needRefreshing);
            return self.initiateAccountRefresh().then(function() {
                return true;
            });
        }
    });
};

/**
 * Wait until an account refresh is completed. This will poll
 *  `getRefreshingAccount()` every few seconds, and emit a
 *  'refreshing' event with the status, then finally resolve
 *  to this PepperMint instance when done.
 *
 * @param doneRefreshing A predicate function that takes a list of accounts
 *  and returns True if refreshing is "done." If not provided,
 *  this defaults to checking for an empty list---that is, there are no
 *  more accounts being refreshed. For backwards compatibility, this
 *  may also be the max number of still-refreshing ids remaining to
 *  be considered "done." This is 0 by default, of course.
 */
PepperMint.prototype.waitForRefresh = function(doneRefreshing) {
    doneRefreshing = coerceDoneRefreshing(doneRefreshing);

    var self = this;
    var onAccounts;
    onAccounts = function(accounts) {
        if (doneRefreshing(accounts)) return self;

        self.emit('refreshing', accounts);
        return Q.delay(10000).then(function() {
            return self.getRefreshingAccounts().then(onAccounts);
        });
    };

    return this.getRefreshingAccounts().then(onAccounts);
};

/*
 * Util methods
 */

PepperMint.prototype._extractCookies = function(token, cookies) {
    if (cookies && cookies.length) {
        this.sessionCookies = cookies;
    } else {
        this.sessionCookies = null;
    }

    this.token = token;
};


PepperMint.prototype._get = function(url, qs, headers) {
    var request = this.request;
    return Q.Promise(function(resolve, reject) {
        var fullUrl = url.startsWith("http")
            ? url
            : URL_BASE + url;
        var args = {url: fullUrl};
        if (qs) args.qs = qs;
        if (headers) args.headers = headers;

        request(args, function(err, response, body) {
            if (err) return reject(err);
            if (200 !== response.statusCode) {
                var error = new Error(
                    "Failed to load " + fullUrl +
                    ": " + response.statusCode
                );
                error.statusCode = response.statusCode;
                error.body = body;
                return reject(error);
            }

            resolve(body);
        });
    });
};

PepperMint.prototype._getJson = function(url, qs, headers) {
    return _jsonify(this._get(url, qs, headers));
};

PepperMint.prototype._getIntuitJson = function(urlPart) {
    return this._getJson(URL_SERVICE_BASE + urlPart, null, {
        Authorization: 'Intuit_APIKey intuit_apikey=' + this.intuitApiKey + ', intuit_apikey_version=1.0',
    });
};

/** Shortcut to fetch getJsonData of a single task */
PepperMint.prototype._getJsonData = function(args) {
    if ('string' === typeof(args)) {
        args = {task: args};
    }
    args.rnd = this._random();

    return this._getJson('getJsonData.xevent', args)
    .then(function(json) {
        return json.set[0].data;
    });
};

PepperMint.prototype._getSessionCookies = function(email, password) {
    if (this.token && this.sessionCookies && this.sessionCookies.length) {
        return Q.resolve([this.token, this.sessionCookies]);
    }

    var driver = new webdriver.Builder()
        .forBrowser('chrome')
        .build();

    if (!driver) {
        return Q.reject(new Error(
            "token not provided, and unable to " +
            "load chromedriver + selenium>"
        ));
    }

    this.emit('browser-login', 'init');

    driver.get(URL_LOGIN);
    driver.wait(until.elementLocated(By.id("ius-sign-in-submit-btn")));
    driver.findElement(By.id("ius-userid")).sendKeys(email);
    driver.findElement(By.id("ius-password")).sendKeys(password);
    driver.findElement(By.id("ius-sign-in-submit-btn")).submit();

    // we will probably need 2fa... wait until actually logged in
    driver.wait(until.urlIs(URL_BASE + "overview.event"));
    this.emit('browser-login', 'login');

    let self = this;
    let elPromise = driver.wait(_until.elementAttrMatches(By.id("javascript-user"), 'value', v => {
        return v && v.length > 0 && v != '{}';
    }, this));

    let valuePromise = elPromise.then(el => {
        self.emit('browser-login', 'RESOLVE!');
        return el.getAttribute("value");
    });

    return Q(valuePromise).then(jsonString => {
        var json = null;
        try {
            json = JSON.parse(jsonString);
        } catch (e) {
            return Q.reject(e);
        }

        self.emit('browser-login', 'cookie');
        if (json && json.token) {
            return [
                Q.resolve(json.token),
                driver.manage().getCookies(),
            ];
        } else {
            return Q.reject(new Error("No user token: " + json));
        }
    }).spread((token, cookies) => {
        driver.close();

        self.emit('browser-login', 'done');
        return [token, cookies];
    });
};


PepperMint.prototype._form = function(url, form) {
    var request = this.request;
    return _jsonify(Q.Promise(function(resolve, reject) {
        var fullUrl = URL_BASE + url;
        request({
            url: fullUrl,
            method: 'POST',
            form: form,
            headers: {
                Accept: 'application/json',
                'User-Agent': USER_AGENT,
                'X-Request-With': 'XMLHttpRequest',
                'X-NewRelic-ID': 'UA4OVVFWGwYJV1FTBAE=',
                'Referrer': 'https://mint.intuit.com/login.event?task=L&messageId=5&country=US',
            },
        }, function(err, response, body) {
            if (err) return reject(err);
            if (response.statusCode > 204) {
                var error = new Error("Failed to load " + fullUrl);
                error.response = response;
                error.body = body;
                return reject(error);
            }
            resolve(body);
        });
    }));
};

PepperMint.prototype._formAccounts = function(url, form) {
    var request = this.request;
    return _jsonify(Q.Promise(function(resolve, reject) {
        var fullUrl = URL_BASE_ACCOUNTS + url;
        request({
            url: fullUrl,
            method: 'POST',
            json: true,
            body: form,
            headers: {
                'Origin': 'https://mint.intuit.com',
                'Accept-Language': 'en-US,en;q=0.8',
                'Connection': 'keep-alive',
                'intuit_locale': 'en-us',
                'intuit_offeringid': 'Intuit.ifs.mint',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
                'Content-Type': 'application/json',
                'Accept': 'application/json; charset=utf-8',
                'Referer': 'https://mint.intuit.com/login.event?utm_medium=direct&test=Returning_User:_Credit_Score_Homepage_May_2017:Social_proof_2&cta=nav_login_dropdown',
                'intuit_offeringenv': 'prd',
            },
        }, function(err, response, body) {
            if (err) return reject(err);
            if (response.statusCode > 204) {
                var error = new Error("Failed to load " + fullUrl);
                error.response = response;
                error.body = body;
                return reject(error);
            }
            resolve(body);
        });
    }));
};


PepperMint.prototype._jsonForm = function(json) {
    var reqId = '' + this.requestId++;
    json.id = reqId;
    var url = 'bundledServiceController.xevent?legacy=false&token=' + this.token;

    return this._form(url, {
        input: JSON.stringify([json]), // weird
    }).then(function(resp) {
        if (!resp.response) {
            var task = json.service + "/" + json.task;
            throw new Error("Unable to parse response for " + task);
        }

        return resp.response[reqId].response;
    });
};

// stub-able Date factory for testing
PepperMint.prototype._now = function() {
    return new Date();
};

PepperMint.prototype._random = function() {
    return this._now().getTime();
};

PepperMint.prototype._setCookie = function(key, val) {
    var str = key + "=" + val;

    this.jar.setCookie(str, URL_BASE);
    this.jar.setCookie(str, URL_BASE_ACCOUNTS);
    this.jar.setCookie(str, URL_SESSION_INIT);

    // also provide for users to persist
    // this.sessionCookies[key] = val;
};

