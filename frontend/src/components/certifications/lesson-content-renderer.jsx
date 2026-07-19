import { getFileViewUrl } from "@/services/fileService.js"
import { parseLessonStructure } from "@/services/learnerService.js"

// Shared, presentational lesson-body renderer -- extracted verbatim from
// the learner lesson page so the enterprise content viewer renders lessons
// identically. Pure: takes a block (tool) or a structure string, no data
// fetching, no progress/completion concerns.
function renderText(text, className) {
  return String(text ?? "")
      .split("\n")
      .filter(Boolean)
      .map((line, index) => (
          <p key={`${line}-${index}`} className={className}>
            {line}
          </p>
      ))
}

function LessonTool({ tool }) {
  const data = tool?.data ?? {}

  if (tool.type === "heading") {
    return (
        <h2 className="text-3xl font-bold tracking-tight text-zinc-950">
          {data.text}
        </h2>
    )
  }

  if (tool.type === "subheading") {
    return (
        <h3 className="text-xl font-semibold text-zinc-900">
          {data.text}
        </h3>
    )
  }

  if (tool.type === "description") {
    return (
        <div className="space-y-3">
          {renderText(data.text, "text-base leading-8 text-zinc-600")}
        </div>
    )
  }

  if (tool.type === "unordered-list" || tool.type === "ordered-list") {
    const Tag = tool.type === "ordered-list" ? "ol" : "ul"

    return (
        <Tag
            className={`space-y-2 pl-6 text-zinc-700 ${
                tool.type === "ordered-list" ? "list-decimal" : "list-disc"
            }`}
        >
          {(data.items ?? []).map((item) => (
              <li key={item.id ?? item.text}>{item.text}</li>
          ))}
        </Tag>
    )
  }

  if (tool.type === "image") {
    return data.imageKey ? (
        <img
            src={getFileViewUrl(data.imageKey)}
            alt=""
            className="max-h-[520px] w-full rounded-2xl bg-zinc-50 object-contain"
        />
    ) : null
  }

  if (tool.type === "video") {
    return data.videoKey ? (
        <video
            controls
            className="w-full rounded-2xl bg-zinc-950"
            src={getFileViewUrl(data.videoKey)}
        />
    ) : null
  }

  if (tool.type === "image-left-text" || tool.type === "image-right-text") {
    const image = data.imageKey ? (
        <img
            src={getFileViewUrl(data.imageKey)}
            alt={data.title ?? ""}
            className="h-72 w-full rounded-2xl object-cover"
        />
    ) : (
        <div className="flex h-72 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
          No image
        </div>
    )

    const text = (
        <div>
          <h3 className="text-xl font-semibold text-zinc-950">
            {data.title}
          </h3>

          <p className="mt-3 leading-7 text-zinc-600">
            {data.description}
          </p>
        </div>
    )

    return (
        <div className="grid gap-6 md:grid-cols-2 md:items-center">
          {tool.type === "image-left-text" ? image : text}
          {tool.type === "image-left-text" ? text : image}
        </div>
    )
  }

  if (tool.type === "tabs") {
    return (
        <div className="grid gap-3 md:grid-cols-2">
          {(data.items ?? []).map((item) => (
              <div
                  key={item.id ?? item.label}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
              >
                <p className="text-sm font-semibold text-zinc-500">
                  {item.label}
                </p>

                <h3 className="mt-2 font-semibold text-zinc-950">
                  {item.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {item.description}
                </p>
              </div>
          ))}
        </div>
    )
  }

  if (tool.type === "accordion") {
    return (
        <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
          {(data.items ?? []).map((item) => (
              <details key={item.id ?? item.title} className="group p-4">
                <summary className="cursor-pointer list-none font-semibold text-zinc-950">
                  {item.title}
                </summary>

                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {item.content}
                </p>
              </details>
          ))}
        </div>
    )
  }

  if (tool.type === "flip-grid") {
    return (
        <div className="grid gap-4 md:grid-cols-2">
          {(data.cards ?? []).map((card) => (
              <div
                  key={card.id ?? card.frontTitle}
                  className="rounded-2xl border border-zinc-200 bg-white p-5"
              >
                <p className="font-semibold text-zinc-950">
                  {card.frontTitle}
                </p>

                <p className="mt-3 text-sm font-medium text-zinc-600">
                  {card.backTitle}
                </p>

                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  {card.description}
                </p>
              </div>
          ))}
        </div>
    )
  }

  if (tool.type === "intro-image-card") {
    return (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-zinc-500">{data.smallHeader}</p>
            {renderText(data.description, "mt-2 text-base leading-8 text-zinc-600")}
          </div>
          {data.imageKey ? (
              <img
                  src={getFileViewUrl(data.imageKey)}
                  alt=""
                  className="max-h-[520px] w-full rounded-2xl bg-zinc-50 object-contain"
              />
          ) : null}
        </div>
    )
  }

  if (tool.type === "header-description-grid" || tool.type === "image-feature-grid") {
    return (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-zinc-500">{data.smallHeader}</p>
            {renderText(data.description, "mt-2 text-base leading-8 text-zinc-600")}
          </div>
          {tool.type === "image-feature-grid" && data.imageKey ? (
              <img
                  src={getFileViewUrl(data.imageKey)}
                  alt=""
                  className="max-h-[420px] w-full rounded-2xl bg-zinc-50 object-contain"
              />
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            {(data.gridItems ?? []).map((item, index) => (
                <div
                    key={item.id ?? index}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                >
                  <h4 className="font-semibold text-zinc-950">{item.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {item.description}
                  </p>
                </div>
            ))}
          </div>
        </div>
    )
  }

  if (tool.type === "review-card-grid") {
    return (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-zinc-500">{data.smallHeader}</p>
            {renderText(data.description, "mt-2 text-base leading-8 text-zinc-600")}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {(data.cards ?? []).map((card, index) => (
                <div
                    key={card.id ?? index}
                    className="rounded-2xl border border-zinc-200 bg-white p-5"
                >
                  <p className="font-semibold text-zinc-950">{card.frontTitle}</p>
                  <p className="mt-3 text-sm font-medium text-zinc-600">
                    {card.backTitle}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    {card.description}
                  </p>
                </div>
            ))}
          </div>
        </div>
    )
  }

  if (tool.type === "content-accordion-block") {
    return (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-zinc-500">{data.smallHeader}</p>
            {renderText(data.description, "mt-2 text-base leading-8 text-zinc-600")}
          </div>
          <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
            {(data.items ?? []).map((item, index) => (
                <details key={item.id ?? index} className="group p-4">
                  <summary className="cursor-pointer list-none font-semibold text-zinc-950">
                    {item.title}
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">
                    {item.content}
                  </p>
                </details>
            ))}
          </div>
        </div>
    )
  }

  if (tool.type === "content-tabs-block") {
    return (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-zinc-500">{data.smallHeader}</p>
            {renderText(data.description, "mt-2 text-base leading-8 text-zinc-600")}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(data.items ?? []).map((item, index) => (
                <div
                    key={item.id ?? index}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                >
                  <p className="text-sm font-semibold text-zinc-500">{item.label}</p>
                  <h3 className="mt-2 font-semibold text-zinc-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {item.description}
                  </p>
                </div>
            ))}
          </div>
        </div>
    )
  }

  if (tool.type === "media-text-block") {
    const mediaOnRight = data.layout === "image-right"
    const media =
        data.mediaType === "video" ? (
            data.videoKey ? (
                <video
                    controls
                    className="w-full rounded-2xl bg-zinc-950"
                    src={getFileViewUrl(data.videoKey)}
                />
            ) : (
                <div className="flex h-72 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
                  No video
                </div>
            )
        ) : data.imageKey ? (
            <img
                src={getFileViewUrl(data.imageKey)}
                alt={data.supportingTitle ?? ""}
                className="h-72 w-full rounded-2xl object-cover"
            />
        ) : (
            <div className="flex h-72 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
              No media
            </div>
        )

    const text = (
        <div>
          {data.supportingTitle ? (
              <h3 className="text-xl font-semibold text-zinc-950">
                {data.supportingTitle}
              </h3>
          ) : null}
          {data.supportingDescription ? (
              <p className="mt-3 leading-7 text-zinc-600">
                {data.supportingDescription}
              </p>
          ) : null}
        </div>
    )

    return (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-zinc-500">{data.smallHeader}</p>
            {renderText(data.description, "mt-2 text-base leading-8 text-zinc-600")}
          </div>
          <div className="grid gap-6 md:grid-cols-2 md:items-center">
            {mediaOnRight ? text : media}
            {mediaOnRight ? media : text}
          </div>
        </div>
    )
  }

  return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
        Unsupported lesson block: {tool.type}
      </div>
  )
}

export { LessonTool }

/** Parses a lesson_component_structure string and renders its blocks. */
export function LessonContent({ structure, className = "space-y-8" }) {
  const blocks = parseLessonStructure(structure)
  if (blocks.length === 0) {
    return null
  }
  return (
    <div className={className}>
      {blocks.map((tool, index) => (
        <LessonTool key={tool.id ?? index} tool={tool} />
      ))}
    </div>
  )
}
