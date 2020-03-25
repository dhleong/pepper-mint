/** ex: '2019-10-29T20:57:26Z' */
type IProviderDate = string;

export interface IMintProviderMetadata {
    createdDate: IProviderDate;
    lastUpdatedDate: IProviderDate;
    link: any[];
}

export interface IMintProviderAccountBase {
    metaData: IMintProviderMetadata;
    id: string;
    domain: string;
    domainIds: { domain: string; id: string }[];
    name: string;
    cpId: string;
    accountStatus: "ACTIVE" | "CLOSED";
    accountNumberLast4: string;
    currentBalance: number;
    value: number;
    isVisible: boolean;
    isDeleted: boolean;
    planningTrendsVisible: boolean;
    /** EX: 'USD' */
    currency: string;
    accountTypeInt: number;
    isAccountClosedByMint: boolean;
    isAccountNotFound: boolean;
    isActive: boolean;
    hostAccount: boolean;
    isClosed: boolean;
    isError: boolean;
    isHiddenFromPlanningTrends: boolean;
    isTerminal: boolean;
    autoPay: boolean;
    isBillVisible: boolean;
    isPaymentMethodVisible: boolean;
    isEmailNotificationEnabled: boolean;
    isPushNotificationEnabled: boolean;
    systemStatus: "ACTIVE";
    accountStatusCode: string;
}

export interface IMintProviderBankAccount extends IMintProviderAccountBase {
    type: "BankAccount";
    bankAccountType: "CHECKING" | "SAVINGS";
    availableBalance: number;
    interestRate: number;
    cpInterestRate: number;
    minimumNoFeeBalance: number;
    userMinimumNoFeeBalance: number;
    monthlyFee: number;
    userMonthlyFee: number;
    userFreeBillPay: boolean;
    userAtmFeeReimbursement: boolean;
    numOfTransactions: number;
}

export interface IMintProviderCreditAccount extends IMintProviderAccountBase {
    type: "CreditAccount";
    userCardType: "UNKNOWN" | "VISA";
    creditAccountType: "CREDIT_CARD" | "UNKNOWN";
    creditLimit: number;
    availableCredit: number;
    interestRate: number;
    userRewardsType: "MILES" | "POINTS";
    rewardsRate: number;
    annualFee: number;
    minPayment: number;
    absoluteMinPayment: number;
    statementMinPayment: number;
    statementDueAmount: number;
}

export interface IMintProviderInvestmentAccount extends IMintProviderAccountBase {
    type: "InvestmentAccount";
    investmentType: "TAXABLE";
    dormant401K: boolean;
}

export interface IMintProviderLoanAccount extends IMintProviderAccountBase {
    type: "LoanAccount";
    loanType: "LOAN";
    loanTermType: "OTHER";
    loanInterestRateType: "OTHER";
    amountDue: number;
    originalLoanAmount: number;
    principalBalance: number;
    interestRate: number;
    minPayment: number;
    absoluteMinPayment: number;
    statementMinPayment: number;
    statementDueAmount: number;
    statementDueDate: IProviderDate;
}

export type IMintProviderAccount =
    IMintProviderBankAccount
    | IMintProviderCreditAccount
    | IMintProviderInvestmentAccount
    | IMintProviderLoanAccount;

export interface IMintProvider {
    metaData: IMintProviderMetadata;
    id: string;
    cpProviderId: string;
    domainIds: [];
    name: string;
    type: "FINANCIAL";
    lastSuccessfulRefreshTime: IProviderDate;
    /** ex: '1 day' */
    lastUpdatedInString: string;
    providerStatus: {
        status: 'OK' | "FAILED_NEW_MFA_CHALLENGE_REQUIRED" | "FAILED_UNKNOWN_CAUSE";
        statusCode: number;
        statusIsTerminal: boolean;
        lastStatusUpdateTime: IProviderDate;
    };
    secondaryRunningStatus: 'NOT_RUNNING';
    contentProvider: {
        /** ex: 'INTUIT_FDS' */
        name: string;
        status: string;
        statusMessage: string;
    };
    providerAccounts: IMintProviderAccount[];
    staticProviderRef: {
        id: string;
        legacyId: string;
        name: string;
        mfaEnabled: boolean;
        mfaType: "IMAGE" | "NON_MFA" | "UNKNOWN";
        supportsLinkedBills: boolean;
        durableDataEnabled: boolean;
        recaptchaRequired: boolean;
        accountEntitlementEnabled: boolean;
        logos: [];
        channels: [];
        supplementalMessage: '';
        supplementalMessageUrl: '';
        helpInfo: any;
        contacts: any;
        websites: any;
        providerCategories: any;
    };
    durableDataEnabled: boolean;
    recaptchaRequired: boolean;
    fdpEnabled: boolean;
}
