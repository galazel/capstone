/**
 * Which draw.io shape palette each diagram type is drawn with.
 *
 * Its own module, and deliberately import-free, so the resolution can be
 * checked without React or the draw.io embed -- see
 * diagram-tool-presets.check.mjs.
 */
/* The shape palette each diagram type gets.
 *
 * `libs` is draw.io's list of sidebar sections, and it is the whole point of
 * this table: a learner asked for a sequence diagram should be looking at
 * lifelines and messages, not at every stencil draw.io ships. Each entry
 * therefore names the sections that diagram is actually drawn with — UML for
 * the four UML types, `er` for entity-relationship work, `flowchart` for
 * process flows — and nothing else.
 *
 * The keys are the canonical types shared by the authoring editor
 * (`DIAGRAM_TYPE_OPTIONS` in components/questions/question-editors.jsx) and
 * generation (`DIAGRAM_TYPES` in the Python question schema). Anything else
 * reaching here is an older question, handled by the aliases below.
 */
const DIAGRAM_TOOL_PRESETS = {
    ACTIVITY_DIAGRAM: {
        label: "Activity Diagram",
        // Activity diagrams are UML, but their initial/final nodes, forks and
        // decisions are the flowchart section's shapes in draw.io.
        libs: "uml;flowchart",
    },
    UML_CLASS: {
        label: "Class Diagram",
        libs: "uml",
    },
    UML_COMPONENT: {
        label: "Component Diagram",
        libs: "uml",
    },
    ERD: {
        label: "ER Diagram",
        libs: "er",
    },
    FLOWCHART: {
        label: "Flowchart",
        libs: "flowchart",
    },
    SEQUENCE_DIAGRAM: {
        label: "Sequence Diagram",
        // draw.io keeps sequence shapes inside the same UML stencil set.
        libs: "uml",
    },
    USE_CASE: {
        label: "Use Case Diagram",
        libs: "uml",
    },
    UI_DESIGN: {
        label: "UI Design",
        libs: "mockups;android;ios;bootstrap",
    },
}

/* Types from before the canonical list was settled, and the spellings a
 * generated question used to arrive with. Mapped rather than dropped: an
 * existing question must keep opening with a sensible palette. Matching
 * ignores case and punctuation, so "er diagram" and "ERD" both land on ERD.
 */
const DIAGRAM_TYPE_ALIASES = {
    UML_SEQUENCE: "SEQUENCE_DIAGRAM",
    SEQUENCE: "SEQUENCE_DIAGRAM",
    CLASS_DIAGRAM: "UML_CLASS",
    CLASS: "UML_CLASS",
    COMPONENT_DIAGRAM: "UML_COMPONENT",
    COMPONENT: "UML_COMPONENT",
    ACTIVITY: "ACTIVITY_DIAGRAM",
    USE_CASE_DIAGRAM: "USE_CASE",
    USECASE: "USE_CASE",
    ER: "ERD",
    ER_DIAGRAM: "ERD",
    ENTITY_RELATIONSHIP: "ERD",
    ENTITY_RELATIONSHIP_DIAGRAM: "ERD",
    FLOW_CHART: "FLOWCHART",
    // Diagram kinds this product no longer authors. Their nearest palette
    // beats the ERD shapes they would otherwise fall back to.
    DFD: "FLOWCHART",
    MIND_MAP: "FLOWCHART",
    NETWORK_DIAGRAM: "UML_COMPONENT",
}

export function getDiagramToolPreset(diagramType) {
    const key = String(diagramType ?? "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")

    const resolved = DIAGRAM_TYPE_ALIASES[key] ?? key
    return DIAGRAM_TOOL_PRESETS[resolved] ?? DIAGRAM_TOOL_PRESETS.ERD
}

