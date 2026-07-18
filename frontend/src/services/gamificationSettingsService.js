import { base } from "./base"

export const getGamificationSettings = () => base("admin/gamification-settings")

export const updateGamificationSettings = (data) =>
  base("admin/gamification-settings", { method: "PUT", data })
