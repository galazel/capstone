-- Byte size of an uploaded reviewer (PDF/DOCX), so the feed's attachment tile can
-- show "PDF · 1.2 MB" instead of a generic label. Null for older posts and for
-- posts whose payload is a shared study set rather than a file.
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS attachment_size BIGINT;
