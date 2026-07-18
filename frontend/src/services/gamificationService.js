import { base } from "./base"

export const getMyRewardBalance = () => base("gamification/me/balance")
export const getLeaderboard = (scope = "overall", period = "all") => base(`gamification/leaderboard?scope=${encodeURIComponent(scope)}&period=${encodeURIComponent(period)}`)
export const convertCoinsToAiCredits = (coins, idempotencyKey) =>
  base("gamification/me/convert-coins", { method: "POST", data: { coins, idempotencyKey } })
export const getMyRewardLedger = () => base("gamification/me/ledger")
