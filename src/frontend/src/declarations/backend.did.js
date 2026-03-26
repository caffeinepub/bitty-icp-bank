/* eslint-disable */

// @ts-nocheck

import { IDL } from '@icp-sdk/core/candid';

const Announcement = IDL.Record({
  id: IDL.Nat,
  title: IDL.Text,
  body: IDL.Text,
  timestamp: IDL.Int,
});

const ManualBalances = IDL.Record({
  icp: IDL.Text,
  bitty: IDL.Text,
  fund: IDL.Text,
  bittyPriceUsd: IDL.Text,
});

export const idlService = IDL.Service({
  adminLogin: IDL.Func([IDL.Text], [IDL.Bool], []),
  getManualBalances: IDL.Func([], [ManualBalances], ['query']),
  setManualBalances: IDL.Func([IDL.Text, IDL.Text, IDL.Text], [IDL.Bool], []),
  setManualFundBalance: IDL.Func([IDL.Text, IDL.Text], [IDL.Bool], []),
  setManualBittyPrice: IDL.Func([IDL.Text, IDL.Text], [IDL.Bool], []),
  getAnnouncements: IDL.Func([], [IDL.Vec(Announcement)], ['query']),
  addAnnouncement: IDL.Func([IDL.Text, IDL.Text, IDL.Text], [IDL.Opt(Announcement)], []),
  updateAnnouncement: IDL.Func([IDL.Text, IDL.Nat, IDL.Text, IDL.Text], [IDL.Bool], []),
  deleteAnnouncement: IDL.Func([IDL.Text, IDL.Nat], [IDL.Bool], []),
});

export const idlInitArgs = [];

export const idlFactory = ({ IDL }) => {
  const Announcement = IDL.Record({
    id: IDL.Nat,
    title: IDL.Text,
    body: IDL.Text,
    timestamp: IDL.Int,
  });
  const ManualBalances = IDL.Record({
    icp: IDL.Text,
    bitty: IDL.Text,
    fund: IDL.Text,
    bittyPriceUsd: IDL.Text,
  });
  return IDL.Service({
    adminLogin: IDL.Func([IDL.Text], [IDL.Bool], []),
    getManualBalances: IDL.Func([], [ManualBalances], ['query']),
    setManualBalances: IDL.Func([IDL.Text, IDL.Text, IDL.Text], [IDL.Bool], []),
    setManualFundBalance: IDL.Func([IDL.Text, IDL.Text], [IDL.Bool], []),
    setManualBittyPrice: IDL.Func([IDL.Text, IDL.Text], [IDL.Bool], []),
    getAnnouncements: IDL.Func([], [IDL.Vec(Announcement)], ['query']),
    addAnnouncement: IDL.Func([IDL.Text, IDL.Text, IDL.Text], [IDL.Opt(Announcement)], []),
    updateAnnouncement: IDL.Func([IDL.Text, IDL.Nat, IDL.Text, IDL.Text], [IDL.Bool], []),
    deleteAnnouncement: IDL.Func([IDL.Text, IDL.Nat], [IDL.Bool], []),
  });
};

export const init = ({ IDL }) => { return []; };
