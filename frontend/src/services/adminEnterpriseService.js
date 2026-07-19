import { base } from "./base"

/**
 * Admin endpoint: retrieve all enterprises and their org profile/billing metadata.
 * Enterprise managers read their own org via /api/enterprise/me/overview.
 */
export const getAllEnterprises = () => base("enterprises")
