import { ActorSubclass } from '@dfinity/agent';

export interface Announcement {
  id: bigint;
  title: string;
  body: string;
  timestamp: bigint;
}

export interface ManualBalances {
  icp: string;
  bitty: string;
  fund: string;
  bittyPriceUsd: string;
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

export interface VoteResult {
  optionLabel: string;
  totalWeightedPct: bigint;
  voterCount: bigint;
}

export interface RewardsPoolEntry {
  voteId: bigint;
  voteType: VoteType;
  losingOptionLabel: string;
  losingOptionPct: bigint;
  poolAmount: string;
  distributed: boolean;
}

export interface ChatMessage {
  id: bigint;
  voteId: bigint;
  author: string;
  message: string;
  timestamp: bigint;
}

export interface CustomProposal {
  id: bigint;
  title: string;
  description: string;
  voteType: VoteType;
  options: string[];
  openTime: bigint;
  closeTime: bigint;
  isFinalized: boolean;
  totalVoteAmount: string;
}

export interface CustomProposalMeta {
  proposalId: bigint;
  voteAmount: string;
  destinationAddress: string;
}

export interface CustomOptionAlloc {
  optionIndex: bigint;
  pct: bigint;
}

export interface CustomVoteAllocation {
  proposalId: bigint;
  voterPrincipal: string;
  allocations: CustomOptionAlloc[];
  votingPower: bigint;
}

export interface CustomVoteResult {
  optionLabel: string;
  optionIndex: bigint;
  totalWeightedPct: bigint;
  voterCount: bigint;
}

export interface CustomRewardsPoolEntry {
  proposalId: bigint;
  voteType: VoteType;
  losingOptionLabel: string;
  losingOptionPct: bigint;
  poolAmount: string;
  distributed: boolean;
}

export interface AdminConfig {
  neuronTopupAddress: string;
  gamesWallet: string;
}

export interface RewardTransaction {
  id: bigint;
  recipient: string;
  amount: bigint;
  tokenType: VoteType;
  timestamp: bigint;
  voteTitle: string;
  voteId: bigint;
  proposalId: bigint;
}

export interface DistributeResult {
  success: boolean;
  transferCount: bigint;
  errors: string[];
}

export interface CanisterBalance {
  icpE8s: bigint;
  bittyE8s: bigint;
}

export interface PendingDistribution {
  isCustom: boolean;
  voteId: bigint;
  proposalId: bigint;
  voteType: VoteType;
  amountNeeded: string;
  title: string;
}

export interface TotalRewardsDistributed {
  totalICP: bigint;
  totalBITTY: bigint;
}

export interface _SERVICE {
  adminLogin: (password: string) => Promise<boolean>;
  getManualBalances: () => Promise<ManualBalances>;
  setManualBalances: (password: string, icp: string, bitty: string) => Promise<boolean>;
  setManualFundBalance: (password: string, fund: string) => Promise<boolean>;
  setManualBittyPrice: (password: string, price: string) => Promise<boolean>;
  getAnnouncements: () => Promise<Announcement[]>;
  addAnnouncement: (password: string, title: string, body: string) => Promise<[] | [Announcement]>;
  updateAnnouncement: (password: string, id: bigint, title: string, body: string) => Promise<boolean>;
  deleteAnnouncement: (password: string, id: bigint) => Promise<boolean>;
  // Monthly votes
  getActiveVotes: () => Promise<MonthlyVote[]>;
  getAllVotes: () => Promise<MonthlyVote[]>;
  castSplitVote: (voteId: bigint, voterPrincipal: string, pctA: bigint, pctB: bigint, pctC: bigint, votingPower: bigint) => Promise<boolean>;
  hasVotedOnVote: (voteId: bigint, voterPrincipal: string) => Promise<boolean>;
  getVoteAllocations: (voteId: bigint) => Promise<VoteAllocation[]>;
  getVoteResults: (voteId: bigint) => Promise<VoteResult[]>;
  setVoteAmount: (password: string, voteId: bigint, amount: string) => Promise<boolean>;
  setVoteAmountFromTreasury: (password: string, voteId: bigint, amount: string) => Promise<boolean>;
  finalizeVote: (password: string, voteId: bigint) => Promise<boolean>;
  markRewardsDistributed: (password: string, voteId: bigint) => Promise<boolean>;
  distributeRewards: (password: string, voteId: bigint) => Promise<DistributeResult>;
  getRewardsPools: () => Promise<RewardsPoolEntry[]>;
  setNeuronTopupAddress: (password: string, addr: string) => Promise<boolean>;
  setGamesWallet: (password: string, addr: string) => Promise<boolean>;
  getAdminConfig: () => Promise<AdminConfig>;
  // Canister balance
  getCanisterBalance: () => Promise<CanisterBalance>;
  // Pending distributions
  getPendingDistributions: () => Promise<PendingDistribution[]>;
  // Custom proposals
  createCustomProposal: (password: string, title: string, description: string, voteType: VoteType, options: string[], closeTimeNs: bigint, voteAmount: string, destinationAddress: string) => Promise<[] | [CustomProposal]>;
  getCustomProposalMeta: (proposalId: bigint) => Promise<[] | [CustomProposalMeta]>;
  getCustomProposals: () => Promise<CustomProposal[]>;
  castCustomVote: (proposalId: bigint, voterPrincipal: string, allocations: CustomOptionAlloc[], votingPower: bigint) => Promise<boolean>;
  hasVotedOnCustomProposal: (proposalId: bigint, voterPrincipal: string) => Promise<boolean>;
  getCustomVoteAllocations: (proposalId: bigint) => Promise<CustomVoteAllocation[]>;
  getCustomVoteResults: (proposalId: bigint) => Promise<CustomVoteResult[]>;
  setCustomProposalAmount: (password: string, proposalId: bigint, amount: string) => Promise<boolean>;
  finalizeCustomProposal: (password: string, proposalId: bigint) => Promise<boolean>;
  autoFinalizeExpired: () => Promise<void>;
  getCustomRewardsPools: () => Promise<CustomRewardsPoolEntry[]>;
  markCustomRewardsDistributed: (password: string, proposalId: bigint) => Promise<boolean>;
  distributeCustomRewards: (password: string, proposalId: bigint) => Promise<DistributeResult>;
  // Reward transaction history
  getMyRewardTransactions: (principal: string) => Promise<RewardTransaction[]>;
  getAllRewardTransactions: (password: string) => Promise<RewardTransaction[]>;
  getTotalRewardsDistributed: () => Promise<TotalRewardsDistributed>;
  // Chat
  addChatMessage: (voteId: bigint, author: string, message: string) => Promise<[] | [ChatMessage]>;
  getChatMessages: (voteId: bigint) => Promise<ChatMessage[]>;
  // Wallet verification
  initWalletVerification: (externalWallet: string) => Promise<{ ok: bigint } | { err: string }>;
  confirmWalletVerification: (externalWallet: string) => Promise<{ ok: null } | { err: string }>;
  getMyVerifiedWallets: () => Promise<string[]>;
  isExternalWalletClaimed: (wallet: string) => Promise<boolean>;
  getWalletOwner: (wallet: string) => Promise<[] | [string]>;
  verifyExternalWallet: (externalWallet: string) => Promise<{ ok: null } | { err: string }>;
  adminResetVerifiedWallets: (password: string) => Promise<boolean>;
  unverifyWallet: (externalWallet: string) => Promise<boolean>;
}

export declare const createActor: (canisterId: string) => ActorSubclass<_SERVICE>;
export declare const canisterId: string;
