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
