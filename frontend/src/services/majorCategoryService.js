import { base } from "./base.js"

// ownerGroupId is required for an Enterprise Member creating their own
// content; omitted, the backend requires ADMIN and creates official content.
export async function createMajorCategory(data, ownerGroupId) {
  const query = ownerGroupId != null ? `?ownerGroupId=${ownerGroupId}` : ""
  return await base(`major-categories${query}`, {
    method: "POST",
    data,
  })
}
