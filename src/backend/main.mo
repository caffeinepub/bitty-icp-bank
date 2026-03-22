import Principal "mo:base/Principal";
import Array "mo:base/Array";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Int "mo:base/Int";
import Iter "mo:base/Iter";

actor {

  // ---- Types ----

  type Account = {
    owner : Principal;
    subaccount : ?[Nat8];
  };

  type Announcement = {
    id : Nat;
    title : Text;
    body : Text;
    timestamp : Int;
  };

  // ICRC-1 ledger interface
  type ICRC1Ledger = actor {
    icrc1_balance_of : (Account) -> async Nat;
  };

  // ---- State ----

  stable var announcements : [Announcement] = [];
  stable var nextId : Nat = 1;
  stable var manualICP : Text = "";
  stable var manualBITTY : Text = "";
  let ADMIN_PASSWORD = "bittybittywhatwhat";
  let WALLET_PRINCIPAL = "ns32b-r2krl-rtozy-ymo6u-7pujx-gr7ff-uhyup-fsm3v-t5ul7-5lj3b-mqe";
  let ICP_LEDGER_ID = "ryjl3-tyaaa-aaaaa-aaaba-cai";
  let BITTY_LEDGER_ID = "qroj6-lyaaa-aaaam-qeqta-cai";

  // ---- Admin Auth ----

  public func adminLogin(password : Text) : async Bool {
    password == ADMIN_PASSWORD
  };

  func isAdmin(password : Text) : Bool {
    password == ADMIN_PASSWORD
  };

  // ---- Live Balances ----

  public func getLiveICPBalance() : async ?Nat {
    let walletPrincipal = Principal.fromText(WALLET_PRINCIPAL);
    let ledger : ICRC1Ledger = actor(ICP_LEDGER_ID);
    let account : Account = { owner = walletPrincipal; subaccount = null };
    try {
      let balance = await ledger.icrc1_balance_of(account);
      ?balance
    } catch (_) {
      null
    }
  };

  public func getLiveBITTYBalance() : async ?Nat {
    let walletPrincipal = Principal.fromText(WALLET_PRINCIPAL);
    let ledger : ICRC1Ledger = actor(BITTY_LEDGER_ID);
    let account : Account = { owner = walletPrincipal; subaccount = null };
    try {
      let balance = await ledger.icrc1_balance_of(account);
      ?balance
    } catch (_) {
      null
    }
  };

  // ---- Manual Balances ----

  public query func getManualBalances() : async { icp : Text; bitty : Text } {
    { icp = manualICP; bitty = manualBITTY }
  };

  public func setManualBalances(password : Text, icp : Text, bitty : Text) : async Bool {
    if (not isAdmin(password)) return false;
    manualICP := icp;
    manualBITTY := bitty;
    true
  };

  // ---- Announcements ----

  public query func getAnnouncements() : async [Announcement] {
    announcements
  };

  public func addAnnouncement(password : Text, title : Text, body : Text) : async ?Announcement {
    if (not isAdmin(password)) return null;
    let ann : Announcement = {
      id = nextId;
      title = title;
      body = body;
      timestamp = Time.now();
    };
    announcements := Array.append(announcements, [ann]);
    nextId += 1;
    ?ann
  };

  public func updateAnnouncement(password : Text, id : Nat, title : Text, body : Text) : async Bool {
    if (not isAdmin(password)) return false;
    announcements := Array.map(announcements, func(a : Announcement) : Announcement {
      if (a.id == id) { { id = a.id; title = title; body = body; timestamp = a.timestamp } }
      else a
    });
    true
  };

  public func deleteAnnouncement(password : Text, id : Nat) : async Bool {
    if (not isAdmin(password)) return false;
    announcements := Array.filter(announcements, func(a : Announcement) : Bool { a.id != id });
    true
  };

}
