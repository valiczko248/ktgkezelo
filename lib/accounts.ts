import type { Account } from "./types";

export function excludedAccountIds(accounts: Account[]): Set<string> {
  return new Set(accounts.filter((a) => !a.include_in_stats).map((a) => a.id));
}
