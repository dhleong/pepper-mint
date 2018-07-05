pepper-mint
===========

An unofficial, promise-based [mint.com](https://www.mint.com) API in node.js.
Builds on the [work by mroony](https://github.com/mrooney/mintapi)


### Usage

[![NPM](https://nodei.co/npm/pepper-mint.png?mini=true)](https://nodei.co/npm/pepper-mint/)

```javascript
require('pepper-mint')(user, pass, cookie)
.then(function(mint) {
    console.log("Logged in...");

    // return another promise
    // (or you can then() it here, of course,
    //  if you need more API calls)
    return mint.getAccounts();
})
.then(function(accounts) {

    // accounts is the array of account objects
    accounts.forEach(function(account) {
        // EG: "Bank of America", "Savings", 1234567
        console.log(account.fiName, account.accountName, account.accountId);
    });
})
.catch(function(err) {
    console.error("Boo :(", err);
});
```

#### Mint Cookie

> 🚨 NOTE: Mint no longer seems to issue these. This information will
> remain for historical purposes, but you should probably just ignore it and
> only provide the `user` and `pass` parameters to the PepperMint constructor.
> If you do happen to still have `ius_session` and `thx_guid` you can continue
> to provide them, as they do occasionally still work. PepperMint will try
> to use them first, if provided, then fallback to the new auth method
> which always opens a browser.

Because of an update to the authorization flow of Mint.com, the API now
requires a couple cookies, which are passed to the *pepper-mint* library as
a string. These are called `ius_session` and `thx_guid`.

To get the value of these cookies, you can use Chrome and login to Mint.com,
then open the Developer Tools and check the Application tab. On the left
should be an item called Cookies, which you can expand to see
`https://mint.intuit.com` and `https://pf.intuit.com`, at least. `ius_session`
can be found on the former, and `thx_guid` can be found on the latter.

You can pass these separately as:

```javascript
require('pepper-mint')(username, password, ius_session, thx_guid)
```

or as a cookie-style string (for backwards compatibility):

```javascript
require('pepper-mint')(username, password,
    `ius_session=${ius_session};thx_guid=${thx_guid}`)
```

Furthermore, if you don't want to extract them by hand at all, *pepper-mint*
includes a mechanism to drive a Chrome browser and extract it automatically---just
be aware that using this method will probably require you to input a two-factor
auth code. If you want to persist the cookies fetched by this method, they will
be stored as `.sessionCookies` on the Mint instance:

> 🚨 NOTE: `.sessionCookies` still exists as of PepperMint v2.0.0, but it
> is now an array of `{name: "", value: ""}` maps. Due to how short a
> lifespan the new cookies have, you probably shouldn't bother trying to
> persist them like this anymore.

```javascript
require('pepper-mint')(username, password)
.then(function(mint) {
    // NOTE: this is spelled out to clarify the format
    // of the sessionCookies property
    persistCookies({
        // 🚨 Just a reminder, if you missed the NOTE above:
        // sessionCookies does not look like this anymore as of
        // PepperMint v2.0.0 and you probably shouldn't bother
        // with any of this.
        ius_session: mint.sessionCookies.ius_session,
        thx_guid: mint.sessionCookies.thx_guid,
    });
});
```


### API

Everything returns a [promise](https://github.com/kriskowal/q) for convenient
chaining (and also because I wanted to try it out).

#### require('pepper-mint')

Returns a Login function, which accepts a mint.com username and password
as its arguments, and returns a Promise which, when resolved, passes a
PepperMint API object. All methods below are called on that object, and
return a Promise. In this context, "returns" is a shorthand to mean
"the promise resolves with."

#### mint.getAccounts()

Returns an array of Accounts.

#### mint.getCategories()

Returns a list of Categories (for categorizing transactions)

#### mint.getTags()

Returns a list of user-defined Tags

#### mint.getTransactions([args])

Returns a list of Transactions, optionally filtered by account and/or offset.
`args` is an optional dictionary, with keys `accountId` and `offset`, both
optional. 

#### mint.createTransaction(args)

Create a new cash transaction.

NB: There is currently very little arg validation,
 and the server seems to silently reject issues, too :(

Args should look like: 

```javascript
{
   accountId: 1234 // apparently ignored, but good to have, I guess?
   amount: 4.2
   category: {
       id: id
     , name: name
   }
   date: "MM/DD/YYYY"
   isExpense: bool
   isInvestment: bool
   merchant: "Merchant Name"
   note: "Note, if any"
   tags: [1234, 5678] // set of ids
}
```

`category` is Optional; if not provided, will just show
 up as UNCATEGORIZED, it seems

#### mint.deleteTransaction(transactionId)

Delete a transaction by its ID
