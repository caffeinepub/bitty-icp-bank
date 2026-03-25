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
}

export interface _SERVICE {
  adminLogin: (password: string) => Promise<boolean>;
  getManualBalances: () => Promise<ManualBalances>;
  setManualBalances: (password: string, icp: string, bitty: string) => Promise<boolean>;
  setManualFundBalance: (password: string, fund: string) => Promise<boolean>;
  getAnnouncements: () => Promise<Announcement[]>;
  addAnnouncement: (password: string, title: string, body: string) => Promise<[] | [Announcement]>;
  updateAnnouncement: (password: string, id: bigint, title: string, body: string) => Promise<boolean>;
  deleteAnnouncement: (password: string, id: bigint) => Promise<boolean>;
}

export declare const createActor: (canisterId: string) => ActorSubclass<_SERVICE>;
export declare const canisterId: string;
