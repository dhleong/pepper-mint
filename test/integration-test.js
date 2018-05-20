let chai = require('chai');
let PepperMint = require('../index');

chai.should();

try {
    var config = require('./integration-config.json');
} catch (e) {
    // no config; don't run tests
}

if (config) {
    describe('pepper-mint', function() {
        describe('handles editing transactions', function() {
            it('verifies fields have changed after editing', async function() {
                this.timeout(30000);
                let mint = await PepperMint(config.username, config.password, config.ius_session, config.thx_guid);
                await createTransaction(mint);
                let originalTransaction = (await getTransactions(mint))[0];

                let transactionUpdates = getTransactionUpdates(originalTransaction);
                await editTransactionWithUpdates(mint, transactionUpdates);
                let updatedTransaction = (await getTransactions(mint))[0];

                await deleteTransaction(mint, updatedTransaction);

                await doAssertionsWithUpdates(updatedTransaction, transactionUpdates);
            });
            it('verifies undefined fields when updating will not be cleared after editing', async function() {
                this.timeout(30000);
                let mint = await PepperMint(config.username, config.password, config.ius_session, config.thx_guid);
                await createTransaction(mint);
                let originalTransaction = (await getTransactions(mint))[0];

                let transactionUpdates = getTransactionUpdates(originalTransaction);
                setAllOptionalFieldsUndefined(transactionUpdates);

                await editTransactionWithUpdates(mint, transactionUpdates);
                let updatedTransaction = (await getTransactions(mint))[0];

                await deleteTransaction(mint, updatedTransaction);

                await doAssertions(updatedTransaction, originalTransaction);
            });
            it('verifies empty fields when updating will not be cleared after editing', async function() {
                this.timeout(30000);
                let mint = await PepperMint(config.username, config.password, config.ius_session, config.thx_guid);
                await createTransaction(mint);
                let originalTransaction = (await getTransactions(mint))[0];

                let transactionUpdates = getTransactionUpdates(originalTransaction);
                setAllFieldsEmpty(transactionUpdates);

                await editTransactionWithUpdates(mint, transactionUpdates);
                let updatedTransaction = (await getTransactions(mint))[0];

                await deleteTransaction(mint, updatedTransaction);

                await doAssertions(updatedTransaction, originalTransaction);
            })
        });
    });
}

function doAssertions(updatedTransaction, originalTransaction) {
    updatedTransaction.merchant.should.equal(originalTransaction.merchant);
    updatedTransaction.category.should.equal(originalTransaction.category);
    updatedTransaction.categoryId.should.equal(originalTransaction.categoryId);
    updatedTransaction.date.should.equal(originalTransaction.date);
    updatedTransaction.note.should.equal(originalTransaction.note);
}

function doAssertionsWithUpdates(updatedTransaction, transactionUpdates) {
    updatedTransaction.merchant.should.equal(transactionUpdates.merchant);
    updatedTransaction.category.should.equal(transactionUpdates.category);
    updatedTransaction.categoryId.should.equal(transactionUpdates.categoryId);
    updatedTransaction.date.should.equal(formatDate(transactionUpdates.date));
}

function createTransaction(mint) {
    let createRequest = {
        amount: 1.23,
        date: "05/04/2010",
        merchant: "Test Merchant Name",
        note: "This is a test transaction"
    };
    return mint.createTransaction(createRequest);
}

function getTransactions(mint) {
    let getTransactionsRequest = {
        query: [
            "Test Merchant Name"
        ],
        startDate: new Date(2010, 4),
        endDate: new Date(2010, 6)
    };
    return mint.getTransactions(getTransactionsRequest);
}

function editTransactionWithUpdates(mint, updates) {
    return mint.editTransaction(updates);
}

function getTransactionUpdates(originalTransaction) {
    return {
        id: originalTransaction.id,
        merchant: "New Test Merchant Name",
        category: "Vacation",
        categoryId: 1504,
        date: "05/05/2010"
    };
}

function deleteTransaction(mint, transactions) {
    return mint.deleteTransaction(transactions.id)
}

function setAllFieldsEmpty(transactionUpdates) {
    transactionUpdates.merchant = "";
    transactionUpdates.category = "";
    transactionUpdates.categoryId = "";
    transactionUpdates.date = "";
}

function setAllOptionalFieldsUndefined(transactionUpdates) {
    transactionUpdates.merchant = undefined;
    transactionUpdates.category = undefined;
    transactionUpdates.categoryId = undefined;
    // Date is a required field
    transactionUpdates.date = "";
}

function formatDate(currentYearStyledDate) {
    let date = new Date(currentYearStyledDate);
    let year = date.getFullYear().toString().slice(2);
    let month = padLeadingZero(date.getMonth() + 1);
    let day = padLeadingZero(date.getDate());
    return `${month}/${day}/${year}`
}

function padLeadingZero(number) {
    return `0${number.toString()}`.slice(-2);
}
