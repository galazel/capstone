-- Accounts an organization creates for its people (group leaders, co-admins)
-- were typed ENTERPRISE, the same as the organization's own owner account, so
-- the two were indistinguishable by role. They are ENTERPRISE_MEMBER from now
-- on; both roles carry identical permissions (see
-- CognitoAuthService.isEnterpriseRole), this only makes them tellable apart.
INSERT INTO user_types (user_type_text)
SELECT 'ENTERPRISE_MEMBER'
WHERE NOT EXISTS (
    SELECT 1 FROM user_types WHERE user_type_text = 'ENTERPRISE_MEMBER'
);

-- Repoint the accounts that should already have been members: anyone linked to
-- an organization as a non-owner, plus anyone actively leading a group.
-- Owners and primary contacts are excluded, so an owner who also happens to
-- lead a group keeps the organization's own ENTERPRISE account type.
UPDATE users u
SET user_type_id = (SELECT user_type_id FROM user_types WHERE user_type_text = 'ENTERPRISE_MEMBER')
WHERE u.user_type_id = (SELECT user_type_id FROM user_types WHERE user_type_text = 'ENTERPRISE')
  AND EXISTS (
      SELECT 1 FROM enterprise_members em
      WHERE em.user_id = u.user_id
        AND em.member_role <> 'owner'
        AND em.is_primary_contact = FALSE
  )
  AND NOT EXISTS (
      SELECT 1 FROM enterprise_members em2
      WHERE em2.user_id = u.user_id
        AND (em2.member_role = 'owner' OR em2.is_primary_contact = TRUE)
  );
