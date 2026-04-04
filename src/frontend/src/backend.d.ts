import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface CustomVoteAllocation {
    votingPower: bigint;
    allocations: Array<CustomOptionAlloc>;
    proposalId: bigint;
    voterPrincipal: string;
}
export interface CustomVoteResult {
    optionLabel: string;
    totalWeightedPct: bigint;
    optionIndex: bigint;
    voterCount: bigint;
}
export interface CustomOptionAlloc {
    pct: bigint;
    optionIndex: bigint;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface CustomRewardsPoolEntry {
    distributed: boolean;
    voteType: VoteType;
    losingOptionPct: bigint;
    losingOptionLabel: string;
    proposalId: bigint;
    poolAmount: string;
}
export interface VoteResult {
    optionLabel: string;
    totalWeightedPct: bigint;
    voterCount: bigint;
}
export interface RewardsPoolEntry {
    distributed: boolean;
    voteType: VoteType;
    voteId: bigint;
    losingOptionPct: bigint;
    losingOptionLabel: string;
    poolAmount: string;
}
export interface MonthlyVote {
    id: bigint;
    month: bigint;
    closeTime: bigint;
    voteType: VoteType;
    totalVoteAmount: string;
    year: bigint;
    isFinalized: boolean;
    openTime: bigint;
}
export interface http_header {
    value: string;
    name: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface VoteAllocation {
    votingPower: bigint;
    pctA: bigint;
    pctB: bigint;
    pctC: bigint;
    voteId: bigint;
    voterPrincipal: string;
}
export interface RewardTransaction {
    id: bigint;
    recipient: string;
    voteId: bigint;
    timestamp: bigint;
    tokenType: VoteType;
    amount: bigint;
    voteTitle: string;
    proposalId: bigint;
}
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface Announcement {
    id: bigint;
    title: string;
    body: string;
    timestamp: bigint;
}
export interface ChatMessage {
    id: bigint;
    voteId: bigint;
    author: string;
    message: string;
    timestamp: bigint;
}
export interface CustomProposalMeta {
    destinationAddress: string;
    voteAmount: string;
    proposalId: bigint;
}
export interface CustomProposal {
    id: bigint;
    title: string;
    closeTime: bigint;
    voteType: VoteType;
    totalVoteAmount: string;
    description: string;
    isFinalized: boolean;
    options: Array<string>;
    openTime: bigint;
}
export interface PendingDistribution {
    title: string;
    voteType: VoteType;
    voteId: bigint;
    amountNeeded: string;
    isCustom: boolean;
    proposalId: bigint;
}
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum VoteType {
    ICP = "ICP",
    BITTYICP = "BITTYICP"
}
export interface backendInterface {
    addAnnouncement(password: string, title: string, body: string): Promise<Announcement | null>;
    addChatMessage(voteId: bigint, author: string, message: string): Promise<ChatMessage | null>;
    adminLogin(password: string): Promise<boolean>;
    adminResetVerifiedWallets(password: string): Promise<boolean>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    autoFinalizeExpired(): Promise<void>;
    castCustomVote(proposalId: bigint, voterPrincipal: string, allocations: Array<CustomOptionAlloc>, votingPower: bigint): Promise<boolean>;
    castSplitVote(voteId: bigint, voterPrincipal: string, pctA: bigint, pctB: bigint, pctC: bigint, votingPower: bigint): Promise<boolean>;
    confirmWalletVerification(externalWallet: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createCustomProposal(password: string, title: string, description: string, voteType: VoteType, options: Array<string>, closeTimeNs: bigint, voteAmount: string, destinationAddress: string): Promise<CustomProposal | null>;
    deleteAnnouncement(password: string, id: bigint): Promise<boolean>;
    distributeCustomRewards(password: string, proposalId: bigint): Promise<{
        errors: Array<string>;
        success: boolean;
        transferCount: bigint;
    }>;
    distributeRewards(password: string, voteId: bigint): Promise<{
        errors: Array<string>;
        success: boolean;
        transferCount: bigint;
    }>;
    finalizeCustomProposal(password: string, proposalId: bigint): Promise<boolean>;
    finalizeVote(password: string, voteId: bigint): Promise<boolean>;
    getActiveVotes(): Promise<Array<MonthlyVote>>;
    getAdminConfig(): Promise<{
        gamesWallet: string;
        neuronTopupAddress: string;
    }>;
    getAllRewardTransactions(password: string): Promise<Array<RewardTransaction>>;
    getAllVotes(): Promise<Array<MonthlyVote>>;
    getAnnouncements(): Promise<Array<Announcement>>;
    getBittyUsdPrice(): Promise<string>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getCanisterBalance(): Promise<{
        icpE8s: bigint;
        bittyE8s: bigint;
    }>;
    getChatMessages(voteId: bigint): Promise<Array<ChatMessage>>;
    getCustomProposalMeta(proposalId: bigint): Promise<CustomProposalMeta | null>;
    getCustomProposals(): Promise<Array<CustomProposal>>;
    getCustomRewardsPools(): Promise<Array<CustomRewardsPoolEntry>>;
    getCustomVoteAllocations(proposalId: bigint): Promise<Array<CustomVoteAllocation>>;
    getCustomVoteResults(proposalId: bigint): Promise<Array<CustomVoteResult>>;
    getIcpUsdPrice(): Promise<string>;
    getManualBalances(): Promise<{
        icp: string;
        fund: string;
        bittyPriceUsd: string;
        bitty: string;
    }>;
    getMyRewardTransactions(principal: string): Promise<Array<RewardTransaction>>;
    getMyVerifiedWallets(): Promise<Array<string>>;
    getPendingDistributions(): Promise<Array<PendingDistribution>>;
    getRewardsPools(): Promise<Array<RewardsPoolEntry>>;
    getTotalRewardsDistributed(): Promise<{
        totalICP: bigint;
        totalBITTY: bigint;
    }>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getVoteAllocations(voteId: bigint): Promise<Array<VoteAllocation>>;
    getVoteResults(voteId: bigint): Promise<Array<VoteResult>>;
    getWalletOwner(wallet: string): Promise<string | null>;
    hasVotedOnCustomProposal(proposalId: bigint, voterPrincipal: string): Promise<boolean>;
    hasVotedOnVote(voteId: bigint, voterPrincipal: string): Promise<boolean>;
    initWalletVerification(externalWallet: string): Promise<{
        __kind__: "ok";
        ok: bigint;
    } | {
        __kind__: "err";
        err: string;
    }>;
    isCallerAdmin(): Promise<boolean>;
    isExternalWalletClaimed(wallet: string): Promise<boolean>;
    markCustomRewardsDistributed(password: string, proposalId: bigint): Promise<boolean>;
    markRewardsDistributed(password: string, voteId: bigint): Promise<boolean>;
    retryPendingDistributions(): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    setCustomProposalAmount(password: string, proposalId: bigint, amount: string): Promise<boolean>;
    setGamesWallet(password: string, addr: string): Promise<boolean>;
    setManualBalances(password: string, icp: string, bitty: string): Promise<boolean>;
    setManualBittyPrice(password: string, price: string): Promise<boolean>;
    setManualFundBalance(password: string, fund: string): Promise<boolean>;
    setNeuronTopupAddress(password: string, addr: string): Promise<boolean>;
    setVoteAmount(password: string, voteId: bigint, amount: string): Promise<boolean>;
    setVoteAmountFromTreasury(password: string, voteId: bigint, amount: string): Promise<boolean>;
    transformHttpResponse(input: TransformationInput): Promise<TransformationOutput>;
    unverifyWallet(externalWallet: string): Promise<boolean>;
    updateAnnouncement(password: string, id: bigint, title: string, body: string): Promise<boolean>;
    verifyExternalWallet(externalWallet: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
}
