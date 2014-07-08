pepper-mint
===========

An unofficial, promise-based [mint.com](https://www.mint.com) API in node.js.
Builds on the [work by mroony](https://github.com/mrooney/mintapi)


### Usage

```javascript
require('pepper-mint')(user, pass)
.then(function(mint) {
    console.log("Logged in...");

    // return another promise
    // (or you can then() it here, of course,
    //  if you need more API calls)
    return mint.accounts();
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

### API

Everything returns a [promise](https://github.com/kriskowal/q) for convenient
chaining (and also because I wanted to try it out).

#### require('pepper-mint')

Returns a Login function, which accepts a mint.com username and password
as its arguments, and returns a Promise which, when resolved, passes a
PepperMint API object. All methods below are called on that object, and
return a Promise. In this context, "returns" is a shorthand to mean
"the promise resolves with."

#### mint.accounts()

Returns an array of Accounts. 

#### mint.categories()

Returns a list of Categories (for categorizing transactions)

#### mint.tags()

Returns a list of user-defined Tags

#### mint.transactions([accountId])

Returns a list of Transactions, optionally filtered by account

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
