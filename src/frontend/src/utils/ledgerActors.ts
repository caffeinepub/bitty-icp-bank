import { Actor, HttpAgent } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";

const ICP_LEDGER_ID = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const BITTY_LEDGER_ID = "qroj6-lyaaa-aaaam-qeqta-cai";

const TRANSFER_FEE = BigInt(10_000); // 0.0001 in e8s

const icrc1IdlFactory = ({ IDL }: { IDL: any }) => {
  const Account = IDL.Record({
    owner: IDL.Principal,
    subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  const TransferArgs = IDL.Record({
    from_subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
    to: Account,
    amount: IDL.Nat,
    fee: IDL.Opt(IDL.Nat),
    memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
    created_at_time: IDL.Opt(IDL.Nat64),
  });
  const TransferError = IDL.Variant({
    BadFee: IDL.Record({ expected_fee: IDL.Nat }),
    BadBurn: IDL.Record({ min_burn_amount: IDL.Nat }),
    InsufficientFunds: IDL.Record({ balance: IDL.Nat }),
    TooOld: IDL.Null,
    CreatedInFuture: IDL.Record({ ledger_time: IDL.Nat64 }),
    Duplicate: IDL.Record({ duplicate_of: IDL.Nat }),
    TemporarilyUnavailable: IDL.Null,
    GenericError: IDL.Record({ error_code: IDL.Nat, message: IDL.Text }),
  });
  const TransferResult = IDL.Variant({
    Ok: IDL.Nat,
    Err: TransferError,
  });
  return IDL.Service({
    icrc1_balance_of: IDL.Func([Account], [IDL.Nat], ["query"]),
    icrc1_transfer: IDL.Func([TransferArgs], [TransferResult], []),
  });
};

let _agentPromise: Promise<HttpAgent> | null = null;

function createAgent(): Promise<HttpAgent> {
  if (!_agentPromise) {
    _agentPromise = HttpAgent.create({
      host: "https://ic0.app",
      verifyQuerySignatures: false,
    });
  }
  return _agentPromise;
}

async function createAuthenticatedAgent(identity: any) {
  return await HttpAgent.create({
    host: "https://ic0.app",
    identity,
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

export async function sendBITTY(
  identity: any,
  toPrincipal: string,
  amountE8s: bigint,
): Promise<{ ok: bigint } | { err: string }> {
  try {
    const to = Principal.fromText(toPrincipal); // validates address early
    const agent = await createAuthenticatedAgent(identity);
    const actor = Actor.createActor(icrc1IdlFactory, {
      agent,
      canisterId: BITTY_LEDGER_ID,
    });
    const result = await (actor as any).icrc1_transfer({
      from_subaccount: [],
      to: { owner: to, subaccount: [] },
      amount: amountE8s,
      fee: [TRANSFER_FEE],
      memo: [],
      created_at_time: [],
    });
    if ("Ok" in result) return { ok: result.Ok };
    const errKey = Object.keys(result.Err)[0];
    const errDetail = result.Err[errKey];
    if (errKey === "InsufficientFunds") {
      const bal = Number(errDetail.balance) / 1e8;
      return { err: `Insufficient funds. Balance: ${bal.toFixed(4)} BITTYICP` };
    }
    return { err: errKey };
  } catch (e: any) {
    return { err: e?.message ?? "Transfer failed" };
  }
}

export async function sendICP(
  identity: any,
  toPrincipal: string,
  amountE8s: bigint,
): Promise<{ ok: bigint } | { err: string }> {
  try {
    const to = Principal.fromText(toPrincipal);
    const agent = await createAuthenticatedAgent(identity);
    const actor = Actor.createActor(icrc1IdlFactory, {
      agent,
      canisterId: ICP_LEDGER_ID,
    });
    const result = await (actor as any).icrc1_transfer({
      from_subaccount: [],
      to: { owner: to, subaccount: [] },
      amount: amountE8s,
      fee: [TRANSFER_FEE],
      memo: [],
      created_at_time: [],
    });
    if ("Ok" in result) return { ok: result.Ok };
    const errKey = Object.keys(result.Err)[0];
    const errDetail = result.Err[errKey];
    if (errKey === "InsufficientFunds") {
      const bal = Number(errDetail.balance) / 1e8;
      return { err: `Insufficient funds. Balance: ${bal.toFixed(4)} ICP` };
    }
    return { err: errKey };
  } catch (e: any) {
    return { err: e?.message ?? "Transfer failed" };
  }
}

export const BITTY_LEDGER_ID_EXPORT = BITTY_LEDGER_ID;
export { icrc1IdlFactory };
