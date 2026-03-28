import Array "mo:core/Array";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Map "mo:core/Map";

import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";


actor {
  //------------------------------ Access Control ------------------------------

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  //------------------------------ Legacy Types (upgrade compat) --------------

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

  // Old ChatMessage kept for stable variable compatibility
  type OldChatMessage = {
    id : Nat;
    proposalId : Nat;
    author : Text;
    message : Text;
    timestamp : Int;
  };

  //------------------------------ New Types ------------------------------

  type Announcement = {
    id : Nat;
    title : Text;
    body : Text;
    timestamp : Int;
  };

  // New chat message uses voteId
  type ChatMessage = {
    id : Nat;
    voteId : Nat;
    author : Text;
    message : Text;
    timestamp : Int;
  };

  public type UserProfile = {
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

  type VoteResult = {
    optionLabel : Text;
    totalWeightedPct : Nat;
    voterCount : Nat;
  };

  //------------------------------ State ------------------------------

  // Stable state -- persists across canister upgrades
  stable var WALLET_PRINCIPAL : Text = "ns32b-r2krl-rtozy-ymo6u-7pujx-gr7ff-uhyup-fsm3v-t5ul7-5lj3b-mqe";
  stable var FUND_WALLET_PRINCIPAL : Text = "vqr3d-eby7o-fiwpf-pllu5-yzmxy-4ut67-gnxgr-nfiqw-c3ked-6arfu-zae";
  stable var ICP_LEDGER_ID : Text = "ryjl3-tyaaa-aaaaa-aaaba-cai";
  stable var BITTY_LEDGER_ID : Text = "qroj6-lyaaa-aaaam-qeqta-cai";
  stable var nextProposalId : Nat = 1;
  stable var proposals : [OldProposal] = [];
  stable var votes : [OldVote] = [];
  // Old chat messages (kept for upgrade compat, no longer used)
  stable var chatMessages : [OldChatMessage] = [];

  // New state (stable)
  stable var announcements : [Announcement] = [];
  stable var nextAnnouncementId : Nat = 1;
  stable var nextVoteId : Nat = 1;
  stable var nextChatId : Nat = 1;
  stable var monthlyVotes : [MonthlyVote] = [];
  stable var voteAllocations : [VoteAllocation] = [];
  // New chat messages (voteId-based, stable)
  stable var voteMessages : [ChatMessage] = [];
  stable var rewardsPools : [RewardsPoolEntry] = [];
  stable var manualICP : Text = "";
  stable var manualBITTY : Text = "";
  stable var manualFund : Text = "";
  stable var manualBittyPriceUSD : Text = "";
  stable var neuronTopupAddress : Text = "";
  stable var gamesWallet : Text = "";

  let ADMIN_PASSWORD = "bittybittywhatwhat";

  let userProfiles = Map.empty<Principal, UserProfile>();

  //------------------------------ Time Helpers ------------------------------

  func dateFromSeconds(secs : Int) : (Nat, Nat, Nat) {
    let days = Int.abs(secs) / 86400;
    var y = 1970;
    var remaining = days;
    label yearLoop loop {
      let daysInYear : Nat = if (y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)) 366 else 365;
      if (remaining < daysInYear) break yearLoop;
      remaining -= daysInYear;
      y += 1;
    };
    let isLeap = y % 4 == 0 and (y % 100 != 0 or y % 400 == 0);
    let monthDays : [Nat] = if (isLeap)
      [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    else
      [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var m = 0;
    var rem2 = remaining;
    label monthLoop loop {
      if (m >= 12) break monthLoop;
      if (rem2 < monthDays[m]) break monthLoop;
      rem2 -= monthDays[m];
      m += 1;
    };
    (y, m + 1, rem2 + 1)
  };

  func lastDayOfMonth(month : Nat, year : Nat) : Nat {
    let isLeap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0);
    let days : [Nat] = if (isLeap)
      [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    else
      [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    days[month - 1]
  };

  func secondsForDate(year : Nat, month : Nat, day : Nat) : Int {
    var totalDays : Int = 0;
    var y = 1970;
    while (y < year) {
      let daysInYear : Int = if (y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)) 366 else 365;
      totalDays += daysInYear;
      y += 1;
    };
    let isLeap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0);
    let mDays : [Nat] = if (isLeap)
      [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    else
      [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var m = 0;
    while (m < month - 1) {
      totalDays += mDays[m];
      m += 1;
    };
    totalDays += (day : Int) - 1;
    totalDays * 86400
  };

  //------------------------------ User Profile ------------------------------

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    userProfiles.add(caller, profile);
  };

  //------------------------------ Admin Auth ------------------------------

  public shared ({ caller }) func adminLogin(password : Text) : async Bool {
    if (password == ADMIN_PASSWORD) {
      AccessControl.assignRole(accessControlState, caller, caller, #admin);
      true;
    } else {
      false;
    };
  };

  func isAdmin(password : Text) : Bool {
    password == ADMIN_PASSWORD;
  };

  //------------------------------ Manual Balances ------------------------------

  public query func getManualBalances() : async { icp : Text; bitty : Text; fund : Text; bittyPriceUsd : Text } {
    { icp = manualICP; bitty = manualBITTY; fund = manualFund; bittyPriceUsd = manualBittyPriceUSD };
  };

  public shared func setManualBalances(password : Text, icp : Text, bitty : Text) : async Bool {
    if (not isAdmin(password)) return false;
    manualICP := icp;
    manualBITTY := bitty;
    true;
  };

  public shared func setManualFundBalance(password : Text, fund : Text) : async Bool {
    if (not isAdmin(password)) return false;
    manualFund := fund;
    true;
  };

  public shared func setManualBittyPrice(password : Text, price : Text) : async Bool {
    if (not isAdmin(password)) return false;
    manualBittyPriceUSD := price;
    true;
  };

  //------------------------------ Announcements ------------------------------

  public query func getAnnouncements() : async [Announcement] {
    announcements;
  };

  public shared func addAnnouncement(password : Text, title : Text, body : Text) : async ?Announcement {
    if (not isAdmin(password)) return null;
    let ann : Announcement = {
      id = nextAnnouncementId;
      title = title;
      body = body;
      timestamp = Time.now();
    };
    announcements := announcements.concat([ann]);
    nextAnnouncementId += 1;
    ?ann;
  };

  public shared func updateAnnouncement(password : Text, id : Nat, title : Text, body : Text) : async Bool {
    if (not isAdmin(password)) return false;
    announcements := announcements.map(
      func(a : Announcement) : Announcement {
        if (a.id == id) { { id = a.id; title = title; body = body; timestamp = a.timestamp } } else { a };
      },
    );
    true;
  };

  public shared func deleteAnnouncement(password : Text, id : Nat) : async Bool {
    if (not isAdmin(password)) return false;
    announcements := announcements.filter(func(a) { a.id != id });
    true;
  };

  //------------------------------ Vote Auto-Scheduling ------------------------------

  func voteExists(vt : VoteType, month : Nat, year : Nat) : Bool {
    monthlyVotes.any(func(v : MonthlyVote) : Bool {
      switch (v.voteType, vt) {
        case (#ICP, #ICP) { v.month == month and v.year == year };
        case (#BITTYICP, #BITTYICP) { v.month == month and v.year == year };
        case _ { false };
      };
    });
  };

  func ensureVotesForMonthYear(month : Nat, year : Nat) {
    if (not voteExists(#BITTYICP, month, year)) {
      let openSecs = secondsForDate(year, month, 15);
      let closeSecs = openSecs + (7 * 86400);
      let v : MonthlyVote = {
        id = nextVoteId;
        voteType = #BITTYICP;
        month = month;
        year = year;
        openTime = openSecs * 1_000_000_000;
        closeTime = closeSecs * 1_000_000_000;
        isFinalized = false;
        totalVoteAmount = "";
      };
      monthlyVotes := monthlyVotes.concat([v]);
      nextVoteId += 1;
    };
    if (not voteExists(#ICP, month, year)) {
      let lastDay = lastDayOfMonth(month, year);
      let openSecs = secondsForDate(year, month, lastDay);
      let closeSecs = openSecs + (7 * 86400);
      let v : MonthlyVote = {
        id = nextVoteId;
        voteType = #ICP;
        month = month;
        year = year;
        openTime = openSecs * 1_000_000_000;
        closeTime = closeSecs * 1_000_000_000;
        isFinalized = false;
        totalVoteAmount = "";
      };
      monthlyVotes := monthlyVotes.concat([v]);
      nextVoteId += 1;
    };
  };

  //------------------------------ Monthly Votes ------------------------------

  public shared func getActiveVotes() : async [MonthlyVote] {
    let nowNs = Time.now();
    let nowSecs = nowNs / 1_000_000_000;
    let (year, month, _) = dateFromSeconds(nowSecs);
    ensureVotesForMonthYear(month, year);
    let nextMonth = if (month == 12) 1 else month + 1;
    let nextYear = if (month == 12) year + 1 else year;
    ensureVotesForMonthYear(nextMonth, nextYear);
    monthlyVotes.filter(func(v : MonthlyVote) : Bool {
      v.openTime <= nowNs and nowNs <= v.closeTime and not v.isFinalized;
    });
  };

  public shared func getAllVotes() : async [MonthlyVote] {
    let nowNs = Time.now();
    let nowSecs = nowNs / 1_000_000_000;
    let (year, month, _) = dateFromSeconds(nowSecs);
    ensureVotesForMonthYear(month, year);
    let nextMonth = if (month == 12) 1 else month + 1;
    let nextYear = if (month == 12) year + 1 else year;
    ensureVotesForMonthYear(nextMonth, nextYear);
    monthlyVotes;
  };

  public shared ({ caller }) func castSplitVote(
    voteId : Nat,
    voterPrincipal : Text,
    pctA : Nat,
    pctB : Nat,
    pctC : Nat,
    votingPower : Nat,
  ) : async Bool {
    if (caller.toText() != voterPrincipal) {
      Runtime.trap("Unauthorized: caller does not match voterPrincipal");
    };
    if (pctA + pctB + pctC != 100) return false;
    let nowNs = Time.now();
    let voteOpt = monthlyVotes.filter(func(v : MonthlyVote) : Bool { v.id == voteId }).values().next();
    switch (voteOpt) {
      case (null) { return false };
      case (?v) {
        if (v.isFinalized or nowNs < v.openTime or nowNs > v.closeTime) return false;
      };
    };
    let alreadyVoted = voteAllocations.any(func(a : VoteAllocation) : Bool {
      a.voteId == voteId and a.voterPrincipal == voterPrincipal;
    });
    if (alreadyVoted) return false;
    let alloc : VoteAllocation = { voteId; voterPrincipal; pctA; pctB; pctC; votingPower };
    voteAllocations := voteAllocations.concat([alloc]);
    true;
  };

  public query func hasVotedOnVote(voteId : Nat, voterPrincipal : Text) : async Bool {
    voteAllocations.any(func(a : VoteAllocation) : Bool {
      a.voteId == voteId and a.voterPrincipal == voterPrincipal;
    });
  };

  public query func getVoteAllocations(voteId : Nat) : async [VoteAllocation] {
    voteAllocations.filter(func(a : VoteAllocation) : Bool { a.voteId == voteId });
  };

  func getOptionsForVote(voteId : Nat) : (Text, Text, Text) {
    let vOpt = monthlyVotes.filter(func(v : MonthlyVote) : Bool { v.id == voteId }).values().next();
    switch (vOpt) {
      case (null) { ("", "", "") };
      case (?v) {
        switch (v.voteType) {
          case (#ICP) {
            ("BUY $BITTYICP & STORE IN TREASURY", "INVEST INTO NEURON", "HOLD FOR LATER VOTE");
          };
          case (#BITTYICP) {
            ("BURN $BITTYICP", "SEND TO GAMES/DEV WALLET", "HOLD FOR LATER VOTE");
          };
        };
      };
    };
  };

  func computeVoteResults(voteId : Nat) : [VoteResult] {
    let allocs = voteAllocations.filter(func(a : VoteAllocation) : Bool { a.voteId == voteId });
    let labels = getOptionsForVote(voteId);
    if (allocs.size() == 0) {
      return [
        { optionLabel = labels.0; totalWeightedPct = 0; voterCount = 0 },
        { optionLabel = labels.1; totalWeightedPct = 0; voterCount = 0 },
        { optionLabel = labels.2; totalWeightedPct = 0; voterCount = 0 },
      ];
    };
    var sumPower : Nat = 0;
    var sumA : Nat = 0;
    var sumB : Nat = 0;
    var sumC : Nat = 0;
    for (a in allocs.values()) {
      sumPower += a.votingPower;
      sumA += a.pctA * a.votingPower;
      sumB += a.pctB * a.votingPower;
      sumC += a.pctC * a.votingPower;
    };
    let (wA, wB, wC) = if (sumPower == 0) (0, 0, 0) else (
      sumA / sumPower,
      sumB / sumPower,
      sumC / sumPower,
    );
    [
      { optionLabel = labels.0; totalWeightedPct = wA; voterCount = allocs.filter(func(a) { a.pctA > 0 }).size() },
      { optionLabel = labels.1; totalWeightedPct = wB; voterCount = allocs.filter(func(a) { a.pctB > 0 }).size() },
      { optionLabel = labels.2; totalWeightedPct = wC; voterCount = allocs.filter(func(a) { a.pctC > 0 }).size() },
    ];
  };

  public query func getVoteResults(voteId : Nat) : async [VoteResult] {
    computeVoteResults(voteId);
  };

  public shared func setVoteAmount(password : Text, voteId : Nat, amount : Text) : async Bool {
    if (not isAdmin(password)) return false;
    monthlyVotes := monthlyVotes.map(func(v : MonthlyVote) : MonthlyVote {
      if (v.id == voteId) {
        { id = v.id; voteType = v.voteType; month = v.month; year = v.year;
          openTime = v.openTime; closeTime = v.closeTime; isFinalized = v.isFinalized;
          totalVoteAmount = amount };
      } else { v };
    });
    true;
  };

  public shared func finalizeVote(password : Text, voteId : Nat) : async Bool {
    if (not isAdmin(password)) return false;
    var foundVote : ?MonthlyVote = null;
    monthlyVotes := monthlyVotes.map(func(v : MonthlyVote) : MonthlyVote {
      if (v.id == voteId) {
        foundVote := ?v;
        { id = v.id; voteType = v.voteType; month = v.month; year = v.year;
          openTime = v.openTime; closeTime = v.closeTime; isFinalized = true;
          totalVoteAmount = v.totalVoteAmount };
      } else { v };
    });
    switch (foundVote) {
      case (null) { false };
      case (?v) {
        let results = computeVoteResults(voteId);
        if (results.size() < 3) return true;
        var losingLabel = results[0].optionLabel;
        var losingPct = results[0].totalWeightedPct;
        for (r in results.vals()) {
          if (r.totalWeightedPct < losingPct) {
            losingPct := r.totalWeightedPct;
            losingLabel := r.optionLabel;
          };
        };
        let entry : RewardsPoolEntry = {
          voteId = voteId;
          voteType = v.voteType;
          losingOptionLabel = losingLabel;
          losingOptionPct = losingPct;
          poolAmount = v.totalVoteAmount;
          distributed = false;
        };
        rewardsPools := rewardsPools.concat([entry]);
        true;
      };
    };
  };

  public shared func markRewardsDistributed(password : Text, voteId : Nat) : async Bool {
    if (not isAdmin(password)) return false;
    rewardsPools := rewardsPools.map(func(r : RewardsPoolEntry) : RewardsPoolEntry {
      if (r.voteId == voteId) {
        { voteId = r.voteId; voteType = r.voteType; losingOptionLabel = r.losingOptionLabel;
          losingOptionPct = r.losingOptionPct; poolAmount = r.poolAmount; distributed = true };
      } else { r };
    });
    true;
  };

  public query func getRewardsPools() : async [RewardsPoolEntry] {
    rewardsPools;
  };

  public shared func setNeuronTopupAddress(password : Text, addr : Text) : async Bool {
    if (not isAdmin(password)) return false;
    neuronTopupAddress := addr;
    true;
  };

  public shared func setGamesWallet(password : Text, addr : Text) : async Bool {
    if (not isAdmin(password)) return false;
    gamesWallet := addr;
    true;
  };

  public query func getAdminConfig() : async { neuronTopupAddress : Text; gamesWallet : Text } {
    { neuronTopupAddress = neuronTopupAddress; gamesWallet = gamesWallet };
  };

  //------------------------------ Community Chat ------------------------------

  public shared ({ caller }) func addChatMessage(voteId : Nat, author : Text, message : Text) : async ?ChatMessage {
    if (caller.toText() != author) {
      Runtime.trap("Unauthorized: cannot post as another user");
    };
    let msg : ChatMessage = {
      id = nextChatId;
      voteId = voteId;
      author = author;
      message = message;
      timestamp = Time.now();
    };
    voteMessages := voteMessages.concat([msg]);
    nextChatId += 1;
    ?msg;
  };

  public query func getChatMessages(voteId : Nat) : async [ChatMessage] {
    voteMessages.filter(func(m : ChatMessage) : Bool { m.voteId == voteId });
  };
};
