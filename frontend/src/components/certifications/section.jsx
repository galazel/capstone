import React from "react"
import { Trash2 } from "@/components/icons"
import {
    AccordionTool,
    DescriptionTool,
    FlipGridTool,
    HeadingTool,
    ImageTool,
    TabsTool,
    VideoTool,
    SubheadingTool,
    UnorderedListTool,
    OrderedListTool,
    ImageLeftTextTool,
    ImageRightTextTool,
    IntroImageCardTool,
    HeaderDescriptionGridTool,
    ImageFeatureGridTool,
    ReviewCardGridTool,
    ContentAccordionBlockTool,
    ContentTabsBlockTool,
    MediaTextBlockTool,
    ImageHotspotTool,
} from "./tools.jsx"

const TOOL_COMPONENTS = {
    heading: HeadingTool,
    subheading: SubheadingTool,
    description: DescriptionTool,
    "unordered-list": UnorderedListTool,
    "ordered-list": OrderedListTool,
    tabs: TabsTool,
    accordion: AccordionTool,
    "flip-grid": FlipGridTool,
    image: ImageTool,
    video: VideoTool,
    "image-left-text": ImageLeftTextTool,
    "image-right-text": ImageRightTextTool,
    "intro-image-card": IntroImageCardTool,
    "header-description-grid": HeaderDescriptionGridTool,
    "image-feature-grid": ImageFeatureGridTool,
    "review-card-grid": ReviewCardGridTool,
    "content-accordion-block": ContentAccordionBlockTool,
    "content-tabs-block": ContentTabsBlockTool,
    "media-text-block": MediaTextBlockTool,
    "image-hotspot": ImageHotspotTool,
}

function Section({
                     section,
                     onChange,
                     onDelete,
                     handleToolDataChange,
                     onClick,
                     sectionIndex,
                     handleRemovalTool,
                 }) {
    const tools = section.content ?? []

    return (
        <div
            className="group relative mx-auto w-full max-w-5xl min-w-0"
            onClick={onClick}
        >
            <div className="mb-3 flex min-w-0 items-center justify-between gap-3 px-1">
                <input
                    id={`section-name-${section.id}`}
                    type="text"
                    value={section.sectionName ?? ""}
                    onChange={(event) =>
                        onChange(section.id, "sectionName", event.target.value)
                    }
                    placeholder="Untitled Section"
                    className="w-full max-w-sm min-w-0 bg-transparent text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground outline-none placeholder:text-muted-foreground/60 focus:text-foreground"
                />

                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation()
                        onDelete(section.id)
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-100 transition hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                    title="Delete section"
                    aria-label="Delete section"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>

            {/* 720px is a page's worth of height, which is right for a section
                being filled and absurd for one that is empty -- it made a
                blank section a full screen of nothing to scroll past. */}
            <article
                className={`w-full overflow-hidden rounded-xl bg-card ring-1 ring-border/60 ${
                    tools.length === 0 ? "" : "min-h-[720px]"
                }`}
            >
                <div
                    className={`flex w-full flex-col gap-3 p-8 ${
                        tools.length === 0 ? "" : "min-h-[720px]"
                    }`}
                >
                    {/* An empty section is a real state, not a glitch: the
                        generator opens a lesson with a title-only section, and
                        a new section starts with nothing in it. Rendered as
                        bare whitespace it read as content that had failed to
                        load, so it says what it is. */}
                    {tools.length === 0 ? (
                        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/70 text-center">
                            <p className="text-sm font-medium text-muted-foreground">
                                This section is empty
                            </p>
                            <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground/80">
                                Add a tool from the panel on the left to put
                                something in it.
                            </p>
                        </div>
                    ) : null}

                    {tools.map((item, toolIndex) => {
                        const ToolComponent = TOOL_COMPONENTS[item.type]

                        if (!ToolComponent) {
                            return (
                                <div
                                    key={item.id ?? toolIndex}
                                    className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                                >
                                    <p className="font-medium">Unknown tool type: {item.type}</p>
                                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-background/70 p-2 text-xs text-destructive">
                    {JSON.stringify(item, null, 2)}
                  </pre>
                                </div>
                            )
                        }

                        return (
                            <ToolComponent
                                key={item.id ?? toolIndex}
                                data={item.data}
                                onDelete={() => handleRemovalTool(sectionIndex, toolIndex)}
                                onDataChange={(newData) =>
                                    handleToolDataChange(sectionIndex, toolIndex, newData)
                                }
                            />
                        )
                    })}
                </div>
            </article>
        </div>
    )
}

export default Section
