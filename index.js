#!/usr/bin/env node

var request = require('request')
  , Q = require('q')
  
  , URL_BASE = 'https://mint.intuit.com/'
  , URL_BASE_ACCOUNTS = 'https://accounts.intuit.com/access_client/'
  , USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
  , BROWSER = 'chrome'
  , BROWSER_VERSION = 58
  , OS_NAME = 'mac';


module.exports = Prepare;
module.exports.setHttpService = SetHttpService;

// default http service factory
var _requestService = function(args) {
    return request.defaults(args);
};

/**
 * Public "login" interface. Eg:
 * require('pepper-mint')(user, password)
 * .then(function(mint) {
 *  // do fancy stuff here
 * });
 */
function Prepare(email, password, cookie) {
    var self = this;
    self.cookie = cookie;
    return Q.Promise(function(resolve, reject) {
        var mint = new PepperMint();
        _login(mint, email, password, function(err) {
            if (err) return reject(err);

            resolve(mint);
        });
    });
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
    return mint._formAccounts('sign_in', {
        namespaceId: "50000026",
        password: password,
        username: email
    })
    .then(function(credentials) {
        // get user pod (!?)
        // initializes some cookies, I guess;
        //  it does not appear to be necessary to 
        //  load login.event?task=L
        return mint._form('getUserPod.xevent', {
            clientType: 'Mint',
            authid: credentials.iamTicket.userId
        });
    })
    .then(function(json) {
        // save the pod number (or whatever) in a cookie
        var cookie = request.cookie('mintPN=' + json.mintPN);
        mint.jar.setCookie(cookie, URL_BASE);

        // finally, login
        return mint._form('loginUserSubmit.xevent', {
            task: 'L',
            browser: BROWSER,
            browserVersion: BROWSER_VERSION,
            os: OS_NAME
        });
    })
    .then(function(json) {
        if (json.error && json.error.vError) {
            return callback(new Error(json.error.vError.copy));
        }
        if (!(json.sUser && json.sUser.token)) {
            return callback(new Error("Unable to obtain token"));
        }

        mint.token = json.sUser.token;
        callback(null, mint);
    }).fail(function(err) {
        callback(err);
    });
}

/**
 * Main public interface object
 */
function PepperMint() {
    this.requestId = 42; // magic number? random number?

    this.jar = request.jar();
    this.request = _requestService({jar: this.jar});
}

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
                "UNCLASSIFIED"
            ]
        }, 
        service: "MintAccountService", 
        task: "getAccountsSorted"
    });
};

/**
 * Get budgets. By default, fetches the budget for the current month.
 * Alternatively, you can provide a single Date, and we will fetch
 * the budget for the month containing that date; or you can provide
 * two dates, and we will provide the budget for that range
 */
PepperMint.prototype.getBudgets = function() {
    var date, start, end;
    switch (arguments.length) {
    case 0:
        date = new Date();
        break;
    case 1:
        date = arguments[0];
        break;
    case 2:
        start = arguments[0];
        end = arguments[1];
        break;
    }

    if (date) {
        start = new Date(date.getFullYear(), date.getMonth());
        if (date.getMonth() == 11) {
            end = new Date(date.getFullYear() + 1, 1);
        } else {
            end = new Date(date.getFullYear(), date.getMonth() + 1);
        }
    }

    function formatDate(d) {
        return (d.getMonth() + 1)
            + '/' + d.getDate()
            + '/' + d.getFullYear();
    }

    var self = this;
    var args = {
        startDate: formatDate(start),
        endDate: formatDate(end),
        rnd: this._random(),
    };

    // fetch both in parallel
    return Q.spread([
        this.getCategories(),
        this._getJson('getBudget.xevent', args)
    ], function(categories, json) {
        var data = json.data;

        var incomeKeys = Object.keys(data.income);
        var budgetKey = Math.min.apply(Math, incomeKeys.map(function(k) {
            return parseInt(k);
        })).toString();

        var income = data.income[budgetKey].bu;
        var spending = data.spending[budgetKey].bu;

        [income, spending].forEach(function(budgetSet) {
            budgetSet.forEach(function(budget) {
                budget.category = self.getCategoryNameById(
                    categories,
                    budget.cat
                );
            });
        });

        return {
            income: income,
            spending: spending,
        };
    });
};

/**
 * Promised category list fetch
 */
PepperMint.prototype.getCategories = function() {
    if (this._categories) {
        return Q.resolve(this._categories);
    }

    return this._getJsonData('categories')
    .then(function(categories) {
        // cache
        this._categories = categories;
        return categories;
    });
};

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
 *  accountId: 1234 // optional
 *  offset: 0 // optional
 * }
 */
PepperMint.prototype.getTransactions = function(args) {
    
    args = args || {};
    var offset = args.offset || 0;
    return this._getJsonData({
        accountId: args.accountId
      , offset: offset
      , comparableType: 8 // ?
      , acctChanged: 'T'  // ?
      , task: 'transactions'
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
        amount: args.amount
      , cashTxnType: 'on'
      , date: args.date
      , isInvestment: args.isInvestment
      , merchant: args.merchant
      , mtAccount: args.accountId
      , mtCashSplitPref: 2              // ?
      , mtCheckNo: ''
      , mtIsExpense: args.isExpense
      , mtType: 'cash'
      , note: args.note
      , task: 'txnadd'
      , txnId: ':0'                     // might be required

      , token: this.token
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
        token: this.token
    });
};

/**
 * Refresh account FI Data
 */
PepperMint.prototype.initiateAccountRefresh = function(){
    return this._form('refreshFILogins.xevent', {
        token: this.token
    });
};


/*
 * Util methods
 */

PepperMint.prototype._get = function(url, qs) {
    var request = this.request;
    return Q.Promise(function(resolve, reject) {
        var fullUrl = URL_BASE + url;
        var args = {url: fullUrl};
        if (qs) args.qs = qs;

        request(args, function(err, response, body) {
            if (err) return reject(err);
            if (200 != response.statusCode) {
                return reject(new Error("Failed to load " + fullUrl));
            }

            resolve(body);
        });
    });
};

PepperMint.prototype._getJson = function(url, qs) {
    return _jsonify(this._get(url, qs));
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


PepperMint.prototype._form = function(url, form) {
    var request = this.request;
    return _jsonify(Q.Promise(function(resolve, reject) {
        var fullUrl = URL_BASE + url;
        request({
            url: fullUrl
          , method: 'POST'
          , form: form
          , headers: {
              Accept: 'application/json'
              , 'User-Agent': USER_AGENT
              , 'X-Request-With': 'XMLHttpRequest'
              , 'X-NewRelic-ID': 'UA4OVVFWGwYJV1FTBAE='
              , 'Referrer': 'https://mint.intuit.com/login.event?task=L&messageId=5&country=US'
          }
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
            url: fullUrl
          , method: 'POST'
          , json: true,
            body: form,
            headers: {
                'Cookie': this.cookie,
                'Origin': 'https://mint.intuit.com',
                'Accept-Language': 'en-US,en;q=0.8',
                'Connection': 'keep-alive',
                'intuit_locale': 'en-us',
                'intuit_offeringid': 'Intuit.ifs.mint',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
                'Content-Type': 'application/json',
                'Accept': 'application/json; charset=utf-8',
                'Referer': 'https://mint.intuit.com/login.event?utm_medium=direct&test=Returning_User:_Credit_Score_Homepage_May_2017:Social_proof_2&cta=nav_login_dropdown',
                'intuit_offeringenv': 'prd' 
            }
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
        input: JSON.stringify([json]) // weird
    }).then(function(resp) {
        if (!resp.response) {
            var task = json.service + "/" + json.task;
            throw new Error("Unable to parse response for " + task);
        }

        return resp.response[reqId].response;
    });
};

PepperMint.prototype._random = function() {
    return new Date().getTime();
};

