import Array "mo:base/Array";
import Time "mo:base/Time";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Int "mo:base/Int";

actor {

  // ---- Types ----

  type Announcement = {
    id : Nat;
    title : Text;
    body : Text;
    timestamp : Int;
  };

  // ---- State ----

  stable var announcements : [Announcement] = [];
  stable var nextId : Nat = 1;
  stable var manualICP : Text = "";
  stable var manualBITTY : Text = "";
  stable var manualFund : Text = "";
  stable var manualBittyPriceUSD : Text = "";

  // Kept for upgrade compatibility with previous version
  stable var WALLET_PRINCIPAL : Text = "ns32b-r2krl-rtozy-ymo6u-7pujx-gr7ff-uhyup-fsm3v-t5ul7-5lj3b-mqe";
  stable var FUND_WALLET_PRINCIPAL : Text = "vqr3d-eby7o-fiwpf-pllu5-yzmxy-4ut67-gnxgr-nfiqw-c3ked-6arfu-zae";
  stable var ICP_LEDGER_ID : Text = "ryjl3-tyaaa-aaaaa-aaaba-cai";
  stable var BITTY_LEDGER_ID : Text = "qroj6-lyaaa-aaaam-qeqta-cai";

  let ADMIN_PASSWORD = "bittybittywhatwhat";

  // ---- Admin Auth ----

  public func adminLogin(password : Text) : async Bool {
    password == ADMIN_PASSWORD
  };

  func isAdmin(password : Text) : Bool {
    password == ADMIN_PASSWORD
  };

  // ---- Manual Balances ----

  public query func getManualBalances() : async { icp : Text; bitty : Text; fund : Text; bittyPriceUsd : Text } {
    { icp = manualICP; bitty = manualBITTY; fund = manualFund; bittyPriceUsd = manualBittyPriceUSD }
  };

  public func setManualBalances(password : Text, icp : Text, bitty : Text) : async Bool {
    if (not isAdmin(password)) return false;
    manualICP := icp;
    manualBITTY := bitty;
    true
  };

  public func setManualFundBalance(password : Text, fund : Text) : async Bool {
    if (not isAdmin(password)) return false;
    manualFund := fund;
    true
  };

  public func setManualBittyPrice(password : Text, price : Text) : async Bool {
    if (not isAdmin(password)) return false;
    manualBittyPriceUSD := price;
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
