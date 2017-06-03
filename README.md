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
.fail(function(err) {
    console.error("Boo :(", err);
});
```

#### Mint Cookie

Because of an update to the authorization flow of Mint.com, the API now
requires a cookie which is passed to the *pepper-mint* library as
a string.

To get the cookie, go to the mint sign-in page in Chrome, open Developer
Tools, and select the Network tab. Make sure "Record network log" is on
(top left button in the menu) and sign in.

Then in the network tab, you will find an entry for "sign\_in" (see
picture below). Click on the entry and in the "Headers" tab on the right,
find the "Cookie" field of the "Request Headers" section and copy it for
use with the API.

![Get Mint
cookie](https://cloud.githubusercontent.com/assets/2680142/26742089/38c827d4-47aa-11e7-8f49-df3725805e36.png)

NOTE: The cookie has double quotes in it, so if you want to store it using
double quotes, you must escape it first with a tool like
[this](https://www.freeformatter.com/json-escape.html)

Also, it is unclear how long the cookie lasts, or if there is a better way
for retrieving the cookie. It seems the cookie lasts at least half a day,
but in the future, it could be improved by getting the cookie through
a headless browser.

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

Create a new cache transaction. 

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
