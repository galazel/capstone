package com.capstone.rebyu.aigateway.dto;

/** Where grounded source material for AI question drafts comes from. */
public enum QuestionGenerationSourceMode {
    /** Permanent indexed certification knowledge only; no upload needed. */
    CERTIFICATION_KNOWLEDGE,
    /** Temporary uploaded files only; nothing is stored permanently. */
    UPLOADED_FILES,
    /** Permanent knowledge plus temporary files; permanent wins conflicts. */
    COMBINED
}
