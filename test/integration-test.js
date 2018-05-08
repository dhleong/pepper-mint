let chai = require('chai');
let PepperMint = require('../index')

chai.should();

try {
  var config = require('./integration-config.json');
} catch (e) {
  // no config; don't run tests
}

if (config) {
  describe('pepper-mint', function () {
    describe('handles editing transactions', function () {
      it('verifies fields have changed after editing', async function () {
        this.timeout(30000);
        let mint = await PepperMint(config.username, config.password, config.ius_session, config.thx_guid)
        await createTransaction(mint)
        let transactions = await getTransactions(mint)

        await editTransaction(mint, transactions)
        let newTnx = await getTransactions(mint)

        await deleteTransaction(mint, newTnx)

        await doAssertions(newTnx)
      })
    });
  });
}

function doAssertions(transaction) {
  transaction[0].merchant.should.equal("New Test Merchant Name")
  transaction[0].category.should.equal("Vacation")
  transaction[0].categoryId.should.equal(1504)
  transaction[0].date.should.equal("May 5")
  return transaction
}

function createTransaction(mint) {
  let createRequest = {
    amount: 1.23,
    date: "05/04/2018",
    merchant: "Test Merchant Name",
    note: "This is a test transaction"
  }
  return mint.createTransaction(createRequest)
}

function getTransactions(mint) {
  let getTransactionsRequest = {
    query: [
      "Test Merchant Name"
    ],
    startDate: new Date(2018, 4),
    endDate: new Date(2018, 6)
  }
  return mint.getTransactions(getTransactionsRequest)
}

function editTransaction(mint, tnx) {
  let editTransactionRequest = {
    id: tnx[0].id,
    merchant: "New Test Merchant Name",
    category: "Vacation",
    categoryId: 1504,
    date: "05/05/2018"
  }
  return mint.editTransaction(editTransactionRequest)
}

function deleteTransaction(mint, transactions) {
  return mint.deleteTransaction(transactions[0].id)
}
