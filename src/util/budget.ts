import { PepperMint } from "../core";
import { IBudgetQuery, IMintBudget, isLastNMonthsQuery } from "../model/budget";
import { IMintCategory } from "../model/category";

import { IClock } from "./clock";
import { firstDayOfNextMonth } from "./date";

function formatBudgetQueryDate(d: Date) {
    return (d.getMonth() + 1)
        + "/" + d.getDate()
        + "/" + d.getFullYear();
}

export function formatBudgetQuery(
    clock: IClock,
    query: IBudgetQuery | Date,
) {
    let start: Date;
    let end: Date;

    if (query instanceof Date) {
        start = new Date(query.getFullYear(), query.getMonth());
        end = firstDayOfNextMonth(query);
    } else if (isLastNMonthsQuery(query)) {
        if (query.months <= 0) {
            throw new Error("Invalid `months` argument: " + query.months);
        }

        const now = clock.now();
        end = firstDayOfNextMonth(now);

        // there may be a way to do this without a loop,
        // but this is simple and understandable, and even if
        // someone requests 100 years of data, this won't take too long.
        let startYear = end.getFullYear();
        let startMonth = end.getMonth() - query.months;
        while (startMonth < 0) {
            --startYear;
            startMonth += 12;
        }

        start = new Date(startYear, startMonth);
    } else {
        start = query.start;
        end = query.end;
    }

    return {
        startDate: formatBudgetQueryDate(start),
        endDate: formatBudgetQueryDate(end),
        rnd: clock.now().getTime(),
    };
}

export function budgetForKey(
    mint: PepperMint,
    categories: IMintCategory[],
    data: any,
    budgetKey: string,
): IMintBudget {
    const income = data.income[budgetKey];
    const spending = data.spending[budgetKey];

    for (const budgetSet of [ income.bu, spending.bu, income.ub, spending.ub ]) {
        for (const budget of budgetSet) {
            budget.category = mint.getCategoryNameById(
                categories,
                budget.cat
            );
        }
    }

    return {
        income: income.bu,
        spending: spending.bu,
        unbudgeted: {
            income: income.ub,
            spending: spending.ub,
        },
    };
}
