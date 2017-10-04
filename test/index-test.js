var chai = require('chai');

var PepperMint = require('../index').PepperMint;

chai.should();

var NOW = new Date(2017, 7, 27); // aug 27

function newMint() {
    var mint = new PepperMint();
    mint._now = function() {
        return NOW;
    };
    return mint;
}

describe('pepper-mint', function() {
    describe('getBudgets arg parsing', function() {
        var mint = newMint();

        it('handles default "this month"', function() {
            var args = mint._getBudgetsArgs();

            args.startDate.should.equal("8/1/2017");
            args.endDate.should.equal("9/1/2017");
        });

        it('handles a single month', function() {
            var args = mint._getBudgetsArgs(new Date(2017, 4, 22));

            args.startDate.should.equal("5/1/2017");
            args.endDate.should.equal("6/1/2017");
        });

        it('handles simple months option', function() {
            var args = mint._getBudgetsArgs({
                months: 1
            });

            args.startDate.should.equal("8/1/2017");
            args.endDate.should.equal("9/1/2017");
        });

        it('errors on invalid months option', function() {
            (function() {
                mint._getBudgetsArgs({months: 0});
            }).should.throw("Invalid `months`");
        });

        it('handles months option crossing year boundary', function() {
            var args = mint._getBudgetsArgs({
                months: 9
            });

            args.startDate.should.equal("12/1/2016");
            args.endDate.should.equal("9/1/2017");
        });
    });
});

