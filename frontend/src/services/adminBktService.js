import { base } from "./base"
export const getBktOutboxStats = () => base("admin/bkt/outbox/stats")
export const getBktOutbox = (status = "PENDING") => base(`admin/bkt/outbox?status=${status}&limit=100`)
export const retryBktOutboxEvent = (id) => base(`admin/bkt/outbox/${id}/retry`, { method: "POST" })
export const reconcileBkt = () => base("admin/bkt/reconcile?limit=200", { method: "POST" })
