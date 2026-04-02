import Array "mo:core/Array";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Map "mo:core/Map";
import Char "mo:core/Char";
import Outcall "http-outcalls/outcall";

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

  type OldChatMessage = {
    id : Nat;
    proposalId : Nat;
    author : Text;
    message : Text;
    timestamp : Int;
  };

  //------------------------------ Types ------------------------------

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

  // Custom Proposal Types
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

  type CustomVoteResult = {
    optionLabel : Text;
    optionIndex : Nat;
    totalWeightedPct : Nat;
    voterCount : Nat;
  };

  type CustomRewardsPoolEntry = {
    proposalId : Nat;
    voteType : VoteType;
    losingOptionLabel : Text;
    losingOptionPct : Nat;
    poolAmount : Text;
    distributed : Bool;
  };

  // Reward Transaction History
  type RewardTransaction = {
    id : Nat;
    recipient : Text;
    amount : Nat;
    tokenType : VoteType;
    timestamp : Int;
    voteTitle : Text;
    voteId : Nat;       // 0 if custom proposal
    proposalId : Nat;   // 0 if monthly vote
  };

  //------------------------------ State ------------------------------

  stable var WALLET_PRINCIPAL : Text = "ns32b-r2krl-rtozy-ymo6u-7pujx-gr7ff-uhyup-fsm3v-t5ul7-5lj3b-mqe";
  stable var FUND_WALLET_PRINCIPAL : Text = "vqr3d-eby7o-fiwpf-pllu5-yzmxy-4ut67-gnxgr-nfiqw-c3ked-6arfu-zae";
  stable var ICP_LEDGER_ID : Text = "ryjl3-tyaaa-aaaaa-aaaba-cai";
  stable var BITTY_LEDGER_ID : Text = "qroj6-lyaaa-aaaam-qeqta-cai";
  stable var nextProposalId : Nat = 1;
  stable var proposals : [OldProposal] = [];
  stable var votes : [OldVote] = [];
  stable var chatMessages : [OldChatMessage] = [];

  stable var announcements : [Announcement] = [];
  stable var nextAnnouncementId : Nat = 1;
  stable var nextVoteId : Nat = 1;
  stable var nextChatId : Nat = 1;
  stable var monthlyVotes : [MonthlyVote] = [];
  stable var voteAllocations : [VoteAllocation] = [];
  stable var voteMessages : [ChatMessage] = [];
  stable var rewardsPools : [RewardsPoolEntry] = [];
  stable var manualICP : Text = "";
  stable var manualBITTY : Text = "";
  stable var manualFund : Text = "";
  stable var manualBittyPriceUSD : Text = "";
  stable var neuronTopupAddress : Text = "";
  stable var gamesWallet : Text = "slfhp-cxr4u-mn53d-4tz4a-gn4ds-snqfa-tunfl-rfyxy-zjtho-iwksr-hqe";

  // Custom proposals state
  stable var customProposals : [CustomProposal] = [];
  stable var nextCustomProposalId : Nat = 1;
  stable var customVoteAllocations : [CustomVoteAllocation] = [];
  stable var customRewardsPools : [CustomRewardsPoolEntry] = [];

  // Reward transaction history
  stable var rewardTransactions : [RewardTransaction] = [];
  stable var nextRewardTxId : Nat = 1;

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
    while (m + 1 < month) {
      totalDays += mDays[m];
      m += 1;
    };
    totalDays += (day : Int) - 1;
    totalDays * 86400
  };

  //------------------------------ HTTP Price Helpers ------------------------------

  // Transform function required for HTTP outcall consensus
  public query func transformHttpResponse(input : Outcall.TransformationInput) : async Outcall.TransformationOutput {
    Outcall.transform(input);
  };

  // Extract quoted string value after a needle
  func findValue(haystack : Text, needle : Text) : Text {
    var h : [Char] = [];
    for (c in haystack.chars()) { h := h.concat([c]) };
    var n : [Char] = [];
    for (c in needle.chars()) { n := n.concat([c]) };
    let hl = h.size();
    let nl = n.size();
    if (nl == 0 or nl > hl) return "";
    let dquote : Char = Char.fromNat32(34);
    var i : Nat = 0;
    while (i + nl <= hl) {
      var j : Nat = 0;
      var matched : Bool = true;
      while (j < nl and matched) {
        if (h[i + j] != n[j]) matched := false;
        j += 1;
      };
      if (matched) {
        var val : Text = "";
        var k = i + nl;
        while (k < hl and h[k] != dquote) {
          val := val # Text.fromChar(h[k]);
          k += 1;
        };
        return val;
      };
      i += 1;
    };
    ""
  };

  // Extract unquoted numeric value after a needle (handles "key":0.000007 format)
  func findNumberValue(haystack : Text, needle : Text) : Text {
    var h : [Char] = [];
    for (c in haystack.chars()) { h := h.concat([c]) };
    var n : [Char] = [];
    for (c in needle.chars()) { n := n.concat([c]) };
    let hl = h.size();
    let nl = n.size();
    if (nl == 0 or nl > hl) return "";
    var i : Nat = 0;
    while (i + nl <= hl) {
      var j : Nat = 0;
      var matched : Bool = true;
      while (j < nl and matched) {
        if (h[i + j] != n[j]) matched := false;
        j += 1;
      };
      if (matched) {
        var val : Text = "";
        var k = i + nl;
        // skip whitespace
        while (k < hl and (h[k] == ' ' or h[k] == '\t')) { k += 1 };
        // read numeric characters
        var reading = true;
        while (k < hl and reading) {
          let c = h[k];
          if (c == '0' or c == '1' or c == '2' or c == '3' or c == '4' or
              c == '5' or c == '6' or c == '7' or c == '8' or c == '9' or
              c == '.' or c == 'e' or c == 'E' or c == '-' or c == '+') {
            val := val # Text.fromChar(c);
            k += 1;
          } else {
            reading := false;
          };
        };
        if (val != "") return val;
      };
      i += 1;
    };
    ""
  };

  // Fetch ICP/USD price from Binance public API via HTTP outcall
  public shared func getIcpUsdPrice() : async Text {
    try {
      let body = await Outcall.httpGetRequest(
        "https://api.binance.com/api/v3/ticker/price?symbol=ICPUSDT",
        [],
        transformHttpResponse,
      );
      // Binance returns {"symbol":"ICPUSDT","price":"5.1234"} - always quoted
      findValue(body, "\"price\":\"")
    } catch (_) { "" }
  };

  // Fetch BITTYICP/USD price from ICPSwap API via HTTP outcall
  // Tries multiple ICPSwap URL patterns with all response formats
  public shared func getBittyUsdPrice() : async Text {
    // Pattern 1: specific token stats endpoint
    try {
      let body1 = await Outcall.httpGetRequest(
        "https://api.icpswap.com/info/token-stats/qroj6-lyaaa-aaaam-qeqta-cai",
        [],
        transformHttpResponse,
      );
      let p1 = findValue(body1, "\"priceUSD\":\"");
      if (p1 != "") return p1;
      let p2 = findNumberValue(body1, "\"priceUSD\":");
      if (p2 != "") return p2;
    } catch (_) {};
    // Pattern 2: token info endpoint (alternate path)
    try {
      let body2 = await Outcall.httpGetRequest(
        "https://api.icpswap.com/info/token/qroj6-lyaaa-aaaam-qeqta-cai",
        [],
        transformHttpResponse,
      );
      let p3 = findValue(body2, "\"priceUSD\":\"");
      if (p3 != "") return p3;
      let p4 = findNumberValue(body2, "\"priceUSD\":");
      if (p4 != "") return p4;
      let p5 = findValue(body2, "\"price\":\"");
      if (p5 != "") return p5;
      let p6 = findNumberValue(body2, "\"price\":");
      if (p6 != "") return p6;
    } catch (_) {};
    ""
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

  // Helper: parse Nat from Text (digits only)
  func parseNatText(t : Text) : Nat {
    var n : Nat = 0;
    let digits = ['0','1','2','3','4','5','6','7','8','9'];
    for (c in t.chars()) {
      var idx : Nat = 0;
      var found = false;
      for (d in digits.vals()) {
        if (d == c and not found) { n := n * 10 + idx; found := true };
        idx += 1;
      };
    };
    n;
  };

  // Helper: get vote title string for monthly vote
  func getVoteTitle(voteId : Nat) : Text {
    let vOpt = monthlyVotes.filter(func(v : MonthlyVote) : Bool { v.id == voteId }).values().next();
    switch (vOpt) {
      case (null) { "Monthly Vote #" # voteId.toText() };
      case (?v) {
        let typeLabel = switch (v.voteType) { case (#ICP) { "$ICP" }; case (#BITTYICP) { "$BITTYICP" } };
        typeLabel # " Treasury Vote " # v.month.toText() # "/" # v.year.toText();
      };
    };
  };

  // Helper: get custom proposal title
  func getCustomProposalTitle(proposalId : Nat) : Text {
    let pOpt = customProposals.filter(func(p : CustomProposal) : Bool { p.id == proposalId }).values().next();
    switch (pOpt) {
      case (null) { "Community Proposal #" # proposalId.toText() };
      case (?p) { p.title };
    };
  };

  // Real on-chain reward distribution for monthly votes
  public shared func distributeRewards(password : Text, voteId : Nat) : async { success : Bool; transferCount : Nat; errors : [Text] } {
    if (not isAdmin(password)) return { success = false; transferCount = 0; errors = ["Unauthorized"] };
    let poolOpt = rewardsPools.filter(func(r : RewardsPoolEntry) : Bool { r.voteId == voteId }).values().next();
    switch (poolOpt) {
      case (null) { return { success = false; transferCount = 0; errors = ["Pool not found"] } };
      case (?pool) {
        if (pool.distributed) return { success = false; transferCount = 0; errors = ["Already distributed"] };
        let totalPool = parseNatText(pool.poolAmount);
        if (totalPool == 0 or pool.losingOptionPct == 0) {
          rewardsPools := rewardsPools.map(func(r : RewardsPoolEntry) : RewardsPoolEntry {
            if (r.voteId == voteId) { { voteId = r.voteId; voteType = r.voteType; losingOptionLabel = r.losingOptionLabel; losingOptionPct = r.losingOptionPct; poolAmount = r.poolAmount; distributed = true } } else { r }
          });
          return { success = true; transferCount = 0; errors = [] };
        };
        let rewardsTotal = totalPool * pool.losingOptionPct / 100;
        let allocs = voteAllocations.filter(func(a : VoteAllocation) : Bool { a.voteId == voteId });
        let labels = getOptionsForVote(voteId);
        type VoterShare = { principal : Text; eligiblePower : Nat };
        var voterShares : [VoterShare] = [];
        var totalEligible : Nat = 0;
        for (a in allocs.values()) {
          let losingPct = if (pool.losingOptionLabel == labels.0) { a.pctA }
                          else if (pool.losingOptionLabel == labels.1) { a.pctB }
                          else { a.pctC };
          let nonLosingPct : Nat = if (losingPct >= 100) { 0 } else { 100 - losingPct };
          let eligible = a.votingPower * nonLosingPct / 100;
          if (eligible > 0) {
            voterShares := voterShares.concat([{ principal = a.voterPrincipal; eligiblePower = eligible }]);
            totalEligible += eligible;
          };
        };
        if (totalEligible == 0) {
          rewardsPools := rewardsPools.map(func(r : RewardsPoolEntry) : RewardsPoolEntry {
            if (r.voteId == voteId) { { voteId = r.voteId; voteType = r.voteType; losingOptionLabel = r.losingOptionLabel; losingOptionPct = r.losingOptionPct; poolAmount = r.poolAmount; distributed = true } } else { r }
          });
          return { success = true; transferCount = 0; errors = [] };
        };
        let ledgerId = switch (pool.voteType) {
          case (#ICP) { "ryjl3-tyaaa-aaaaa-aaaba-cai" };
          case (#BITTYICP) { "qroj6-lyaaa-aaaam-qeqta-cai" };
        };
        let ledger = actor(ledgerId) : actor {
          icrc1_transfer : ({
            from_subaccount : ?Blob;
            to : { owner : Principal; subaccount : ?Blob };
            amount : Nat;
            fee : ?Nat;
            memo : ?Blob;
            created_at_time : ?Nat64;
          }) -> async { #Ok : Nat; #Err : { #InsufficientFunds : { balance : Nat }; #BadFee : { expected_fee : Nat }; #TemporarilyUnavailable; #GenericError : { error_code : Nat; message : Text } } };
        };
        let fee : Nat = 10000;
        var transferCount = 0;
        var errors : [Text] = [];
        let voteTitle = getVoteTitle(voteId);
        let nowTs = Time.now();
        for (vs in voterShares.values()) {
          let amount = rewardsTotal * vs.eligiblePower / totalEligible;
          if (amount > fee) {
            try {
              let result = await ledger.icrc1_transfer({
                from_subaccount = null;
                to = { owner = Principal.fromText(vs.principal); subaccount = null };
                amount = amount - fee;
                fee = ?fee;
                memo = null;
                created_at_time = null;
              });
              switch (result) {
                case (#Ok(_)) {
                  transferCount += 1;
                  // Record reward transaction
                  let tx : RewardTransaction = {
                    id = nextRewardTxId;
                    recipient = vs.principal;
                    amount = amount - fee;
                    tokenType = pool.voteType;
                    timestamp = nowTs;
                    voteTitle = voteTitle;
                    voteId = voteId;
                    proposalId = 0;
                  };
                  rewardTransactions := rewardTransactions.concat([tx]);
                  nextRewardTxId += 1;
                };
                case (#Err(_)) { errors := errors.concat(["Transfer failed for " # vs.principal]) };
              };
            } catch (_) {
              errors := errors.concat(["Exception for " # vs.principal]);
            };
          };
        };
        rewardsPools := rewardsPools.map(func(r : RewardsPoolEntry) : RewardsPoolEntry {
          if (r.voteId == voteId) { { voteId = r.voteId; voteType = r.voteType; losingOptionLabel = r.losingOptionLabel; losingOptionPct = r.losingOptionPct; poolAmount = r.poolAmount; distributed = true } } else { r }
        });
        { success = true; transferCount; errors };
      };
    };
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

  //------------------------------ Custom Proposals ------------------------------

  public shared func createCustomProposal(
    password : Text,
    title : Text,
    description : Text,
    voteType : VoteType,
    options : [Text],
    closeTimeNs : Int,
  ) : async ?CustomProposal {
    if (not isAdmin(password)) return null;
    if (options.size() < 2 or options.size() > 6) return null;
    let proposal : CustomProposal = {
      id = nextCustomProposalId;
      title = title;
      description = description;
      voteType = voteType;
      options = options;
      openTime = Time.now();
      closeTime = closeTimeNs;
      isFinalized = false;
      totalVoteAmount = "";
    };
    customProposals := customProposals.concat([proposal]);
    nextCustomProposalId += 1;
    ?proposal;
  };

  public query func getCustomProposals() : async [CustomProposal] {
    customProposals;
  };

  public shared ({ caller }) func castCustomVote(
    proposalId : Nat,
    voterPrincipal : Text,
    allocations : [CustomOptionAlloc],
    votingPower : Nat,
  ) : async Bool {
    if (caller.toText() != voterPrincipal) {
      Runtime.trap("Unauthorized: caller does not match voterPrincipal");
    };
    var totalPct : Nat = 0;
    for (a in allocations.vals()) {
      totalPct += a.pct;
    };
    if (totalPct != 100) return false;
    let nowNs = Time.now();
    let propOpt = customProposals.filter(func(p : CustomProposal) : Bool { p.id == proposalId }).values().next();
    switch (propOpt) {
      case (null) { return false };
      case (?p) {
        if (p.isFinalized or nowNs < p.openTime or nowNs > p.closeTime) return false;
      };
    };
    let alreadyVoted = customVoteAllocations.any(func(a : CustomVoteAllocation) : Bool {
      a.proposalId == proposalId and a.voterPrincipal == voterPrincipal;
    });
    if (alreadyVoted) return false;
    let alloc : CustomVoteAllocation = { proposalId; voterPrincipal; allocations; votingPower };
    customVoteAllocations := customVoteAllocations.concat([alloc]);
    true;
  };

  public query func hasVotedOnCustomProposal(proposalId : Nat, voterPrincipal : Text) : async Bool {
    customVoteAllocations.any(func(a : CustomVoteAllocation) : Bool {
      a.proposalId == proposalId and a.voterPrincipal == voterPrincipal;
    });
  };

  public query func getCustomVoteAllocations(proposalId : Nat) : async [CustomVoteAllocation] {
    customVoteAllocations.filter(func(a : CustomVoteAllocation) : Bool { a.proposalId == proposalId });
  };

  func computeCustomVoteResults(proposalId : Nat) : [CustomVoteResult] {
    let propOpt = customProposals.filter(func(p : CustomProposal) : Bool { p.id == proposalId }).values().next();
    switch (propOpt) {
      case (null) { return [] };
      case (?p) {
        let allocs = customVoteAllocations.filter(func(a : CustomVoteAllocation) : Bool { a.proposalId == proposalId });
        let nOpts = p.options.size();
        if (nOpts == 0) return [];
        // sum weighted pct per option
        var sumPower : Nat = 0;
        for (a in allocs.values()) { sumPower += a.votingPower; };
        // build results
        var results : [CustomVoteResult] = [];
        var i = 0;
        while (i < nOpts) {
          let optLabel = p.options[i];
          var weightedSum : Nat = 0;
          var voterCount : Nat = 0;
          for (a in allocs.values()) {
            for (alloc in a.allocations.vals()) {
              if (alloc.optionIndex == i) {
                weightedSum += alloc.pct * a.votingPower;
                voterCount += 1;
              };
            };
          };
          let wPct = if (sumPower == 0) 0 else weightedSum / sumPower;
          results := results.concat([{ optionLabel = optLabel; optionIndex = i; totalWeightedPct = wPct; voterCount = voterCount }]);
          i += 1;
        };
        results;
      };
    };
  };

  public query func getCustomVoteResults(proposalId : Nat) : async [CustomVoteResult] {
    computeCustomVoteResults(proposalId);
  };

  public shared func setCustomProposalAmount(password : Text, proposalId : Nat, amount : Text) : async Bool {
    if (not isAdmin(password)) return false;
    customProposals := customProposals.map(func(p : CustomProposal) : CustomProposal {
      if (p.id == proposalId) {
        { id = p.id; title = p.title; description = p.description; voteType = p.voteType;
          options = p.options; openTime = p.openTime; closeTime = p.closeTime;
          isFinalized = p.isFinalized; totalVoteAmount = amount };
      } else { p };
    });
    true;
  };

  public shared func finalizeCustomProposal(password : Text, proposalId : Nat) : async Bool {
    if (not isAdmin(password)) return false;
    var foundProposal : ?CustomProposal = null;
    customProposals := customProposals.map(func(p : CustomProposal) : CustomProposal {
      if (p.id == proposalId) {
        foundProposal := ?p;
        { id = p.id; title = p.title; description = p.description; voteType = p.voteType;
          options = p.options; openTime = p.openTime; closeTime = p.closeTime;
          isFinalized = true; totalVoteAmount = p.totalVoteAmount };
      } else { p };
    });
    switch (foundProposal) {
      case (null) { false };
      case (?p) {
        let results = computeCustomVoteResults(proposalId);
        if (results.size() == 0) return true;
        var losingLabel = results[0].optionLabel;
        var losingPct = results[0].totalWeightedPct;
        for (r in results.vals()) {
          if (r.totalWeightedPct < losingPct) {
            losingPct := r.totalWeightedPct;
            losingLabel := r.optionLabel;
          };
        };
        let entry : CustomRewardsPoolEntry = {
          proposalId = proposalId;
          voteType = p.voteType;
          losingOptionLabel = losingLabel;
          losingOptionPct = losingPct;
          poolAmount = p.totalVoteAmount;
          distributed = false;
        };
        customRewardsPools := customRewardsPools.concat([entry]);
        true;
      };
    };
  };

  public query func getCustomRewardsPools() : async [CustomRewardsPoolEntry] {
    customRewardsPools;
  };

  public shared func markCustomRewardsDistributed(password : Text, proposalId : Nat) : async Bool {
    if (not isAdmin(password)) return false;
    customRewardsPools := customRewardsPools.map(func(r : CustomRewardsPoolEntry) : CustomRewardsPoolEntry {
      if (r.proposalId == proposalId) {
        { proposalId = r.proposalId; voteType = r.voteType; losingOptionLabel = r.losingOptionLabel;
          losingOptionPct = r.losingOptionPct; poolAmount = r.poolAmount; distributed = true };
      } else { r };
    });
    true;
  };

  // Real on-chain reward distribution for custom proposals
  public shared func distributeCustomRewards(password : Text, proposalId : Nat) : async { success : Bool; transferCount : Nat; errors : [Text] } {
    if (not isAdmin(password)) return { success = false; transferCount = 0; errors = ["Unauthorized"] };
    let poolOpt = customRewardsPools.filter(func(r : CustomRewardsPoolEntry) : Bool { r.proposalId == proposalId }).values().next();
    switch (poolOpt) {
      case (null) { return { success = false; transferCount = 0; errors = ["Pool not found"] } };
      case (?pool) {
        if (pool.distributed) return { success = false; transferCount = 0; errors = ["Already distributed"] };
        let totalPool = parseNatText(pool.poolAmount);
        if (totalPool == 0 or pool.losingOptionPct == 0) {
          customRewardsPools := customRewardsPools.map(func(r : CustomRewardsPoolEntry) : CustomRewardsPoolEntry {
            if (r.proposalId == proposalId) { { proposalId = r.proposalId; voteType = r.voteType; losingOptionLabel = r.losingOptionLabel; losingOptionPct = r.losingOptionPct; poolAmount = r.poolAmount; distributed = true } } else { r }
          });
          return { success = true; transferCount = 0; errors = [] };
        };
        let rewardsTotal = totalPool * pool.losingOptionPct / 100;
        // Find losing option index for this proposal
        let proposalOpt = customProposals.filter(func(p : CustomProposal) : Bool { p.id == proposalId }).values().next();
        var losingOptionIndex : ?Nat = null;
        switch (proposalOpt) {
          case (null) {};
          case (?p) {
            var idx : Nat = 0;
            for (opt in p.options.vals()) {
              if (opt == pool.losingOptionLabel) { losingOptionIndex := ?idx };
              idx += 1;
            };
          };
        };
        let allocs = customVoteAllocations.filter(func(a : CustomVoteAllocation) : Bool { a.proposalId == proposalId });
        type VoterShare = { principal : Text; eligiblePower : Nat };
        var voterShares : [VoterShare] = [];
        var totalEligible : Nat = 0;
        for (a in allocs.values()) {
          var losingPct : Nat = 0;
          switch (losingOptionIndex) {
            case (null) {};
            case (?li) {
              for (alloc in a.allocations.vals()) {
                if (alloc.optionIndex == li) { losingPct := alloc.pct };
              };
            };
          };
          let nonLosingPct : Nat = if (losingPct >= 100) { 0 } else { 100 - losingPct };
          let eligible = a.votingPower * nonLosingPct / 100;
          if (eligible > 0) {
            voterShares := voterShares.concat([{ principal = a.voterPrincipal; eligiblePower = eligible }]);
            totalEligible += eligible;
          };
        };
        if (totalEligible == 0) {
          customRewardsPools := customRewardsPools.map(func(r : CustomRewardsPoolEntry) : CustomRewardsPoolEntry {
            if (r.proposalId == proposalId) { { proposalId = r.proposalId; voteType = r.voteType; losingOptionLabel = r.losingOptionLabel; losingOptionPct = r.losingOptionPct; poolAmount = r.poolAmount; distributed = true } } else { r }
          });
          return { success = true; transferCount = 0; errors = [] };
        };
        let ledgerId = switch (pool.voteType) {
          case (#ICP) { "ryjl3-tyaaa-aaaaa-aaaba-cai" };
          case (#BITTYICP) { "qroj6-lyaaa-aaaam-qeqta-cai" };
        };
        let ledger = actor(ledgerId) : actor {
          icrc1_transfer : ({
            from_subaccount : ?Blob;
            to : { owner : Principal; subaccount : ?Blob };
            amount : Nat;
            fee : ?Nat;
            memo : ?Blob;
            created_at_time : ?Nat64;
          }) -> async { #Ok : Nat; #Err : { #InsufficientFunds : { balance : Nat }; #BadFee : { expected_fee : Nat }; #TemporarilyUnavailable; #GenericError : { error_code : Nat; message : Text } } };
        };
        let fee : Nat = 10000;
        var transferCount = 0;
        var errors : [Text] = [];
        let proposalTitle = getCustomProposalTitle(proposalId);
        let nowTs = Time.now();
        for (vs in voterShares.values()) {
          let amount = rewardsTotal * vs.eligiblePower / totalEligible;
          if (amount > fee) {
            try {
              let result = await ledger.icrc1_transfer({
                from_subaccount = null;
                to = { owner = Principal.fromText(vs.principal); subaccount = null };
                amount = amount - fee;
                fee = ?fee;
                memo = null;
                created_at_time = null;
              });
              switch (result) {
                case (#Ok(_)) {
                  transferCount += 1;
                  // Record reward transaction
                  let tx : RewardTransaction = {
                    id = nextRewardTxId;
                    recipient = vs.principal;
                    amount = amount - fee;
                    tokenType = pool.voteType;
                    timestamp = nowTs;
                    voteTitle = proposalTitle;
                    voteId = 0;
                    proposalId = proposalId;
                  };
                  rewardTransactions := rewardTransactions.concat([tx]);
                  nextRewardTxId += 1;
                };
                case (#Err(_)) { errors := errors.concat(["Transfer failed for " # vs.principal]) };
              };
            } catch (_) {
              errors := errors.concat(["Exception for " # vs.principal]);
            };
          };
        };
        customRewardsPools := customRewardsPools.map(func(r : CustomRewardsPoolEntry) : CustomRewardsPoolEntry {
          if (r.proposalId == proposalId) { { proposalId = r.proposalId; voteType = r.voteType; losingOptionLabel = r.losingOptionLabel; losingOptionPct = r.losingOptionPct; poolAmount = r.poolAmount; distributed = true } } else { r }
        });
        { success = true; transferCount; errors };
      };
    };
  };

  //------------------------------ Reward Transaction History ------------------------------

  public query func getMyRewardTransactions(principal : Text) : async [RewardTransaction] {
    rewardTransactions.filter(func(tx : RewardTransaction) : Bool { tx.recipient == principal });
  };

  public shared func getAllRewardTransactions(password : Text) : async [RewardTransaction] {
    if (not isAdmin(password)) return [];
    rewardTransactions;
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

  //------------------------------ Wallet Verification ------------------------------

  type ICRC1Account = { owner : Principal; subaccount : ?Blob };
  let bittyLedger = actor ("qroj6-lyaaa-aaaam-qeqta-cai") : actor {
    icrc1_balance_of : (ICRC1Account) -> async Nat;
  };

  // externalWallet -> appPrincipalText
  stable var verifiedWalletOwners : [(Text, Text)] = [];
  // appPrincipalText -> [externalWallets]
  stable var userVerifiedWallets : [(Text, [Text])] = [];
  // (appPrincipalText, externalWallet, balanceBefore)
  stable var pendingVerifications : [(Text, Text, Nat)] = [];

  func getVerifiedWalletOwner(externalWallet : Text) : ?Text {
    let found = verifiedWalletOwners.filter(func(e : (Text, Text)) : Bool { e.0 == externalWallet }).values().next();
    switch (found) {
      case (null) { null };
      case (?(_, owner)) { ?owner };
    };
  };

  func getUserWallets(appPrincipal : Text) : [Text] {
    let found = userVerifiedWallets.filter(func(e : (Text, [Text])) : Bool { e.0 == appPrincipal }).values().next();
    switch (found) {
      case (null) { [] };
      case (?(_, wallets)) { wallets };
    };
  };

  func getPendingVerification(appPrincipal : Text, externalWallet : Text) : ?Nat {
    let found = pendingVerifications.filter(func(e : (Text, Text, Nat)) : Bool {
      e.0 == appPrincipal and e.1 == externalWallet
    }).values().next();
    switch (found) {
      case (null) { null };
      case (?(_, _, bal)) { ?bal };
    };
  };

  public shared ({ caller }) func initWalletVerification(externalWallet : Text) : async { #ok : Nat; #err : Text } {
    let callerText = caller.toText();
    if (callerText == externalWallet) {
      return #err("Cannot verify your own app principal as an external wallet");
    };
    switch (getVerifiedWalletOwner(externalWallet)) {
      case (?_) { return #err("This wallet is already verified by another user") };
      case (null) {};
    };
    let balance = await bittyLedger.icrc1_balance_of({ owner = caller; subaccount = null });
    // Remove any existing pending for this caller+externalWallet
    pendingVerifications := pendingVerifications.filter(func(e : (Text, Text, Nat)) : Bool {
      not (e.0 == callerText and e.1 == externalWallet)
    });
    pendingVerifications := pendingVerifications.concat([(callerText, externalWallet, balance)]);
    #ok(balance);
  };

  public shared ({ caller }) func confirmWalletVerification(externalWallet : Text) : async { #ok; #err : Text } {
    let callerText = caller.toText();
    switch (getPendingVerification(callerText, externalWallet)) {
      case (null) { return #err("No pending verification found. Please start verification again.") };
      case (?balanceBefore) {
        let currentBalance = await bittyLedger.icrc1_balance_of({ owner = caller; subaccount = null });
        if (currentBalance > balanceBefore) {
          // Record ownership
          verifiedWalletOwners := verifiedWalletOwners.filter(func(e : (Text, Text)) : Bool { e.0 != externalWallet });
          verifiedWalletOwners := verifiedWalletOwners.concat([(externalWallet, callerText)]);
          // Add to user's wallets
          let existing = getUserWallets(callerText);
          let alreadyHas = existing.any(func(w : Text) : Bool { w == externalWallet });
          if (not alreadyHas) {
            userVerifiedWallets := userVerifiedWallets.filter(func(e : (Text, [Text])) : Bool { e.0 != callerText });
            userVerifiedWallets := userVerifiedWallets.concat([(callerText, existing.concat([externalWallet]))]);
          };
          // Remove pending
          pendingVerifications := pendingVerifications.filter(func(e : (Text, Text, Nat)) : Bool {
            not (e.0 == callerText and e.1 == externalWallet)
          });
          #ok;
        } else {
          #err("No new BITTYICP transfer detected. Send 10 BITTYICP from your external wallet to your app address, then try again.");
        };
      };
    };
  };

  public query ({ caller }) func getMyVerifiedWallets() : async [Text] {
    getUserWallets(caller.toText());
  };

  public query func isExternalWalletClaimed(wallet : Text) : async Bool {
    switch (getVerifiedWalletOwner(wallet)) {
      case (null) { false };
      case (?_) { true };
    };
  };

  public query func getWalletOwner(wallet : Text) : async ?Text {
    getVerifiedWalletOwner(wallet);
  };

  public shared ({ caller }) func verifyExternalWallet(externalWallet : Text) : async { #ok; #err : Text } {
    let callerText = caller.toText();
    if (callerText == externalWallet) {
      return #err("Cannot verify your own app principal as an external wallet");
    };
    switch (getVerifiedWalletOwner(externalWallet)) {
      case (?_) { return #err("This wallet is already verified by another user") };
      case (null) {};
    };
    let balance = await bittyLedger.icrc1_balance_of({ owner = caller; subaccount = null });
    if (balance == 0) {
      return #err("No BITTYICP received yet. Please send 10 $BITTYICP from your external wallet to your BITTY ICP Bank address first.");
    };
    verifiedWalletOwners := verifiedWalletOwners.filter(func(e : (Text, Text)) : Bool { e.0 != externalWallet });
    verifiedWalletOwners := verifiedWalletOwners.concat([(externalWallet, callerText)]);
    let existing = getUserWallets(callerText);
    let alreadyHas = existing.any(func(w : Text) : Bool { w == externalWallet });
    if (not alreadyHas) {
      userVerifiedWallets := userVerifiedWallets.filter(func(e : (Text, [Text])) : Bool { e.0 != callerText });
      userVerifiedWallets := userVerifiedWallets.concat([(callerText, existing.concat([externalWallet]))]);
    };
    #ok;
  };


  // Admin: reset all verified wallets (fresh start)
  public shared func adminResetVerifiedWallets(password : Text) : async Bool {
    if (not isAdmin(password)) return false;
    verifiedWalletOwners := [];
    userVerifiedWallets := [];
    pendingVerifications := [];
    true;
  };

  // User: unverify a single external wallet
  public shared ({ caller }) func unverifyWallet(externalWallet : Text) : async Bool {
    let callerText = caller.toText();
    verifiedWalletOwners := verifiedWalletOwners.filter(func(e : (Text, Text)) : Bool {
      not (e.0 == externalWallet and e.1 == callerText)
    });
    let existing = getUserWallets(callerText);
    let updated = existing.filter(func(w : Text) : Bool { w != externalWallet });
    userVerifiedWallets := userVerifiedWallets.filter(func(e : (Text, [Text])) : Bool { e.0 != callerText });
    if (updated.size() > 0) {
      userVerifiedWallets := userVerifiedWallets.concat([(callerText, updated)]);
    };
    true;
  };


  // Auto-seed monthly votes on fresh deploy or upgrade
  func seedCurrentMonthlyVotes() {
    let nowNs = Time.now();
    let nowSecs = nowNs / 1_000_000_000;
    let (year, month, _) = dateFromSeconds(nowSecs);
    ensureVotesForMonthYear(month, year);
    let nextMonth = if (month == 12) 1 else month + 1;
    let nextYear = if (month == 12) year + 1 else year;
    ensureVotesForMonthYear(nextMonth, nextYear);
  };

  system func postupgrade() {
    seedCurrentMonthlyVotes();
  };

};
