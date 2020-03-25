import * as chai from "chai";

import { formatBudgetQuery } from "../../src/util/budget";
import { IClock } from "../../src/util/clock";

chai.should();

class FixedClock implements IClock {
    constructor(
        private readonly date: Date,
    ) {}

    public now() {
        return this.date;
    }
}

const clock = new FixedClock(
    new Date(2017, 7, 27), // aug 27
);

describe('pepper-mint', function() {
    describe('getBudgets arg parsing', function() {

        it('handles default "this month"', function() {
            var args = formatBudgetQuery(clock, clock.now());

            args.startDate.should.equal("8/1/2017");
            args.endDate.should.equal("9/1/2017");
        });

        it('handles a single month', function() {
            var args = formatBudgetQuery(clock, new Date(2017, 4, 22));

            args.startDate.should.equal("5/1/2017");
            args.endDate.should.equal("6/1/2017");
        });

        it('handles simple months option', function() {
            var args = formatBudgetQuery(clock, {
                months: 1
            });

            args.startDate.should.equal("8/1/2017");
            args.endDate.should.equal("9/1/2017");
        });

        it('errors on invalid months option', function() {
            (function() {
                formatBudgetQuery(clock, {months: 0});
            }).should.throw("Invalid `months`");
        });

        it('handles months option crossing year boundary *back*', function() {
            var args = formatBudgetQuery(clock, {
                months: 9
            });

            args.startDate.should.equal("12/1/2016");
            args.endDate.should.equal("9/1/2017");
        });

        it('handles months option crossing year boundary *forward*', function() {
            const clock1 = new FixedClock(new Date(2017, 11, 27)); // dec 27
            var args = formatBudgetQuery(clock1, {
                months: 2
            });

            args.startDate.should.equal("11/1/2017");
            args.endDate.should.equal("1/1/2018");

            const clock2 = new FixedClock(new Date(2018, 0, 7)); // jan 27
            var args = formatBudgetQuery(clock2, {
                months: 2
            });

            args.startDate.should.equal("12/1/2017");
            args.endDate.should.equal("2/1/2018");
        });
    });
});

