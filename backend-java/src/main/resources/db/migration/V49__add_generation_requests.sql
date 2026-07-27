-- Persisted record of an admin-triggered AI generation request (Phase 5:
-- RabbitMQ producers publish only this row's id, not the full request
-- payload; the consumer re-fetches params from here by id).
CREATE TABLE IF NOT EXISTS generation_requests (
    generation_request_id BIGSERIAL PRIMARY KEY,
    certification_id BIGINT NOT NULL REFERENCES certifications(certification_id),
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('CERTIFICATION', 'QUESTION')),
    params_json TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED')),
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_generation_requests_certification_id ON generation_requests(certification_id);
CREATE INDEX IF NOT EXISTS idx_generation_requests_status ON generation_requests(status);
