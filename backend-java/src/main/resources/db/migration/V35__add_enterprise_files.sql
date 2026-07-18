CREATE TABLE enterprise_files (
    enterprise_file_id BIGSERIAL PRIMARY KEY,
    enterprise_id BIGINT NOT NULL REFERENCES enterprises(enterprise_id) ON DELETE CASCADE,
    uploaded_by_user_id BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(120),
    file_size BIGINT NOT NULL DEFAULT 0,
    storage_key VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_enterprise_files_enterprise_created ON enterprise_files(enterprise_id, created_at DESC);
