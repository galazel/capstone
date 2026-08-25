CREATE TABLE institution_files (
    institution_file_id BIGSERIAL PRIMARY KEY,
    institution_id BIGINT NOT NULL REFERENCES institutions(institution_id) ON DELETE CASCADE,
    uploaded_by_user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(120),
    file_size BIGINT NOT NULL DEFAULT 0,
    storage_key VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_institution_files_institution_created ON institution_files(institution_id, created_at DESC);
