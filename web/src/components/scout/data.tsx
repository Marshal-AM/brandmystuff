"use client";
/**
 * Live data for the Scout experience. Replaces the reference mock's static data.ts:
 * scenes read the current ScoutLive through useScout() instead of module constants.
 */
import { createContext, useContext } from "react";
import type { ArtKind, LandId, NodeIcon, ScoutCandidate, ScoutDistrict, ScoutLand, ScoutLive, ScoutNode } from "@/lib/scout/types";

export type { ArtKind, LandId, ScoutCandidate, ScoutDistrict, ScoutLive };
export type NodeSpec = ScoutNode;
export type LandSpec = ScoutLand;
export type AdSpace = ScoutCandidate;
export type District = ScoutDistrict;
export type { NodeIcon };

/** Settlement network copy (stage names shown during payment). */
export const CHAIN = {
  name: "Sui",
  explorer: "https://suiscan.xyz/testnet",
  stages: ["Submitted", "Certified", "Checkpointed"],
};

export const PARENT = "brandmystuff.eth";

export const ScoutCtx = createContext<ScoutLive | null>(null);

export function useScout(): ScoutLive {
  const v = useContext(ScoutCtx);
  if (!v) throw new Error("useScout outside <ScoutExperience>");
  return v;
}

/** Districts to fly through: the server's, or derived from the candidates. */
export function districtsOf(live: ScoutLive): ScoutDistrict[] {
  if (live.universe?.districts?.length) return live.universe.districts;
  const by = new Map<string, number>();
  for (const c of live.candidates ?? []) by.set(c.district, (by.get(c.district) ?? 0) + 1);
  return [...by.entries()].map(([id, n]) => ({ id, name: id.replace(/(^|-)(\w)/g, (_, s, ch) => (s ? " " : "") + ch.toUpperCase()), listings: n, thought: "" }));
}

export const pickOf = (live: ScoutLive) => live.candidates?.find((c) => c.id === live.pickId) ?? null;

export const short = (a?: string | null, n = 6) => (!a ? "—" : a.length > n * 2 + 1 ? `${a.slice(0, n)}…${a.slice(-4)}` : a);

export const initialOf = (name: string) => (name.trim()[0] ?? "B").toUpperCase();
