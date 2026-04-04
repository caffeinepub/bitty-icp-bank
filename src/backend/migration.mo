import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";

module {
  type OldProposal = {
    id : Nat;
    title : Text;
    description : Text;
    options : [Text];
    startTime : Int;
    endTime : Int;
    isOpen : Bool;
  };

  type OldVote = {
    proposalId : Nat;
    voterPrincipal : Text;
    optionIndex : Nat;
    weight : Nat;
  };

  type OldChatMessage = {
    id : Nat;
    proposalId : Nat;
    author : Text;
    message : Text;
    timestamp : Int;
  };

  type Announcement = {
    id : Nat;
    title : Text;
    body : Text;
    timestamp : Int;
  };

  type ChatMessage = {
    id : Nat;
    voteId : Nat;
    author : Text;
    message : Text;
    timestamp : Int;
  };

  type UserProfile = {
    name : Text;
  };

  type VoteType = { #ICP; #BITTYICP };

  type MonthlyVote = {
    id : Nat;
    voteType : VoteType;
    month : Nat;
    year : Nat;
    openTime : Int;
    closeTime : Int;
    isFinalized : Bool;
    totalVoteAmount : Text;
  };

  type VoteAllocation = {
    voteId : Nat;
    voterPrincipal : Text;
    pctA : Nat;
    pctB : Nat;
    pctC : Nat;
    votingPower : Nat;
  };

  type RewardsPoolEntry = {
    voteId : Nat;
    voteType : VoteType;
    losingOptionLabel : Text;
    losingOptionPct : Nat;
    poolAmount : Text;
    distributed : Bool;
  };

  type CustomProposal = {
    id : Nat;
    title : Text;
    description : Text;
    voteType : VoteType;
    options : [Text];
    openTime : Int;
    closeTime : Int;
    isFinalized : Bool;
    totalVoteAmount : Text;
  };

  type CustomProposalMeta = {
    proposalId : Nat;
    voteAmount : Text;
    destinationAddress : Text;
  };

  type CustomOptionAlloc = {
    optionIndex : Nat;
    pct : Nat;
  };

  type CustomVoteAllocation = {
    proposalId : Nat;
    voterPrincipal : Text;
    allocations : [CustomOptionAlloc];
    votingPower : Nat;
  };

  type CustomRewardsPoolEntry = {
    proposalId : Nat;
    voteType : VoteType;
    losingOptionLabel : Text;
    losingOptionPct : Nat;
    poolAmount : Text;
    distributed : Bool;
  };

  type RewardTransaction = {
    id : Nat;
    recipient : Text;
    amount : Nat;
    tokenType : VoteType;
    timestamp : Int;
    voteTitle : Text;
    voteId : Nat;
    proposalId : Nat;
  };

  type PendingDistribution = {
    isCustom : Bool;
    voteId : Nat;
    proposalId : Nat;
    voteType : VoteType;
    amountNeeded : Text;
    title : Text;
  };

  type OldActor = {
    WALLET_PRINCIPAL : Text;
    FUND_WALLET_PRINCIPAL : Text;
    ICP_LEDGER_ID : Text;
    BITTY_LEDGER_ID : Text;
    nextProposalId : Nat;
    proposals : [OldProposal];
    votes : [OldVote];
    chatMessages : [OldChatMessage];
    announcements : [Announcement];
    nextAnnouncementId : Nat;
    nextVoteId : Nat;
    nextChatId : Nat;
    monthlyVotes : [MonthlyVote];
    voteAllocations : [VoteAllocation];
    voteMessages : [ChatMessage];
    rewardsPools : [RewardsPoolEntry];
    manualICP : Text;
    manualBITTY : Text;
    manualFund : Text;
    manualBittyPriceUSD : Text;
    neuronTopupAddress : Text;
    gamesWallet : Text;
    customProposals : [CustomProposal];
    nextCustomProposalId : Nat;
    customVoteAllocations : [CustomVoteAllocation];
    customRewardsPools : [CustomRewardsPoolEntry];
    customProposalMeta : [CustomProposalMeta];
    rewardTransactions : [RewardTransaction];
    nextRewardTxId : Nat;
    pendingDistributions : [PendingDistribution];
    verifiedWalletOwners : [(Text, Text)];
    userVerifiedWallets : [(Text, [Text])];
    pendingVerifications : [(Text, Text, Nat)];
  };

  type NewActor = OldActor and {
    heartbeatCount : Nat;
  };

  public func run(old : OldActor) : NewActor {
    { old with heartbeatCount = 0 };
  };
};
