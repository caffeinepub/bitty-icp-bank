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
    proposalId: bigint;
}
export interface Announcement {
    id: bigint;
    title: string;
    body: string;
    timestamp: bigint;
}
export interface Vote {
    weight: bigint;
    optionIndex: bigint;
    proposalId: bigint;
    voterPrincipal: string;
}
export interface Proposal {
    id: bigint;
    startTime: bigint;
    title: string;
    endTime: bigint;
    description: string;
    isOpen: boolean;
    options: Array<string>;
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
    addChatMessage(proposalId: bigint, author: string, message: string): Promise<ChatMessage | null>;
    adminLogin(password: string): Promise<boolean>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    castVote(proposalId: bigint, voterPrincipal: string, optionIndex: bigint, weight: bigint): Promise<boolean>;
    closeProposal(password: string, proposalId: bigint): Promise<boolean>;
    createProposal(password: string, title: string, description: string, options: Array<string>): Promise<Proposal | null>;
    deleteAnnouncement(password: string, id: bigint): Promise<boolean>;
    getAnnouncements(): Promise<Array<Announcement>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getChatMessages(proposalId: bigint): Promise<Array<ChatMessage>>;
    getManualBalances(): Promise<{
        icp: string;
        fund: string;
        bittyPriceUsd: string;
        bitty: string;
    }>;
    getProposals(): Promise<Array<Proposal>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    getVotesForProposal(proposalId: bigint): Promise<Array<Vote>>;
    hasVoted(proposalId: bigint, voterPrincipal: string): Promise<boolean>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    setManualBalances(password: string, icp: string, bitty: string): Promise<boolean>;
    setManualBittyPrice(password: string, price: string): Promise<boolean>;
    setManualFundBalance(password: string, fund: string): Promise<boolean>;
    updateAnnouncement(password: string, id: bigint, title: string, body: string): Promise<boolean>;
}
