export interface IMintTransactionQuery {
    accountId?: number;
    category?: number | { id: number };
    offset?: number;
    query?: string | string[];

    startDate?: Date;
    endDate?: Date;
}

export interface IMintTransaction {
    /** ex: 'Feb 11' */
    date: string;
    note: string;
    isPercent: boolean;
    fi: string;
    txnType: number;
    /** or -1 */
    numberMatchedByRule: number;
    isEdited: boolean;
    isPending: boolean;
    mcategory: string;
    isMatched: boolean;
    /** ex: 'Feb 11' */
    odate: string;
    isFirstDate: boolean;
    id: number;
    isDuplicate: boolean;
    hasAttachments: boolean;
    isChild: boolean;
    isSpending: boolean;
    /** ex: '$45.00' */
    amount: string;
    ruleCategory: string;
    userCategoryId: number | null;
    isTransfer: boolean;
    isAfterFiCreationTime: boolean;
    merchant: string;
    manualType: number;
    labels: [];
    mmerchant: string;
    isCheck: boolean;
    /** "original merchant name" */
    omerchant: string;
    isDebit: boolean;
    category: string;
    ruleMerchant: string;
    isLinkedToRule: boolean;
    account: string;
    categoryId: number;
    ruleCategoryId: number;
}

export interface INewTransaction {
    /** Apparently ignored, but good to have, I guess? */
    accountId?: number;
    amount: 4.2;

    /** If not provided, the txn will show up as UNCATEGORIZED */
    category?: {
        id: number;
        name: string;
    };

    /** If a string, use format: "MM/DD/YYYY" */
    date: string | Date;

    isExpense: boolean;
    isInvestment: boolean;

    /** Merchant name */
    merchant: string;
    note?: string;

    /** set of IDs */
    tags?: number[];
}

export interface ITransactionEdit {
    id: number;

    /** EX: 'Bills & Utilities' */
    category: string;
    categoryId: number;
    date: string | Date;
    merchant: string;
}
