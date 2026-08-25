import { base } from "./base"

/**
 * Admin endpoint: retrieve all institutions and their org profile/billing metadata.
 * Institution managers read their own org via /api/institution/me/overview.
 */
export const getAllInstitutions = () => base("institutions")
