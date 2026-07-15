import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
    BookOpen,
    CheckCircle2,
    Clock3,
    Target,
    TrendingUp,
} from "lucide-react";

import { LANDING_IMAGES } from "./landing-images.js";

gsap.registerPlugin(ScrollTrigger);

const STAGES = [
    {
        id: "diagnostic",
        number: "01",
        title: "Diagnostic assessment",
        description:
            "Start with a diagnostic assessment to establish your baseline. REBYU identifies the topics that need attention before building your learning path.",
        icon: Target,
        image: LANDING_IMAGES.roadmap.diagnostic,
        photographer: "Andy Barbour",
        source:
            "https://www.pexels.com/photo/a-high-angle-shot-of-students-taking-exam-inside-the-classroom-6683580/",
        previewTitle: "Diagnostic completed",
        previewText: "Software Engineering is your first priority topic.",
        detail: "42% baseline score",
    },
    {
        id: "plan",
        number: "02",
        title: "Personalized study plan",
        description:
            "Bayesian Knowledge Tracing (BKT) uses your answers to estimate mastery by topic. Those estimates turn your weaker areas into an ordered plan of lessons, reviews, and milestones.",
        icon: BookOpen,
        image: LANDING_IMAGES.roadmap.plan,
        photographer: "Kaboompics.com",
        source:
            "https://www.pexels.com/photo/student-writing-in-planner-while-studying-with-laptop-in-park-4497732/",
        previewTitle: "Today’s study plan",
        previewText: "Review SDLC models, then complete a 15-item lesson quiz.",
        detail: "3 focused tasks",
    },
    {
        id: "lessons",
        number: "03",
        title: "Structured lessons",
        description:
            "Work through focused lessons and quizzes in the topics your plan prioritizes. Each response gives REBYU a clearer view of what you understand and what needs review.",
        icon: CheckCircle2,
        image: LANDING_IMAGES.roadmap.lessons,
        photographer: "Yan Krukau",
        source:
            "https://www.pexels.com/photo/student-using-laptop-8199133/",
        previewTitle: "Software Development",
        previewText: "Lesson 4 of 8 · Development methodologies",
        detail: "67% category mastery",
    },
    {
        id: "mock",
        number: "04",
        title: "Mock examinations",
        description:
            "Put your progress to the test with timed mock examinations. Your results validate your preparation across the full certification scope and reveal any remaining gaps.",
        icon: Clock3,
        image: LANDING_IMAGES.roadmap.mockExam,
        photographer: "Alena Darmel",
        source:
            "https://www.pexels.com/photo/students-busy-using-laptops-in-the-classroom-7742816/",
        previewTitle: "Mock exam ready",
        previewText: "100 questions · 120 minutes · Attempt 1",
        detail: "Timed simulation",
    },
    {
        id: "readiness",
        number: "05",
        title: "Exam readiness",
        description:
            "REBYU combines your mastery estimates, recent performance, and mock-exam results to show whether you are ready—or exactly what to review next.",
        icon: TrendingUp,
        image: LANDING_IMAGES.roadmap.readiness,
        photographer: "Emily Ranquist",
        source:
            "https://www.pexels.com/photo/photography-of-people-graduating-1205651/",
        previewTitle: "Readiness improved",
        previewText: "Your strongest gain is in Software Development.",
        detail: "82% ready",
    },
];

function StagePreview({ stage }) {
    return (
        <div className="overflow-hidden rounded-[1.5rem] border border-[#E0E7EF] bg-white shadow-[0_28px_70px_rgba(11,31,58,0.12)]">
            <figure className="relative h-[220px] overflow-hidden sm:h-[300px] lg:h-[340px]">
                <img
                    src={stage.image}
                    alt={`Learners preparing during the ${stage.title.toLowerCase()} stage`}
                    className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#102A43]/80 via-[#102A43]/10 to-transparent" />

                <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-white/25 bg-[#102A43]/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md">
                    <span>{stage.number}</span>
                    <span className="h-3 w-px bg-white/35" />
                    <span>{stage.title}</span>
                </div>

                <figcaption className="absolute bottom-4 left-5 text-[10px] text-white/75">
                    Photo by{" "}
                    <a
                        href={stage.source}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-white underline-offset-2 hover:underline"
                    >
                        {stage.photographer}
                    </a>
                </figcaption>
            </figure>

            <div className="relative bg-white p-5 sm:p-7">
                <div className="absolute -top-10 right-5 flex min-h-[70px] w-[92px] items-center justify-center rounded-xl border border-white/70 bg-[#2f7dd3] px-3 text-center text-white shadow-[0_14px_32px_rgba(47,125,211,0.22)]">
                    <span className="text-xs font-bold leading-4">{stage.detail}</span>
                </div>

                <div className="pr-24">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5670A2]">
                        Current REBYU step
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-[#273452] sm:text-2xl">
                        {stage.previewTitle}
                    </h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-[#66758A]">
                        {stage.previewText}
                    </p>
                </div>

            </div>
        </div>
    );
}

export function RoadmapSection() {
    const containerRef = useRef(null);
    const progressRef = useRef(null);
    const slideRefs = useRef([]);

    useLayoutEffect(() => {
        const root = containerRef.current;
        if (!root) return;

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        const ctx = gsap.context(() => {
            const progress = progressRef.current;

            if (reducedMotion) {
                gsap.set(progress, { scaleY: 1 });
                return;
            }

            gsap.set(progress, {
                scaleY: 0,
                transformOrigin: "top center",
            });

            gsap.to(progress, {
                scaleY: 1,
                ease: "none",
                scrollTrigger: {
                    trigger: root,
                    start: "top 25%",
                    end: "bottom 85%",
                    scrub: 1,
                },
            });

            // Animate each stage into view as it is reached
            slideRefs.current.forEach((slide) => {
                if (!slide) return;
                const copy = slide.querySelector(".stage-copy");
                const preview = slide.querySelector(".stage-preview");
                const index = Number(slide.dataset.stageIndex ?? 0);
                const copyFrom = index % 2 === 0 ? -56 : 56;
                gsap.fromTo(
                    [copy, preview],
                    {
                        opacity: 0,
                        x: (itemIndex) => itemIndex === 0 ? copyFrom : -copyFrom,
                    },
                    {
                        opacity: 1,
                        x: 0,
                        duration: 0.85,
                        stagger: 0.08,
                        ease: "power3.out",
                        scrollTrigger: {
                            trigger: slide,
                            start: "top 78%",
                            toggleActions: "play none none reverse",
                        },
                    }
                );
            });
        }, root);

        return () => ctx.revert();
    }, []);

    return (
        <section
            id="how-it-works"
            ref={containerRef}
            className="relative w-full overflow-hidden bg-[#F6F9FC] py-24 sm:py-32"
        >
            <div className="mx-auto max-w-7xl px-6 lg:px-12">

                {/* Header */}
                <div className="mb-20 text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2f7dd3]">
                        How REBYU works
                    </p>
                    <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-[-0.04em] text-[#273452] sm:text-4xl">
                        One connected route from diagnosis to readiness.
                    </h2>
                    <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#66758A]">
                        From your first diagnostic to your final mock exam, BKT keeps your learning path aligned with your latest performance.
                    </p>
                </div>

                <div className="relative">
                    <div className="pointer-events-none absolute bottom-10 left-5 top-10 w-px bg-[#cbdbea] md:left-7 lg:left-1/2" aria-hidden="true">
                        <div ref={progressRef} className="h-full w-full origin-top bg-[#2f7dd3]" />
                    </div>

                    <div className="relative z-10 flex flex-col gap-20 py-10 md:gap-28">
                        {STAGES.map((stage, index) => {
                            const Icon = stage.icon;

                            return (
                                <div
                                    key={stage.id}
                                    ref={(el) => (slideRefs.current[index] = el)}
                                    data-stage-index={index}
                                    className="relative pl-16 md:pl-20 lg:pl-0"
                                >
                                    <div className="absolute left-0 top-1 z-20 flex size-10 items-center justify-center rounded-full border-4 border-[#F6F9FC] bg-[#2f7dd3] text-xs font-bold text-white shadow-sm md:left-2 lg:left-1/2 lg:-translate-x-1/2">
                                        {stage.number}
                                    </div>
                                    <div className="slide-content grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-24">

                                        {/* Left Side: Text */}
                                        <div className={`stage-copy ${index % 2 === 0 ? "lg:pr-8" : "lg:order-2 lg:pl-8"}`}>
                                            <span className="mb-6 flex size-12 items-center justify-center rounded-xl bg-[#e8f3fc] text-[#1f5f99]">
                                                <Icon className="size-[20px]" aria-hidden="true" />
                                            </span>
                                            <h3 className="text-3xl font-bold tracking-[-0.03em] text-[#273452] sm:text-4xl">
                                                {stage.title}
                                            </h3>
                                            <p className="mt-5 max-w-md text-base leading-relaxed text-[#66758A]">
                                                {stage.description}
                                            </p>
                                        </div>

                                        {/* Right Side: Mockup Preview */}
                                        <div className={`stage-preview w-full ${index % 2 === 0 ? "lg:pl-8" : "lg:order-1 lg:pr-8"}`}>
                                            <StagePreview stage={stage} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}
