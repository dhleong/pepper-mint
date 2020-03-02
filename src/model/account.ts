export type Status = "1" | "3"; // ?

export interface IMintAccount {
    linkedAccountId: string | null;
    accountName: string;
    addAccountDate: number;
    fiLoginDisplayName: string;
    ccAggrStatus: number;
    exclusionType: string;
    linkedAccount: string | null;
    isHiddenFromPlanningTrends: boolean;
    isTerminal: boolean;
    linkCreationTime: number | null;
    isActive: boolean;
    accountStatus: Status;
    accountSystemStatus: "ACTIVE" | "DEAD";
    lastUpdated: number;
    fiLastUpdated: number;
    yodleeAccountNumberLast4: string;
    isError: boolean;
    fiName: string;
    isAccountNotFound: boolean;
    klass: "bank" | "credit" | "invest" | "loan";
    possibleLinkAccounts: [];
    lastUpdatedInString: string;
    accountTypeInt: number;
    currency: string;
    id: number;
    isHostAccount: boolean;
    value: number;
    fiLoginId: number;
    usageType: "PERSONAL" | null;
    interestRate: number;
    accountType: "bank" | "credit" | "investment" | "loan";
    currentBalance: number;
    fiLoginStatus: "OK";
    isAccountClosedByMint: boolean;

    /** IE: the user's preferred name for the account */
    userName: string | null;
    yodleeName: string;
    closeDate: number;
    linkStatus: "NOT_LINKED";
    accountId: number;
    isClosed: boolean;
    fiLoginUIStatus: "OK" | "FAILED" | "FAILED_NEW_MFA_CHALLENGE_REQUIRED";
    yodleeAccountId: number;
    name: string;
    status: Status;
}
