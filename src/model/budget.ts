export interface IBudgetRangeQuery {
    start: Date;
    end: Date;
}

export interface IBudgetLastNMonthsQuery {
    months: number;
}

export type IBudgetQuery = IBudgetRangeQuery | IBudgetLastNMonthsQuery;

export function isLastNMonthsQuery(query: IBudgetQuery): query is IBudgetLastNMonthsQuery {
    const { months } = query as any;
    return typeof months === "number";
}

export interface IMintBudgetItem {
    /** rollover spending */
    ramt: number;

    /**
     * total spent amount, including [ramt]. The amount *actually spent*
     * during the month this BudgetItem belongs to is:
     *
     *  amt - ramt
     */
    amt: number;

    /** budgeted amount */
    bgt: number;

    /** rollover balance */
    rbal: number;
    ex: boolean;
    id: number;
    pid: number;
    st: number;
    type: number;

    /** ex: 'Personal' */
    catTypeFilter: string;

    /** the category name, as per getCategoryNameById */
    category: string;
    cat: number;

    isIncome: boolean;
    isTransfer: boolean;
    isExpense: boolean;
}

export type IMintBudgetData = IMintBudgetItem[];

export interface IMintBudget {
    income: IMintBudgetData;
    spending: IMintBudgetData;
    unbudgeted: {
        income: IMintBudgetData;
        spending: IMintBudgetData;
    };
}
