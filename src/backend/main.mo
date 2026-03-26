import Array "mo:core/Array";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Iter "mo:core/Iter";
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

  //------------------------------ Types ------------------------------

  type Announcement = {
    id : Nat;
    title : Text;
    body : Text;
    timestamp : Int;
  };

  type Proposal = {
    id : Nat;
    title : Text;
    description : Text;
    options : [Text];
    startTime : Int;
    endTime : Int;
    isOpen : Bool;
  };

  type Vote = {
    proposalId : Nat;
    voterPrincipal : Text;
    optionIndex : Nat;
    weight : Nat;
  };

  type ChatMessage = {
    id : Nat;
    proposalId : Nat;
    author : Text;
    message : Text;
    timestamp : Int;
  };

  public type UserProfile = {
    name : Text;
  };

  //------------------------------ State ------------------------------

  var announcements : [Announcement] = [];
  var nextAnnouncementId : Nat = 1;
  var nextProposalId : Nat = 1;
  var nextChatId : Nat = 1;
  var proposals : [Proposal] = [];
  var votes : [Vote] = [];
  var chatMessages : [ChatMessage] = [];
  var manualICP : Text = "";
  var manualBITTY : Text = "";
  var manualFund : Text = "";
  var manualBittyPriceUSD : Text = "";

  // Kept for upgrade compatibility with previous version
  var WALLET_PRINCIPAL : Text = "ns32b-r2krl-rtozy-ymo6u-7pujx-gr7ff-uhyup-fsm3v-t5ul7-5lj3b-mqe";
  var FUND_WALLET_PRINCIPAL : Text = "vqr3d-eby7o-fiwpf-pllu5-yzmxy-4ut67-gnxgr-nfiqw-c3ked-6arfu-zae";
  var ICP_LEDGER_ID : Text = "ryjl3-tyaaa-aaaaa-aaaba-cai";
  var BITTY_LEDGER_ID : Text = "qroj6-lyaaa-aaaam-qeqta-cai";

  let ADMIN_PASSWORD = "bittybittywhatwhat";

  let userProfiles = Map.empty<Principal, UserProfile>();

  //------------------------------ User Profile System ------------------------------

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  //------------------------------ Admin Auth (Legacy Compatibility) ------------------------------

  public shared ({ caller }) func adminLogin(password : Text) : async Bool {
    if (password == ADMIN_PASSWORD) {
      // Grant admin role to caller if password is correct
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
    // Public read access - no authorization required
    {
      icp = manualICP;
      bitty = manualBITTY;
      fund = manualFund;
      bittyPriceUsd = manualBittyPriceUSD;
    };
  };

  public shared func setManualBalances(password : Text, icp : Text, bitty : Text) : async Bool {
    if (not isAdmin(password)) {
      return false;
    };
    manualICP := icp;
    manualBITTY := bitty;
    true;
  };

  public shared func setManualFundBalance(password : Text, fund : Text) : async Bool {
    if (not isAdmin(password)) {
      return false;
    };
    manualFund := fund;
    true;
  };

  public shared func setManualBittyPrice(password : Text, price : Text) : async Bool {
    if (not isAdmin(password)) {
      return false;
    };
    manualBittyPriceUSD := price;
    true;
  };

  //------------------------------ Announcements ------------------------------

  public query func getAnnouncements() : async [Announcement] {
    // Public read access - no authorization required
    announcements;
  };

  public shared func addAnnouncement(password : Text, title : Text, body : Text) : async ?Announcement {
    if (not isAdmin(password)) {
      return null;
    };
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
    if (not isAdmin(password)) {
      return false;
    };
    announcements := announcements.map(
      func(a : Announcement) : Announcement {
        if (a.id == id) {
          {
            id = a.id;
            title = title;
            body = body;
            timestamp = a.timestamp;
          };
        } else { a };
      },
    );
    true;
  };

  public shared func deleteAnnouncement(password : Text, id : Nat) : async Bool {
    if (not isAdmin(password)) {
      return false;
    };
    announcements := announcements.filter(func(a) { a.id != id });
    true;
  };

  //------------------------------ Voting System ------------------------------

  public shared func createProposal(password : Text, title : Text, description : Text, options : [Text]) : async ?Proposal {
    if (not isAdmin(password)) {
      return null;
    };
    let startTime = Time.now();
    let duration = 7 * 24 * 60 * 60 * 1_000_000_000; // 7 days in nanoseconds
    let proposal : Proposal = {
      id = nextProposalId;
      title;
      description;
      options;
      startTime;
      endTime = startTime + duration;
      isOpen = true;
    };
    proposals := proposals.concat([proposal]);
    nextProposalId += 1;
    ?proposal;
  };

  public shared func closeProposal(password : Text, proposalId : Nat) : async Bool {
    if (not isAdmin(password)) {
      return false;
    };
    proposals := proposals.map(
      func(p) {
        if (p.id == proposalId) {
          {
            id = p.id;
            title = p.title;
            description = p.description;
            options = p.options;
            startTime = p.startTime;
            endTime = p.endTime;
            isOpen = false;
          };
        } else { p };
      }
    );
    true;
  };

  public shared ({ caller }) func castVote(proposalId : Nat, voterPrincipal : Text, optionIndex : Nat, weight : Nat) : async Bool {
    // Verify caller is authenticated (at least a user)
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can vote");
    };
    
    // Verify caller matches voterPrincipal to prevent vote spoofing
    let callerText = caller.toText();
    if (callerText != voterPrincipal) {
      Runtime.trap("Unauthorized: Cannot vote on behalf of another user");
    };

    let currentTime = Time.now();
    // Check if proposal exists and is open
    let proposalArray = proposals.filter(func(p) { p.id == proposalId });
    if (proposalArray.size() == 0) {
      return false;
    };
    let proposal = proposalArray.values().next();
    switch (proposal) {
      case (null) { return false };
      case (?p) {
        if (not p.isOpen or currentTime > p.endTime) {
          return false;
        };
        // Check if voter already voted
        let hasVoted = votes.any(
          func(v) { v.proposalId == proposalId and v.voterPrincipal == voterPrincipal }
        );
        if (hasVoted) {
          return false;
        };
      };
    };
    // Record the vote
    let vote : Vote = {
      proposalId;
      voterPrincipal;
      optionIndex;
      weight;
    };
    votes := votes.concat([vote]);
    true;
  };

  public query ({ caller }) func hasVoted(proposalId : Nat, voterPrincipal : Text) : async Bool {
    // Allow checking own vote status or admin checking any vote
    let callerText = caller.toText();
    if (callerText != voterPrincipal and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only check your own vote status");
    };
    votes.any(
      func(v) { v.proposalId == proposalId and v.voterPrincipal == voterPrincipal }
    );
  };

  public query func getProposals() : async [Proposal] {
    // Public read access - no authorization required
    proposals;
  };

  public query func getVotesForProposal(proposalId : Nat) : async [Vote] {
    // Public read access - no authorization required (voting is transparent)
    votes.filter(func(v) { v.proposalId == proposalId });
  };

  //------------------------------ Community Chat ------------------------------

  public shared ({ caller }) func addChatMessage(proposalId : Nat, author : Text, message : Text) : async ?ChatMessage {
    // Verify caller is authenticated (at least a user)
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can post messages");
    };
    
    // Verify caller matches author to prevent message spoofing
    let callerText = caller.toText();
    if (callerText != author) {
      Runtime.trap("Unauthorized: Cannot post messages on behalf of another user");
    };

    let chatMessage : ChatMessage = {
      id = nextChatId;
      proposalId;
      author;
      message;
      timestamp = Time.now();
    };
    chatMessages := chatMessages.concat([chatMessage]);
    nextChatId += 1;
    ?chatMessage;
  };

  public query func getChatMessages(proposalId : Nat) : async [ChatMessage] {
    // Public read access - no authorization required
    chatMessages.filter(func(m) { m.proposalId == proposalId });
  };
};
