import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;

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

export interface backendInterface {
  adminLogin: (password: string) => Promise<boolean>;
  getManualBalances: () => Promise<ManualBalances>;
  setManualBalances: (password: string, icp: string, bitty: string) => Promise<boolean>;
  setManualFundBalance: (password: string, fund: string) => Promise<boolean>;
  setManualBittyPrice: (password: string, price: string) => Promise<boolean>;
  getAnnouncements: () => Promise<Announcement[]>;
  addAnnouncement: (password: string, title: string, body: string) => Promise<[] | [Announcement]>;
  updateAnnouncement: (password: string, id: bigint, title: string, body: string) => Promise<boolean>;
  deleteAnnouncement: (password: string, id: bigint) => Promise<boolean>;
}
