import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface ChatMessage {
    id: bigint;
    author: string;
    message: string;
    timestamp: bigint;
    voteId: bigint;
}
export interface Announcement {
    id: bigint;
    title: string;
    body: string;
    timestamp: bigint;
}
export type VoteType = { ICP: null } | { BITTYICP: null };
export interface MonthlyVote {
    id: bigint;
    voteType: VoteType;
    month: bigint;
    year: bigint;
    openTime: bigint;
    closeTime: bigint;
    isFinalized: boolean;
    totalVoteAmount: string;
}
export interface VoteAllocation {
    voteId: bigint;
    voterPrincipal: string;
    pctA: bigint;
    pctB: bigint;
    pctC: bigint;
    votingPower: bigint;
}
export interface RewardsPoolEntry {
    voteId: bigint;
    voteType: VoteType;
    losingOptionLabel: string;
    losingOptionPct: bigint;
    poolAmount: string;
    distributed: boolean;
}
export interface VoteResult {
    optionLabel: string;
    totalWeightedPct: bigint;
    voterCount: bigint;
}
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addAnnouncement(password: string, title: string, body: string): Promise<Announcement | null>;
    addChatMessage(voteId: bigint, author: string, message: string): Promise<ChatMessage | null>;
    adminLogin(password: string): Promise<boolean>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    castSplitVote(voteId: bigint, voterPrincipal: string, pctA: bigint, pctB: bigint, pctC: bigint, votingPower: bigint): Promise<boolean>;
    deleteAnnouncement(password: string, id: bigint): Promise<boolean>;
    finalizeVote(password: string, voteId: bigint): Promise<boolean>;
    getActiveVotes(): Promise<Array<MonthlyVote>>;
    getAllVotes(): Promise<Array<MonthlyVote>>;
    getAdminConfig(): Promise<{ neuronTopupAddress: string; gamesWallet: string }>;
    getAnnouncements(): Promise<Array<Announcement>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getChatMessages(voteId: bigint): Promise<Array<ChatMessage>>;
    getManualBalances(): Promise<{ icp: string; fund: string; bittyPriceUsd: string; bitty: string }>;
    getRewardsPools(): Promise<Array<RewardsPoolEntry>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getVoteAllocations(voteId: bigint): Promise<Array<VoteAllocation>>;
    getVoteResults(voteId: bigint): Promise<Array<VoteResult>>;
    hasVotedOnVote(voteId: bigint, voterPrincipal: string): Promise<boolean>;
    isCallerAdmin(): Promise<boolean>;
    markRewardsDistributed(password: string, voteId: bigint): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    setGamesWallet(password: string, addr: string): Promise<boolean>;
    setManualBalances(password: string, icp: string, bitty: string): Promise<boolean>;
    setManualBittyPrice(password: string, price: string): Promise<boolean>;
    setManualFundBalance(password: string, fund: string): Promise<boolean>;
    setNeuronTopupAddress(password: string, addr: string): Promise<boolean>;
    setVoteAmount(password: string, voteId: bigint, amount: string): Promise<boolean>;
    verifyExternalWallet(externalWallet: string): Promise<{ ok: null } | { err: string }>;
    initWalletVerification(externalWallet: string): Promise<{ ok: bigint } | { err: string }>;
    confirmWalletVerification(externalWallet: string): Promise<{ ok: null } | { err: string }>;
    getMyVerifiedWallets(): Promise<string[]>;
    isExternalWalletClaimed(wallet: string): Promise<boolean>;
    getWalletOwner(wallet: string): Promise<string | null>;
    updateAnnouncement(password: string, id: bigint, title: string, body: string): Promise<boolean>;
}
