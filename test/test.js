var assert = require('assert');
var PepperMint = require('../index.js');

try {
    var config = require('./config.json');
} catch (e) {
    // no config; don't run tests
}

if (config) {
    describe('pepper-mint', function() {
        describe('#Prepare(email, password, cookie)', function () {
            it('should login successfully', function () {
                this.timeout(30000);
                return PepperMint(config.username, config.password, config.cookie).then(mint => {
                    assert.notEqual(null, mint);
                }).fail(err => {
                    if (err) throw err;
                });
            });
        });
        describe('#getTransactions()', function () {
            it('should return list of transactions', function () {
                this.timeout(30000);
                return PepperMint(config.username, config.password, config.cookie).then(mint => {
                    return mint.getTransactions().then(transactions => {
                        assert.notEqual(null, transactions);
                        assert.notEqual(0, transactions.length);
                    });
                }).fail(err => {
                    if (err) throw err;
                });
            });
        });
    });
}
