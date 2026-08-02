import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
    BookOpenCheck,
    CalendarDays,
    Check,
    Clock3,
    FileQuestion,
    MessageCircle,
    Target,
    Users,
} from "@/components/icons";

import {
    ReadinessRadialChart,
    StudyConsistencyChart,
    TopicMasteryChart,
} from "./landing-charts.jsx";

gsap.registerPlugin(ScrollTrigger);

const STUDY_TASKS = [
    { title: "Review SDLC models", meta: "25 min", done: true },
    { title: "Take lesson quiz", meta: "15 questions", done: false },
    { title: "Repeat weak concepts", meta: "Spaced review", done: false },
];

function BentoHeader({ icon: Icon, title, description, dark = false }) {
    return (
        <div className="relative z-10">
            <div className="flex items-center gap-3">
        <span
            className={`flex size-10 items-center justify-center rounded-xl ${
                dark
                    ? "bg-white/10 text-white"
                    : "border border-[#D9E3F0] bg-white text-[#2F7DD3]"
            }`}
        >
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
                <h3 className={`text-xl font-bold ${dark ? "text-white" : "text-[#273452]"}`}>
                    {title}
                </h3>
            </div>
            <p
                className={`mt-3 max-w-lg text-sm leading-6 ${
                    dark ? "text-[#D3DFEA]" : "text-[#66758A]"
                }`}
            >
                {description}
            </p>
        </div>
    );
}

export function FeatureBento() {
    const sectionRef = useRef(null);

    useLayoutEffect(() => {
        const root = sectionRef.current;
        if (!root) return undefined;

        const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;

        const ctx = gsap.context(() => {
            if (reducedMotion) return;

            const cards = gsap.utils.toArray("[data-bento-card]", root);
            gsap.fromTo(
                cards,
                { opacity: 0, y: 48 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.78,
                    stagger: 0.1,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: root,
                        start: "top 76%",
                        once: true,
                    },
                },
            );

            const images = gsap.utils.toArray("[data-bento-image]", root);
            images.forEach((image) => {
                gsap.fromTo(
                    image,
                    { scale: 1.08 },
                    {
                        scale: 1,
                        ease: "none",
                        scrollTrigger: {
                            trigger: image,
                            start: "top bottom",
                            end: "bottom top",
                            scrub: 0.7,
                        },
                    },
                );
            });
        }, root);

        return () => ctx.revert();
    }, []);

    return (
        <section
            id="features"
            ref={sectionRef}
            className="scroll-mt-24 border-y border-[#D8E7F2] bg-[#EAF3FA] px-5 py-24 sm:py-28 lg:px-8 lg:py-36"
        >
            <div className="mx-auto max-w-7xl">
                <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2F7DD3]">
                            Inside REBYU
                        </p>
                        <h2 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-[#273452] sm:text-5xl">
                            Built around the work learners actually do.
                        </h2>
                    </div>
                    <p className="max-w-2xl text-base leading-7 text-[#62738B] lg:justify-self-end">
                        Each tool supports a real step in the learner journey, from identifying
                        weak topics to measuring exam readiness.
                    </p>
                </div>

                <div className="mt-14 grid gap-5 lg:grid-cols-12">
                    <article
                        data-bento-card
                        className="min-h-[430px] overflow-hidden border border-[#E0E7EF] bg-[#F6F9FC] p-6 sm:p-8 lg:col-span-7"
                    >
                        <BentoHeader
                            icon={Target}
                            title="Diagnostic and weakness analysis"
                            description="See topic mastery immediately after the diagnostic, then begin with the area that needs the most attention."
                        />
                        <div className="mt-7 grid gap-5 sm:grid-cols-[0.72fr_1.28fr] sm:items-center">
                            <div className="space-y-4">
                                <div className="border-l-2 border-[#D4A72C] pl-4">
                                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#7A3F27]">
                                        Priority topic
                                    </p>
                                    <p className="mt-2 text-lg font-bold text-[#273452]">
                                        Networking
                                    </p>
                                    <p className="mt-1 text-sm text-[#66758A]">54% mastery</p>
                                </div>
                                <p className="text-sm leading-6 text-[#66758A]">
                                    REBYU recommends reviewing network fundamentals before the next
                                    middle exam.
                                </p>
                            </div>
                            <div className="border border-[#E0E7EF] bg-white p-4 sm:p-5">
                                <p className="text-xs font-bold text-[#273452]">
                                    Topic mastery
                                </p>
                                <TopicMasteryChart className="h-56" />
                            </div>
                        </div>
                    </article>

                    <article
                        data-bento-card
                        className="flex min-h-[430px] flex-col border border-[#E0E7EF] bg-white p-6 sm:p-8 lg:col-span-5"
                    >
                        <BentoHeader
                            icon={BookOpenCheck}
                            title="Readiness you can explain"
                            description="One readiness result supported by lesson mastery, assessment performance, and recent consistency."
                        />
                        <div className="mt-6 flex flex-1 flex-col items-center justify-center">
                            <ReadinessRadialChart value={84} className="h-48 w-48" />
                            <div className="mt-5 grid w-full grid-cols-3 border-t border-[#E0E7EF] pt-5 text-center">
                                <div>
                                    <p className="text-base font-bold text-[#273452]">78%</p>
                                    <p className="mt-1 text-xs font-medium text-[#66758A]">Accuracy</p>
                                </div>
                                <div className="border-x border-[#E0E7EF]">
                                    <p className="text-base font-bold text-[#273452]">14</p>
                                    <p className="mt-1 text-xs font-medium text-[#66758A]">Lessons</p>
                                </div>
                                <div>
                                    <p className="text-base font-bold text-[#273452]">4 days</p>
                                    <p className="mt-1 text-xs font-medium text-[#66758A]">Streak</p>
                                </div>
                            </div>
                        </div>
                    </article>

                    <article
                        data-bento-card
                        className="relative min-h-[440px] overflow-hidden bg-[#273452] lg:col-span-5"
                    >
                        <div className="relative flex min-h-[440px] flex-col justify-between p-6 sm:p-8">
                            <BentoHeader
                                icon={CalendarDays}
                                title="A focused daily study plan"
                                description="Lessons, review tasks, and assessments are prioritized using the topics that need the most attention."
                                dark
                            />
                            <div className="border border-white/15 bg-[#102A43]/80 p-4 backdrop-blur-sm">
                                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8DC7EF]">
                                    Today · TOPCIT
                                </p>
                                <div className="mt-4 space-y-2.5">
                                    {STUDY_TASKS.map((task) => (
                                        <div
                                            key={task.title}
                                            className="flex items-center gap-3 border-b border-white/10 pb-2.5 last:border-b-0 last:pb-0"
                                        >
                      <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${
                              task.done
                                  ? "border-[#6F94FF] bg-[#2F7DD3] text-white"
                                  : "border-white/25 text-white/60"
                          }`}
                      >
                        {task.done ? <Check className="size-3.5" /> : null}
                      </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold text-white">
                                                    {task.title}
                                                </p>
                                                <p className="mt-0.5 text-xs text-[#E0E7EF]">
                                                    {task.meta}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </article>

                    <article
                        data-bento-card
                        className="min-h-[440px] overflow-hidden border border-[#E0E7EF] bg-[#F6F9FC] lg:col-span-7"
                    >
                        <div className="flex min-h-[440px] flex-col p-6 sm:p-8">
                                <BentoHeader
                                    icon={Users}
                                    title="Community and study circles"
                                    description="Discuss certification topics, share quizzes and files, and create focused study circles with other learners."
                                />
                                <div className="mt-8 grid w-full grid-cols-1 gap-4">
                                    <div className="border border-[#DEE6F1] bg-white p-5">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-[#2F7DD3]">
                                            <Users className="size-3.5" />
                                            TOPCIT study circle
                                        </div>
                                        <p className="mt-2 text-sm font-semibold leading-6 text-[#273452]">
                                            Software Development review tonight at 7:30 PM.
                                        </p>
                                    </div>
                                    <div className="border border-[#DEE6F1] bg-white p-5">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-[#2F7DD3]">
                                            <FileQuestion className="size-3.5" />
                                            Shared practice quiz
                                        </div>
                                        <p className="mt-2 text-sm font-semibold leading-6 text-[#273452]">
                                            15 questions on database normalization.
                                        </p>
                                    </div>
                                </div>
                        </div>
                    </article>

                    <article
                        data-bento-card
                        className="min-h-[380px] border border-[#E0E7EF] bg-white p-6 sm:p-8 lg:col-span-7"
                    >
                        <div className="grid gap-6 sm:grid-cols-[0.75fr_1.25fr] sm:items-end">
                            <BentoHeader
                                icon={MessageCircle}
                                title="Study consistency"
                                description="A clear view of how much focused study happened this week—without fake activity metrics."
                            />
                            <div className="border border-[#E0E7EF] bg-[#F6F9FC] p-4">
                                <div className="flex items-end justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-semibold text-[#66758A]">
                                            This week
                                        </p>
                                        <p className="mt-1 text-2xl font-bold text-[#273452]">
                                            4h 50m
                                        </p>
                                    </div>
                                    <p className="text-xs font-semibold text-[#2F7DD3]">
                                        +42 min
                                    </p>
                                </div>
                                <StudyConsistencyChart className="mt-2 h-44" />
                            </div>
                        </div>
                    </article>

                    <article
                        data-bento-card
                        className="relative min-h-[380px] overflow-hidden bg-[#273452] lg:col-span-5"
                    >
                        <div className="relative flex min-h-[380px] flex-col justify-between p-6 sm:p-8">
                            <BentoHeader
                                icon={Clock3}
                                title="Mock examination"
                                description="Take a complete timed assessment after building your knowledge through lessons, quizzes, and middle exams."
                                dark
                            />
                            <div className="grid grid-cols-3 gap-2 border border-white/15 bg-[#102A43]/78 p-4 text-center backdrop-blur-sm">
                                <div>
                                    <p className="text-lg font-bold text-white">100</p>
                                    <p className="mt-1 text-xs font-medium text-[#E0E7EF]">Questions</p>
                                </div>
                                <div className="border-x border-white/15">
                                    <p className="text-lg font-bold text-white">120m</p>
                                    <p className="mt-1 text-xs font-medium text-[#E0E7EF]">Duration</p>
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-white">81%</p>
                                    <p className="mt-1 text-xs font-medium text-[#E0E7EF]">Last score</p>
                                </div>
                            </div>
                        </div>
                    </article>
                </div>
            </div>
        </section>
    );
}
