package com.capstone.rebyu.aigateway.dto;

/**
 * Diagram kinds a generated DIAGRAM question may ask for.
 *
 * <p>The first seven are what generation now emits, and they match the
 * authoring editor's options and the diagram playground's tool presets --
 * the learner's canvas is equipped from this value, so a type outside the
 * set would hand them another diagram's shapes.
 *
 * <p>The rest are kept only so questions authored before that list was
 * settled still deserialize.
 */
public enum GeneratedDiagramType {
    ACTIVITY_DIAGRAM,
    UML_CLASS,
    UML_COMPONENT,
    ERD,
    FLOWCHART,
    SEQUENCE_DIAGRAM,
    USE_CASE,

    // Legacy values. Not generated any more; still readable.
    UML_SEQUENCE,
    DFD,
    MIND_MAP,
    NETWORK_DIAGRAM,
    UI_DESIGN
}
