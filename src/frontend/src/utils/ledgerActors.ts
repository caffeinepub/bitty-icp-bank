import { Actor, HttpAgent } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";

const ICP_LEDGER_ID = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const BITTY_LEDGER_ID = "qroj6-lyaaa-aaaam-qeqta-cai";

const icrc1IdlFactory = ({ IDL }: { IDL: any }) => {
  const Account = IDL.Record({
    owner: IDL.Principal,
    subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  return IDL.Service({
    icrc1_balance_of: IDL.Func([Account], [IDL.Nat], ["query"]),
  });
};

async function createAgent() {
  return await HttpAgent.create({
    host: "https://ic0.app",
  });
}

export async function getICPBalance(
  principalText: string,
): Promise<bigint | null> {
  try {
    const agent = await createAgent();
    const actor = Actor.createActor(icrc1IdlFactory, {
      agent,
      canisterId: ICP_LEDGER_ID,
    });
    const principal = Principal.fromText(principalText);
    const balance = await (actor as any).icrc1_balance_of({
      owner: principal,
      subaccount: [],
    });
    return BigInt(balance);
  } catch (e) {
    console.error("ICP balance fetch failed:", e);
    return null;
  }
}

export async function getBITTYBalance(
  principalText: string,
): Promise<bigint | null> {
  try {
    const agent = await createAgent();
    const actor = Actor.createActor(icrc1IdlFactory, {
      agent,
      canisterId: BITTY_LEDGER_ID,
    });
    const principal = Principal.fromText(principalText);
    const balance = await (actor as any).icrc1_balance_of({
      owner: principal,
      subaccount: [],
    });
    return BigInt(balance);
  } catch (e) {
    console.error("BITTY balance fetch failed:", e);
    return null;
  }
}
