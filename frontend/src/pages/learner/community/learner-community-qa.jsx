import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
    ArrowUp,
    Bookmark,
    BookOpen,
    FileArchive,
    FileText,
    Home,
    Layers,
    Loader2,
    MessageCircle,
    MoreHorizontal,
    Plus,
    Search,
    Send,
    Share2,
    Sparkles,
    UsersRound,
    X,
} from "@/components/icons"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiMessage } from "@/services/base"
import { fetchFileBlob } from "@/services/fileService"
import { getAllCertifications } from "@/services/certificationService"
import { getLibraryItems } from "@/services/learnerToolsService"
import {
    addCommunityComment,
    applyPostCounts,
    createCommunityCircle,
    createCommunityPost,
    deleteCommunityCircle,
    deleteCommunityPost,
    getCommunityCircles,
    getCommunityComments,
    getCommunityPosts,
    toggleCircleMembership,
    toggleCommunityLike,
    toggleCommunitySave,
    uploadCommunityAttachment,
    shareCommunityStudyItem,
    startSharedCommunityPractice,
    reportCommunityPost,
} from "@/services/communityService"

const FEED_TABS = [
    { value: "for-you", label: "For you" },
    { value: "discussion", label: "Discussions" },
    { value: "quiz", label: "Quizzes" },
    { value: "flashcard", label: "Flashcards" },
    { value: "reviewer", label: "Reviewers" },
    { value: "circle", label: "Study circles" },
]

/** Uploaded reviewer files: one feed tab, two post types (PDF and Word). */
const REVIEWER_TYPES = ["notes", "docx"]

/* The feed follows the landing page's community section: a post is a tactile
   card whose point is the thing attached to it — a set you can attempt, a file
   you can open, a circle you can join. Each post type owns one accent wash so
   the feed is scannable before a single word is read. */
const POST_TYPE_STYLES = {
    discussion: "bg-rb-macaw-wash text-rb-macaw-lip",
    quiz: "bg-rb-feather-wash text-rb-feather-lip",
    flashcard: "bg-rb-beetle-wash text-rb-beetle-lip",
    circle: "bg-rb-bee-wash text-rb-bee-lip",
    notes: "bg-rb-fox-wash text-rb-fox-lip",
    docx: "bg-rb-fox-wash text-rb-fox-lip",
}

const POST_TYPE_LABELS = {
    discussion: "discussion",
    quiz: "practice set",
    flashcard: "flashcards",
    circle: "study circle",
    notes: "material",
    docx: "material",
}

/** Avatar washes rotate per author so a busy feed still reads as many voices. */
const AVATAR_TONES = [
    "bg-rb-macaw-wash text-rb-macaw-lip",
    "bg-rb-beetle-wash text-rb-beetle-lip",
    "bg-rb-fox-wash text-rb-fox-lip",
    "bg-rb-bee-wash text-rb-bee-lip",
    "bg-rb-feather-wash text-rb-feather-lip",
]

function avatarTone(seed = "") {
    let total = 0
    for (let index = 0; index < seed.length; index += 1) total += seed.charCodeAt(index)
    return AVATAR_TONES[total % AVATAR_TONES.length]
}

/** "1.2 MB" for the reviewer tile; blank when an older post has no recorded size. */
function formatBytes(size) {
    if (!size || size < 0) return null
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function CommunityAvatar({ initials, tone, className = "" }) {
    return (
        <div
            className={`grid size-10 shrink-0 place-items-center rounded-full font-rb-display text-sm font-extrabold lowercase ${
                tone ?? avatarTone(initials ?? "")
            } ${className}`}
            aria-hidden="true"
        >
            {initials}
        </div>
    )
}

function attachmentTone(type) {
    if (type === "QUIZ") return "bg-rb-feather-wash text-rb-feather-lip"
    if (type === "DOCX") return "bg-rb-bee-wash text-rb-bee-lip"
    return "bg-rb-cardinal-wash text-rb-cardinal-lip"
}

/**
 * The payload tile: the thing the post is actually about — a set you can attempt
 * or a file you can open — sitting in its own bordered slab under the text, with
 * a single pill action on the right.
 */
function PayloadTile({ icon: Icon, tone, name, meta, actionLabel, onAction }) {
    return (
        <div className="mt-4 flex items-center gap-3 rounded-rb-tile border-2 border-border bg-muted/40 p-3">
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}>
                <Icon className="size-5" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{name}</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">{meta}</p>
            </div>

            {onAction ? (
                <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={onAction}>
                    {actionLabel}
                </Button>
            ) : null}
        </div>
    )
}

/** One count in the footer row: icon, number, and a screen-reader-only noun. */
function CountAction({ icon: Icon, count, label, active, activeClassName = "", onClick, className = "" }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-accent hover:text-foreground ${
                active ? activeClassName : ""
            } ${className}`}
        >
            <Icon className={`size-4 ${active ? "fill-current" : ""}`} />
            {Number(count ?? 0).toLocaleString()}
            <span className="sr-only"> {label}</span>
        </button>
    )
}

function PostTypeBadge({ type }) {
    return (
        <span
            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 font-rb-display text-[0.6875rem] font-extrabold lowercase tracking-wide ${
                POST_TYPE_STYLES[type] ?? POST_TYPE_STYLES.discussion
            }`}
        >
            {POST_TYPE_LABELS[type] ?? "post"}
        </span>
    )
}

/**
 * A circle's own header, the way a subreddit banner works — except the backdrop
 * is the circle's name set huge and faint rather than an uploaded image, so a
 * brand-new circle looks finished without anyone having to design anything.
 */
function CircleHeader({ circle, onToggleJoin, onDelete, onBack }) {
    return (
        <PanelCard className="overflow-hidden">
            <div className="relative h-24 bg-rb-bee-wash">
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-3 left-3 select-none whitespace-nowrap font-rb-display text-[4rem] font-extrabold lowercase leading-none text-rb-bee-lip opacity-[0.14]"
                >
                    {circle.name}
                </span>

                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute left-3 top-3 rounded-full"
                    onClick={onBack}
                >
                    <X className="mr-2 size-4" />
                    Back to feed
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 p-4">
                <span className="-mt-10 grid size-16 shrink-0 place-items-center rounded-full border-4 border-card bg-rb-bee-wash font-rb-display text-lg font-extrabold lowercase text-rb-bee-lip">
                    {circle.initials}
                </span>

                <div className="min-w-0 flex-1">
                    <h1 className="truncate font-rb-display text-xl font-extrabold lowercase text-foreground">
                        {circle.name}
                    </h1>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                        {(circle.members ?? 0).toLocaleString()} members · {circle.topic}
                    </p>
                </div>

                {circle.owner ? (
                    <>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                            owner
                        </span>
                        <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={onDelete}>
                            Delete circle
                        </Button>
                    </>
                ) : (
                    <Button
                        type="button"
                        size="sm"
                        variant={circle.joined ? "outline" : "default"}
                        className="rounded-full"
                        onClick={() => onToggleJoin(circle.circleId)}
                    >
                        {circle.joined ? "Joined" : "Join circle"}
                    </Button>
                )}
            </div>

            <p className="border-t-2 border-border px-4 py-3 text-sm leading-6 text-muted-foreground">
                {circle.description}
            </p>
        </PanelCard>
    )
}

/** Sidebar and feed surfaces share one shape: 2px border, card radius, no blur. */
function PanelCard({ className = "", children }) {
    return (
        <section className={`rounded-rb-card border-2 border-border bg-card ${className}`}>
            {children}
        </section>
    )
}

function PanelHeading({ icon: Icon, tone = "bg-rb-macaw-wash text-rb-macaw-lip", title, children }) {
    return (
        <div className="flex items-center gap-2.5">
            <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${tone}`}>
                <Icon className="size-4" aria-hidden="true" />
            </span>
            <h2 className="font-rb-display text-sm font-extrabold lowercase text-foreground">{title}</h2>
            {children}
        </div>
    )
}

function CommunityPost({
                           post,
                           circles,
                           onToggleUpvote,
                           onToggleSave,
                           onToggleComments,
                           onJoinCircle,
                           onDelete,
                           onStartPractice,
                           onReport,
                           onOpenAttachment,
                           onOpenCircle,
                           threadOpen,
                           threadComments,
                           draft,
                           onDraftChange,
                           onSubmitComment,
                       }) {
    const linkedCircle = post.circleId
        ? circles.find((circle) => circle.circleId === post.circleId)
        : null

    const isStudySet = ["quiz", "flashcard"].includes(post.postType)
    const fileSize = formatBytes(post.attachmentSize)
    const cardRef = useRef(null)

    /* An open thread closes when attention moves off the post, the way a
       comment box does elsewhere. The draft survives in the page's draft map,
       so reopening the thread brings back whatever was half-typed. */
    useEffect(() => {
        if (!threadOpen) return undefined
        function handlePointerDown(event) {
            if (!cardRef.current?.contains(event.target)) onToggleComments(post.postId)
        }
        document.addEventListener("mousedown", handlePointerDown)
        return () => document.removeEventListener("mousedown", handlePointerDown)
    }, [threadOpen, onToggleComments, post.postId])

    return (
        <article ref={cardRef} className="overflow-hidden rounded-rb-card border-2 border-border bg-card transition-colors hover:border-rb-macaw/60">
            <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                    <CommunityAvatar initials={post.initials} tone={avatarTone(post.authorName ?? "")} />

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-foreground">{post.authorName}</span>

                            {/* Only the viewer's own posts carry a badge -- on every
                                other post "Learner" was true of everyone and said nothing. */}
                            {post.ownedByMe ? (
                                <Badge variant="outline" className={`h-5 rounded-full px-1.5 text-[10px] ${post.badgeClass}`}>
                                    You
                                </Badge>
                            ) : null}
                        </div>

                        <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                            {[post.community, linkedCircle?.topic, post.createdAt].filter(Boolean).join(" · ")}
                        </p>
                    </div>

                    <PostTypeBadge type={post.postType} />

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="-mr-1 size-8 shrink-0"
                                aria-label="Post actions"
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => onToggleSave(post.postId)}>
                                <Bookmark className="mr-2 h-4 w-4" />
                                {post.saved ? "Remove from saved" : "Save post"}
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                onSelect={() => {
                                    navigator.clipboard?.writeText(
                                        `${window.location.origin}/learner/community?post=${post.postId}`
                                    )
                                    toast.success("Post link copied.")
                                }}
                            >
                                <Share2 className="mr-2 h-4 w-4" />
                                Copy link
                            </DropdownMenuItem>

                            {!post.ownedByMe ? <DropdownMenuItem onSelect={() => onReport(post.postId)} className="text-destructive focus:text-destructive">Report post</DropdownMenuItem> : null}

                            {post.ownedByMe ? (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onSelect={() => onDelete(post.postId)}
                                    >
                                        Delete post
                                    </DropdownMenuItem>
                                </>
                            ) : null}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="mt-4">
                    {/* A shared set's title is the name on its tile below -- printing
                        it here too said the same thing twice in two type sizes. */}
                    {isStudySet ? null : (
                        <h2 className="font-rb-display text-lg font-extrabold leading-6 text-foreground">
                            {post.title}
                        </h2>
                    )}

                    <p className={`text-[0.9375rem] leading-6 text-muted-foreground ${isStudySet ? "" : "mt-2"}`}>
                        {post.description}
                    </p>
                </div>

                {/* the attachment is the point of the post — give it a tile of its own */}
                {post.attachment ? (
                    <PayloadTile
                        icon={post.attachment.type === "DOCX" ? FileArchive : FileText}
                        tone={attachmentTone(post.attachment.type)}
                        name={post.attachment.name}
                        meta={post.attachment.key
                            ? [post.attachment.type, fileSize, "shared reviewer"].filter(Boolean).join(" · ")
                            : "No file attached"}
                        actionLabel="open"
                        onAction={post.attachment.key ? () => onOpenAttachment(post) : null}
                    />
                ) : null}

                {isStudySet ? (
                    <PayloadTile
                        icon={post.postType === "quiz" ? BookOpen : Layers}
                        tone={post.postType === "quiz" ? "bg-rb-feather-wash text-rb-feather-lip" : "bg-rb-beetle-wash text-rb-beetle-lip"}
                        name={post.title}
                        meta={`${POST_TYPE_LABELS[post.postType]} · generated in REBYU`}
                        actionLabel="attempt"
                        onAction={() => onStartPractice(post.postId)}
                    />
                ) : null}

                {linkedCircle ? (
                    <div className="mt-4 flex flex-col gap-3 rounded-rb-tile border-2 border-border bg-muted/40 p-3 sm:flex-row sm:items-center">
                        <button
                            type="button"
                            onClick={() => onOpenCircle(linkedCircle.circleId)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rb-bee-wash font-rb-display text-xs font-extrabold lowercase text-rb-bee-lip">
                                {linkedCircle.initials}
                            </span>

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-foreground">
                                    {linkedCircle.name}
                                </p>

                                <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                                    {linkedCircle.members?.toLocaleString?.() ?? 0} members
                                </p>
                            </div>
                        </button>

                        <Button
                            type="button"
                            size="sm"
                            variant={linkedCircle.joined ? "outline" : "default"}
                            className="shrink-0 rounded-full"
                            onClick={() => onJoinCircle(linkedCircle.circleId)}
                        >
                            {linkedCircle.joined ? "Joined" : "Join circle"}
                        </Button>
                    </div>
                ) : null}

            </div>

            {/* one quiet row: every number here is also the button that changes it */}
            <div className="flex items-center gap-1 border-t-2 border-border px-3 py-2 text-sm font-bold text-muted-foreground">
                <CountAction
                    icon={ArrowUp}
                    count={post.reactions}
                    label="upvotes"
                    active={post.liked}
                    activeClassName="text-rb-macaw-lip"
                    onClick={() => onToggleUpvote(post.postId)}
                />

                <CountAction
                    icon={MessageCircle}
                    count={post.comments}
                    label="comments"
                    active={threadOpen}
                    activeClassName="text-rb-macaw-lip"
                    onClick={() => onToggleComments(post.postId)}
                />

                <CountAction
                    icon={Bookmark}
                    count={post.saves}
                    label="saves"
                    active={post.saved}
                    activeClassName="text-rb-macaw-lip"
                    onClick={() => onToggleSave(post.postId)}
                    className="ml-auto"
                />
            </div>

            {/* The thread lives in the post, the way every social feed does it --
                reading a reply should never mean losing sight of what it replies to. */}
            {threadOpen ? (
                <div className="border-t-2 border-border bg-muted/20 px-3 py-2.5 sm:px-4">
                    {threadComments === undefined ? (
                        <p className="py-2 text-center text-xs font-semibold text-muted-foreground">Loading comments...</p>
                    ) : (
                        /* Comments are secondary to the post, so they run at a
                           smaller scale: name and body share one bubble, and a
                           long thread scrolls instead of pushing the next post
                           off the screen. */
                        <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
                            {threadComments.map((comment) => (
                                <div key={comment.commentId} className="flex gap-2">
                                    <CommunityAvatar
                                        initials={comment.initials}
                                        tone={avatarTone(comment.authorName ?? "")}
                                        className="!size-7 !text-[0.625rem]"
                                    />
                                    <div className="min-w-0 rounded-2xl bg-muted px-3 py-1.5">
                                        <p className="text-xs font-bold text-foreground">{comment.authorName}</p>
                                        <p className="whitespace-pre-wrap text-[0.8125rem] leading-5 text-muted-foreground">
                                            {comment.body}
                                        </p>
                                    </div>
                                </div>
                            ))}

                            {threadComments.length === 0 ? (
                                <p className="py-1.5 text-center text-xs font-semibold text-muted-foreground">
                                    No comments yet. Start the conversation.
                                </p>
                            ) : null}
                        </div>
                    )}

                    <div className="mt-2 flex items-center gap-2">
                        <CommunityAvatar initials="GG" className="!size-7 !text-[0.625rem]" />
                        <Input
                            value={draft ?? ""}
                            onChange={(event) => onDraftChange(post.postId, event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault()
                                    onSubmitComment(post.postId)
                                }
                            }}
                            placeholder="Write a comment..."
                            aria-label={`Comment on ${post.title}`}
                            className="h-8 rounded-full bg-muted text-[0.8125rem]"
                        />
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8 shrink-0 rounded-full"
                            onClick={() => onSubmitComment(post.postId)}
                            disabled={!draft?.trim()}
                            aria-label="Post comment"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            ) : null}
        </article>
    )
}

export default function Community() {
    const navigate = useNavigate()
    const [posts, setPosts] = useState([])
    const [circles, setCircles] = useState([])
    const [certifications, setCertifications] = useState([])
    const [studyItems, setStudyItems] = useState([])
    const [selectedStudyItemId, setSelectedStudyItemId] = useState("")
    const [activeTab, setActiveTab] = useState("for-you")
    const [showSavedOnly, setShowSavedOnly] = useState(false)
    const [searchValue, setSearchValue] = useState("")

    const [composerOpen, setComposerOpen] = useState(false)
    const [shareType, setShareType] = useState("discussion")
    const [shareTitle, setShareTitle] = useState("")
    const [shareDescription, setShareDescription] = useState("")
    const [shareCommunity, setShareCommunity] = useState("")
    const [attachedFile, setAttachedFile] = useState(null)
    const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
    const [isPublishing, setIsPublishing] = useState(false)
    const fileInputRef = useRef(null)

    const [createCircleOpen, setCreateCircleOpen] = useState(false)
    const [isCreatingCircle, setIsCreatingCircle] = useState(false)
    /** When set, the middle column becomes that circle's own page. */
    const [activeCircleId, setActiveCircleId] = useState(null)
    const [confirmDeleteCircleId, setConfirmDeleteCircleId] = useState(null)
    const [circleName, setCircleName] = useState("")
    const [circleDescription, setCircleDescription] = useState("")
    const [circleTopic, setCircleTopic] = useState("General Study")

    // Threads are per post and stay mounted in the feed: openThreads holds which
    // cards are expanded, commentsByPost caches what each one has loaded.
    const [openThreads, setOpenThreads] = useState([])
    const [commentsByPost, setCommentsByPost] = useState({})
    const [commentDrafts, setCommentDrafts] = useState({})
    /* Scoped to the feed, not the page. The header, the circle rail and the
       composer are all rendered from state this page already has, so blanking
       them out while the posts arrive would replace a usable screen with a
       placeholder of itself. Only the part that is actually waiting says so. */
    const [isLoading, setIsLoading] = useState(true)
    const [reportPostId, setReportPostId] = useState(null)
    const [reportReason, setReportReason] = useState("SPAM")
    const [reportDetails, setReportDetails] = useState("")
    /* Blob URLs stay alive for as long as the tab that opened them needs, so
       they are revoked when this page unmounts rather than after the open. */
    const objectUrlsRef = useRef([])
    useEffect(() => () => objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)), [])

    useEffect(() => {
        setIsLoading(true)
        Promise.all([getCommunityPosts(), getCommunityCircles(), getAllCertifications(), getLibraryItems()])
            .then(([nextPosts, nextCircles, nextCertifications, nextStudyItems]) => {
                setPosts(nextPosts)
                setCircles(nextCircles)
                setCertifications(Array.isArray(nextCertifications) ? nextCertifications : [])
                setStudyItems((Array.isArray(nextStudyItems) ? nextStudyItems : []).filter((item) => ["quiz", "flashcard"].includes(item.kind)))
                if (nextCircles[0]) setShareCommunity(String(nextCircles[0].circleId))
            })
            .catch((error) => toast.error(apiMessage(error, "The community could not be loaded.")))
            /* `finally`, so a failed load stops loading too. Without it the
               toast fires and the feed spins forever, which reads as "still
               working" when nothing is. */
            .finally(() => setIsLoading(false))
    }, [])

    const topicOptions = useMemo(() => {
        const titles = certifications
            .map((certification) => certification.title || certification.name)
            .filter(Boolean)
        return [...new Set(["General Study", ...titles])]
    }, [certifications])

    /** Circles you can actually post into — the only ones worth offering. */
    const joinedCircles = useMemo(
        () => circles.filter((circle) => circle.joined || circle.owner),
        [circles]
    )

    const activeCircle = useMemo(
        () => circles.find((circle) => circle.circleId === activeCircleId) ?? null,
        [circles, activeCircleId]
    )

    const visiblePosts = useMemo(() => {
        const query = searchValue.trim().toLowerCase()

        const filtered = posts.filter((post) => {
            // Inside a circle the feed is that circle's posts only; the tab
            // filters and the saved view belong to the global feed.
            if (activeCircleId) return post.circleId === activeCircleId
            if (showSavedOnly && !post.saved) return false
            const matchesTab =
                showSavedOnly ||
                activeTab === "for-you" ||
                (activeTab === "reviewer"
                    ? REVIEWER_TYPES.includes(post.postType)
                    : post.postType === activeTab)

            const matchesSearch =
                !query ||
                (post.title || "").toLowerCase().includes(query) ||
                (post.description || "").toLowerCase().includes(query) ||
                (post.authorName || "").toLowerCase().includes(query) ||
                (post.community || "").toLowerCase().includes(query)

            return matchesTab && matchesSearch
        })

        return filtered
    }, [activeCircleId, activeTab, posts, searchValue, showSavedOnly])

    function openComposer(type) {
        setShareType(type)
        setAttachedFile(null)
        // Posting from inside a circle should land in that circle by default.
        if (activeCircleId) setShareCommunity(String(activeCircleId))
        setSelectedStudyItemId("")
        setComposerOpen(true)
    }

    function selectFeedTab(value) {
        setShowSavedOnly(false)
        setActiveTab(value)
    }

    async function toggleUpvote(postId) {
        try {
            const counts = await toggleCommunityLike(postId)
            setPosts((current) => applyPostCounts(current, postId, counts, "liked"))
        } catch (error) {
            toast.error(apiMessage(error, "Could not update your upvote."))
        }
    }

    /**
     * Opens a shared reviewer in its own tab. The file is fetched with the
     * learner's token and handed over as a blob URL -- /api/files/view requires
     * auth, so pointing a tab straight at it would load nothing.
     */
    async function openAttachment(post) {
        const key = post?.attachment?.key
        if (!key) return
        // Opened before the await on purpose: a tab opened in an async
        // continuation is treated as an unrequested popup and blocked.
        const tab = window.open("", "_blank")
        try {
            const blob = await fetchFileBlob(key)
            const url = URL.createObjectURL(blob)
            objectUrlsRef.current.push(url)
            if (tab) tab.location.href = url
            else window.open(url, "_blank")
        } catch (error) {
            tab?.close()
            toast.error(apiMessage(error, "This file could not be opened."))
        }
    }

    async function startPractice(postId) {
        try {
            const attempt = await startSharedCommunityPractice(postId)
            navigate(`/learner/practice/${attempt.studySetId}`)
        } catch (error) {
            toast.error(apiMessage(error, "This shared study item is not ready for practice yet."))
        }
    }

    async function submitReport() {
        if (!reportPostId) return
        try {
            await reportCommunityPost(reportPostId, reportReason, reportDetails)
            setReportPostId(null)
            setReportDetails("")
            toast.success("Post reported. Our team can review it.")
        } catch (error) {
            toast.error(apiMessage(error, "This post could not be reported."))
        }
    }

    async function toggleSave(postId) {
        try {
            const counts = await toggleCommunitySave(postId)
            setPosts((current) => applyPostCounts(current, postId, counts, "saved"))
        } catch (error) {
            toast.error(apiMessage(error, "Could not update saved posts."))
        }
    }

    async function toggleJoinCircle(circleId) {
        try {
            const result = await toggleCircleMembership(circleId)
            setCircles((current) =>
                current.map((circle) =>
                    circle.circleId === circleId
                        ? {
                            ...circle,
                            joined: result.joined,
                            members: circle.members + (result.joined ? 1 : -1),
                        }
                        : circle
                )
            )
        } catch (error) {
            toast.error(apiMessage(error, "Could not update circle membership."))
        }
    }

    async function handleAttachmentSelected(event) {
        const file = event.target.files?.[0]
        if (!file) return

        setIsUploadingAttachment(true)
        try {
            const { attachmentKey, attachmentSize } = await uploadCommunityAttachment(file)
            setAttachedFile({ name: file.name, key: attachmentKey, size: attachmentSize ?? file.size })
        } catch (error) {
            toast.error(apiMessage(error, "The file could not be uploaded."))
        } finally {
            setIsUploadingAttachment(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    async function publishPost() {
        // Same in-flight guard as circle creation: the composer stays open for
        // the whole round trip, and a second click would publish a second post.
        if (isPublishing) return
        setIsPublishing(true)
        try {
            await publishPostRequest()
        } finally {
            setIsPublishing(false)
        }
    }

    async function publishPostRequest() {
        if (["quiz", "flashcard"].includes(shareType)) {
            if (!selectedStudyItemId) {
                toast.error("Choose a generated study item to share.")
                return
            }
            try {
                const nextPost = await shareCommunityStudyItem(Number(selectedStudyItemId), shareCommunity ? Number(shareCommunity) : null)
                setPosts((current) => [nextPost, ...current])
                setSelectedStudyItemId("")
                setComposerOpen(false)
                toast.success("Study item shared with the community.")
            } catch (error) {
                toast.error(apiMessage(error, "The study item could not be shared."))
            }
            return
        }
        if (!shareTitle.trim() || !shareDescription.trim()) {
            toast.error("Add a title and description.")
            return
        }
        if (shareType === "reviewer" && !attachedFile) {
            toast.error("Attach the PDF or Word reviewer you want to share.")
            return
        }

        // One "Reviewer" composer tab, two post types: the file's own extension
        // decides which, so the learner never has to pick PDF vs Word twice.
        const isWordFile = /\.docx$/i.test(attachedFile?.name ?? "")
        const postType = shareType === "reviewer" ? (isWordFile ? "docx" : "notes") : shareType

        try {
            const nextPost = await createCommunityPost({
                title: shareTitle.trim(),
                description: shareDescription.trim(),
                postType,
                circleId: shareCommunity ? Number(shareCommunity) : null,
                attachmentName: attachedFile?.name ?? null,
                attachmentType: shareType === "reviewer" ? (isWordFile ? "DOCX" : "PDF") : null,
                attachmentKey: attachedFile?.key ?? null,
                attachmentSize: attachedFile?.size ?? null,
            })

            setPosts((current) => [nextPost, ...current])
            setShareTitle("")
            setShareDescription("")
            setAttachedFile(null)
            setComposerOpen(false)
            toast.success(
                shareType === "discussion" ? "Discussion posted." : "Reviewer shared with the community."
            )
        } catch (error) {
            toast.error(apiMessage(error, "The post could not be published."))
        }
    }

    async function removePost(postId) {
        try {
            await deleteCommunityPost(postId)
            setPosts((current) => current.filter((post) => post.postId !== postId))
            toast.success("Post deleted.")
        } catch (error) {
            toast.error(apiMessage(error, "The post could not be deleted."))
        }
    }

    async function createStudyCircle() {
        if (!circleName.trim() || !circleDescription.trim()) {
            toast.error("Add a circle name and description.")
            return
        }
        // The dialog stays open for the whole round trip, so without this guard a
        // second click during the await creates a second circle -- and a second
        // announcement post with it.
        if (isCreatingCircle) return
        setIsCreatingCircle(true)

        try {
            const newCircle = await createCommunityCircle({
                name: circleName.trim(),
                description: circleDescription.trim(),
                topic: circleTopic,
            })

            setCircles((current) => [newCircle, ...current])
            setPosts(await getCommunityPosts())
            setCircleName("")
            setCircleDescription("")
            setCreateCircleOpen(false)
            selectFeedTab("for-you")

            toast.success("Study circle created and posted to the news feed.")
        } catch (error) {
            toast.error(apiMessage(error, "The study circle could not be created."))
        } finally {
            setIsCreatingCircle(false)
        }
    }

    async function removeCircle(circleId) {
        try {
            await deleteCommunityCircle(circleId)
            setCircles((current) => current.filter((circle) => circle.circleId !== circleId))
            setPosts(await getCommunityPosts())
            setActiveCircleId(null)
            toast.success("Study circle deleted.")
        } catch (error) {
            toast.error(apiMessage(error, "The study circle could not be deleted."))
        }
    }

    async function toggleComments(postId) {
        if (openThreads.includes(postId)) {
            setOpenThreads((current) => current.filter((id) => id !== postId))
            return
        }
        setOpenThreads((current) => [...current, postId])
        if (commentsByPost[postId]) return
        try {
            const loaded = await getCommunityComments(postId)
            setCommentsByPost((current) => ({ ...current, [postId]: loaded }))
        } catch (error) {
            // Leave the cache empty so reopening the thread retries the load.
            setOpenThreads((current) => current.filter((id) => id !== postId))
            toast.error(apiMessage(error, "Comments could not be loaded."))
        }
    }

    function setDraft(postId, value) {
        setCommentDrafts((current) => ({ ...current, [postId]: value }))
    }

    async function submitComment(postId) {
        const body = (commentDrafts[postId] ?? "").trim()
        if (!body) return
        try {
            const comment = await addCommunityComment(postId, body)
            setCommentsByPost((current) => ({ ...current, [postId]: [...(current[postId] ?? []), comment] }))
            setPosts((current) =>
                current.map((post) => (post.postId === postId ? { ...post, comments: post.comments + 1 } : post))
            )
            setDraft(postId, "")
        } catch (error) {
            toast.error(apiMessage(error, "Your comment could not be posted."))
        }
    }

    const savedCount = posts.filter((post) => post.saved).length

    return (
        <div className="space-y-6">
            {/* The horizontal strip is the SMALL-SCREEN form of the left rail
                below: same filters, same "create a circle" action. Hidden from
                lg up, where the rail itself is on screen and showing both
                would be two competing copies of one navigation.

                pb clears the 4px tactile lip under "Create a circle" — at py-3
                the lip landed on the strip's bottom border. */}
            <div className="sticky top-16 z-20 -mx-4 border-b-2 border-border bg-background/95 px-4 pb-4 pt-3 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
                <div className="mx-auto flex w-full max-w-[1200px] items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {FEED_TABS.map((tab, index) => {
                                    const Icon = index === 0
                                    ? Home
                                    : tab.value === "circle"
                                        ? UsersRound
                                        : tab.value === "discussion"
                                            ? MessageCircle
                                            : tab.value === "quiz"
                                                ? BookOpen
                                                : FileText

                                return (
                                    <button
                                        key={tab.value}
                                        type="button"
                                        onClick={() => selectFeedTab(tab.value)}
                                        className={`flex shrink-0 items-center gap-2 rounded-full border-2 px-3.5 py-2 font-rb-display text-sm font-extrabold lowercase transition-colors ${
                                            !showSavedOnly && activeTab === tab.value
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                        }`}
                                    >
                                        <Icon className="size-4" />
                                        {tab.label}
                                    </button>
                                )
                            })}
                        <button
                            type="button"
                            className={`flex shrink-0 items-center gap-2 rounded-full border-2 px-3.5 py-2 font-rb-display text-sm font-extrabold lowercase transition-colors ${
                                showSavedOnly
                                    ? "border-rb-macaw bg-rb-macaw-wash text-rb-macaw-lip"
                                    : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            }`}
                            onClick={() => {
                                setShowSavedOnly((current) => !current)
                            }}
                        >
                            <Bookmark className={`size-4 ${showSavedOnly ? "fill-current" : ""}`} />
                            Saved ({savedCount})
                        </button>
                        <Button
                            type="button"
                            size="sm"
                            className="ml-auto shrink-0 rounded-full"
                            onClick={() => setCreateCircleOpen(true)}
                        >
                            <UsersRound className="mr-2 size-4" />
                            Create a circle
                        </Button>
                </div>
            </div>

            {/* Three columns: filters/circles rail, the feed, then the
                community's own panels -- the feed keeps the middle so it is
                what the eye lands on, and each rail collapses independently
                (circles at lg, panels at xl) rather than the whole layout
                snapping to one column at a single breakpoint. */}
            <div className="mx-auto grid w-full max-w-[1400px] items-start gap-6 lg:grid-cols-[232px_minmax(0,1fr)] xl:grid-cols-[232px_minmax(0,1fr)_300px]">

                <aside className="sticky top-24 hidden lg:block">
                    <nav className="space-y-1">
                        <p className="px-3 pb-1 font-rb-display text-xs font-extrabold lowercase text-muted-foreground">
                            feed
                        </p>

                        {FEED_TABS.map((tab, index) => {
                            const Icon = index === 0
                                ? Home
                                : tab.value === "circle"
                                    ? UsersRound
                                    : tab.value === "discussion"
                                        ? MessageCircle
                                        : tab.value === "quiz"
                                            ? BookOpen
                                            : FileText
                            const active = !showSavedOnly && activeTab === tab.value

                            return (
                                <button
                                    key={tab.value}
                                    type="button"
                                    onClick={() => selectFeedTab(tab.value)}
                                    className={`flex w-full items-center gap-3 rounded-rb-tile px-3 py-2 text-left text-sm font-bold transition-colors ${
                                        active
                                            ? "bg-rb-macaw-wash text-rb-macaw-lip"
                                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                    }`}
                                >
                                    <Icon className="size-4 shrink-0" />
                                    <span className="min-w-0 truncate">{tab.label}</span>
                                </button>
                            )
                        })}

                        <button
                            type="button"
                            onClick={() => setShowSavedOnly((current) => !current)}
                            className={`flex w-full items-center gap-3 rounded-rb-tile px-3 py-2 text-left text-sm font-bold transition-colors ${
                                showSavedOnly
                                    ? "bg-rb-macaw-wash text-rb-macaw-lip"
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            }`}
                        >
                            <Bookmark className={`size-4 shrink-0 ${showSavedOnly ? "fill-current" : ""}`} />
                            <span className="min-w-0 flex-1 truncate">Saved</span>
                            {savedCount > 0 ? (
                                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-extrabold text-muted-foreground">
                                    {savedCount}
                                </span>
                            ) : null}
                        </button>
                    </nav>

                    <div className="mt-5 border-t-2 border-border pt-4">
                        <div className="flex items-center justify-between gap-2 px-3 pb-1">
                            <p className="font-rb-display text-xs font-extrabold lowercase text-muted-foreground">
                                study circles
                            </p>

                            <button
                                type="button"
                                onClick={() => setCreateCircleOpen(true)}
                                aria-label="Create study circle"
                                className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                            >
                                <Plus className="size-4" />
                            </button>
                        </div>

                        <div className="space-y-0.5">
                            {circles.map((circle) => (
                                <div
                                    key={circle.circleId}
                                    className={`group flex items-center gap-3 rounded-rb-tile px-3 py-2 transition-colors hover:bg-accent ${
                                        circle.circleId === activeCircleId ? "bg-rb-bee-wash" : ""
                                    }`}
                                >
                                    {/* The name and avatar open the circle's page; the
                                        join control stays a separate target beside it. */}
                                    <button
                                        type="button"
                                        onClick={() => setActiveCircleId(circle.circleId)}
                                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                    >
                                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-rb-bee-wash font-rb-display text-[0.625rem] font-extrabold lowercase text-rb-bee-lip">
                                            {circle.initials}
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-bold text-foreground">{circle.name}</p>
                                            <p className="truncate text-[11px] font-semibold text-muted-foreground">
                                                {circle.members?.toLocaleString?.() ?? 0} members
                                            </p>
                                        </div>
                                    </button>

                                    {circle.owner ? (
                                        <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                                            owner
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => toggleJoinCircle(circle.circleId)}
                                            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide transition-colors ${
                                                circle.joined
                                                    ? "text-muted-foreground hover:text-foreground"
                                                    : "bg-rb-macaw-wash text-rb-macaw-lip hover:bg-rb-macaw hover:text-white"
                                            }`}
                                        >
                                            {circle.joined ? "joined" : "join"}
                                        </button>
                                    )}
                                </div>
                            ))}

                            {circles.length === 0 ? (
                                <p className="px-3 py-2 text-xs text-muted-foreground">
                                    No study circles yet. Create the first one.
                                </p>
                            ) : null}
                        </div>
                    </div>
                </aside>

                <main className="min-w-0 space-y-4">
                    {activeCircle ? (
                        <CircleHeader
                            circle={activeCircle}
                            onToggleJoin={toggleJoinCircle}
                            onDelete={() => setConfirmDeleteCircleId(activeCircle.circleId)}
                            onBack={() => setActiveCircleId(null)}
                        />
                    ) : null}

                    {/* The collapsed prompt and the open composer are two states
                        of one control. Rendering both showed the type buttons and
                        a Post button twice, stacked. */}
                    {composerOpen ? null : (
                    <PanelCard className="p-4">
                        <button type="button" className="flex w-full items-center gap-3" onClick={() => openComposer("discussion")}>
                            <CommunityAvatar initials="GG" />
                            <div className="flex h-11 min-w-0 flex-1 items-center rounded-full border-2 border-border bg-muted/40 px-4 text-left text-sm font-semibold text-muted-foreground transition-colors hover:border-rb-macaw/60 hover:bg-muted">
                                Start a discussion or share a review resource...
                            </div>
                        </button>
                        {/* Each button opens the composer on that type. There is no
                            separate "Post" here: it opened the same composer the row
                            already opens, so it was a second door to one room. The
                            labels stay visible from sm up -- "share a quiz" is not
                            something an icon alone communicates. */}
                        <div className="mt-3 flex items-center gap-2 border-t-2 border-border pt-3">
                            <div className="flex min-w-0 flex-wrap items-center gap-0.5">
                                <Button type="button" variant="ghost" size="sm"  onClick={() => openComposer("discussion")} title="Start a discussion"><MessageCircle className="size-4 text-rb-macaw-lip sm:mr-2" /><span className="hidden sm:inline">Discussion</span></Button>
                                <Button type="button" variant="ghost" size="sm"  onClick={() => openComposer("quiz")} title="Share a quiz"><BookOpen className="size-4 text-rb-feather-lip sm:mr-2" /><span className="hidden sm:inline">Quiz</span></Button>
                                <Button type="button" variant="ghost" size="sm"  onClick={() => openComposer("flashcard")} title="Share flashcards"><Sparkles className="size-4 text-rb-beetle-lip sm:mr-2" /><span className="hidden sm:inline">Flashcards</span></Button>
                                <Button type="button" variant="ghost" size="sm"  onClick={() => openComposer("reviewer")} title="Share a PDF or Word reviewer"><FileText className="size-4 text-rb-cardinal-lip sm:mr-2" /><span className="hidden sm:inline">Reviewer</span></Button>
                            </div>

                        </div>
                    </PanelCard>
                    )}

                    {composerOpen ? (
                        <section className="rounded-rb-card border-2 border-rb-macaw bg-card p-4 sm:p-5">
                            <div className="flex items-center justify-between gap-3 border-b-2 border-border pb-4">
                                <div>
                                    <h2 className="font-rb-display text-sm font-extrabold lowercase">Create a post</h2>
                                    <p className="mt-0.5 text-xs text-muted-foreground">Ask a question, or share a generated quiz, flashcard set, or PDF/Word reviewer.</p>
                                </div>
                                <Button type="button" variant="ghost" size="icon-sm" onClick={() => { setComposerOpen(false); setAttachedFile(null) }} aria-label="Close post editor"><X /></Button>
                            </div>

                            <div className="mt-4 flex gap-1 overflow-x-auto pb-1">
                                {[
                                    { value: "discussion", label: "Discussion", icon: MessageCircle },
                                    { value: "quiz", label: "Quiz", icon: BookOpen },
                                    { value: "flashcard", label: "Flashcards", icon: Sparkles },
                                    { value: "reviewer", label: "Reviewer", icon: FileText },
                                ].map((type) => {
                                    const Icon = type.icon
                                    return <Button key={type.value} type="button" variant={shareType === type.value ? "secondary" : "ghost"} size="sm" className="shrink-0" onClick={() => { setShareType(type.value); setAttachedFile(null) }}><Icon className="mr-1.5 size-4" />{type.label}</Button>
                                })}
                            </div>

                            <div className="mt-4 grid gap-3">
                                {joinedCircles.length > 0 ? (
                                    <Select value={shareCommunity} onValueChange={setShareCommunity}>
                                        <SelectTrigger><SelectValue placeholder="Choose a study circle (optional)" /></SelectTrigger>
                                        <SelectContent>{joinedCircles.map((circle) => <SelectItem key={circle.circleId} value={String(circle.circleId)}>{circle.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                ) : null}
                                {["quiz", "flashcard"].includes(shareType) ? (
                                    <Select value={selectedStudyItemId} onValueChange={setSelectedStudyItemId}>
                                        <SelectTrigger><SelectValue placeholder={`Choose generated ${shareType === "quiz" ? "quiz" : "flashcards"}`} /></SelectTrigger>
                                        <SelectContent>{studyItems.filter((item) => item.kind === shareType).map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.title}</SelectItem>)}</SelectContent>
                                    </Select>
                                ) : <><Input value={shareTitle} onChange={(event) => setShareTitle(event.target.value)} placeholder="An interesting title" /><Textarea value={shareDescription} onChange={(event) => setShareDescription(event.target.value)} placeholder="What do you want to discuss?" className="min-h-32 resize-y" /></>}

                                {shareType === "reviewer" ? (
                                    <div>
                                        <input ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={handleAttachmentSelected} />
                                        <button type="button" disabled={isUploadingAttachment} onClick={() => fileInputRef.current?.click()} className="flex w-full items-center gap-3 rounded-rb-tile border-2 border-dashed border-border px-4 py-3 text-left hover:border-rb-macaw disabled:opacity-60">
                                            {isUploadingAttachment ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : <FileText className="size-5 text-primary" />}
                                            <span className="min-w-0 flex-1 truncate text-sm">{attachedFile?.name ?? "Add a PDF or Word reviewer"}</span>
                                            {attachedFile ? <span className="shrink-0 text-xs font-medium text-primary">{formatBytes(attachedFile.size) ?? "Change"}</span> : null}
                                        </button>
                                    </div>
                                ) : null}
                            </div>

                            <div className="mt-4 flex justify-end gap-2 border-t-2 border-border pt-4">
                                <Button type="button" variant="ghost"  onClick={() => { setComposerOpen(false); setAttachedFile(null) }}>Cancel</Button>
                                <Button type="button"  onClick={publishPost} disabled={isPublishing || isUploadingAttachment || (["quiz", "flashcard"].includes(shareType) ? !selectedStudyItemId : !shareTitle.trim() || !shareDescription.trim() || (shareType === "reviewer" && !attachedFile))}><Send className="mr-2 size-4" />Post</Button>
                            </div>
                        </section>
                    ) : null}

                    {/* Heading only -- the filters themselves live in the top
                        strip below lg and in the left rail above it, so a
                        third copy here was redundant at every width. */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border pb-3">
                        <h2 className="font-rb-display text-sm font-extrabold lowercase">
                            {activeCircle
                                ? `posts in ${activeCircle.name}`
                                : showSavedOnly
                                    ? "Saved posts"
                                    : activeTab === "for-you"
                                        ? "Community news feed"
                                        : FEED_TABS.find((tab) => tab.value === activeTab)?.label ?? "Community news feed"}
                        </h2>

                        <div className="flex items-center gap-2">
                            {/* Searches whatever the current tab is showing, saved
                                posts included -- one field, not one per view. */}
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={searchValue}
                                    onChange={(event) => setSearchValue(event.target.value)}
                                    placeholder="Search posts, authors, circles..."
                                    aria-label="Search community posts"
                                    className="h-9 w-full rounded-full pl-9 sm:w-64"
                                />
                            </div>

                            {showSavedOnly ? (
                                <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setShowSavedOnly(false)}>
                                    <X className="mr-2 h-4 w-4" />
                                    Back to feed
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center rounded-rb-card border-2 border-dashed border-border py-16 text-center">
                            <span className="grid size-12 place-items-center rounded-2xl bg-rb-macaw-wash text-rb-macaw-lip">
                                <Loader2 className="size-6 animate-spin" aria-hidden="true" />
                            </span>
                            <p className="mt-3 font-rb-display text-sm font-extrabold lowercase">
                                loading the feed
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Fetching posts, circles and your study items.
                            </p>
                        </div>
                    ) : visiblePosts.length > 0 ? (
                        <div className="space-y-3">
                            {visiblePosts.map((post) => (
                                <CommunityPost
                                    key={post.postId}
                                    post={post}
                                    circles={circles}
                                    onToggleUpvote={toggleUpvote}
                                    onToggleSave={toggleSave}
                                    onJoinCircle={toggleJoinCircle}
                                    onToggleComments={toggleComments}
                                    onDelete={removePost}
                                    onStartPractice={startPractice}
                                    onReport={setReportPostId}
                                    onOpenAttachment={openAttachment}
                                    onOpenCircle={setActiveCircleId}
                                    threadOpen={openThreads.includes(post.postId)}
                                    threadComments={commentsByPost[post.postId]}
                                    draft={commentDrafts[post.postId]}
                                    onDraftChange={setDraft}
                                    onSubmitComment={submitComment}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-rb-card border-2 border-dashed border-border py-16 text-center">
                            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-rb-macaw-wash text-rb-macaw-lip">
                                <MessageCircle className="size-6" />
                            </span>
                            <p className="mt-3 font-rb-display text-sm font-extrabold lowercase">
                                {showSavedOnly ? "No saved posts yet" : "No community posts found"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {showSavedOnly
                                    ? "Save a post from the feed to find it here later."
                                    : "Try changing the feed tab or search."}
                            </p>
                        </div>
                    )}
                </main>

                {/* xl, not lg: at lg the left rail already takes 232px, and
                    keeping this one too squeezed the feed below a comfortable
                    reading width. */}
                <aside className="sticky top-24 hidden space-y-4 xl:block">
                    {/* Study circles live in the left rail now -- one list, one
                        place to join from, rather than the same circles in two
                        columns of the same screen. */}

                    <PanelCard className="border-rb-fox/40 bg-rb-fox-wash p-4">
                        <PanelHeading icon={Sparkles} tone="bg-rb-snow text-rb-fox-lip" title="Community reminder" />

                        <p className="mt-2 text-xs leading-5 text-rb-wolf">
                            Be respectful during discussions. Do not share active exam
                            answers, copied reviewer courses, or files you are not allowed to
                            distribute.
                        </p>
                    </PanelCard>
                </aside>
            </div>

            <Dialog open={createCircleOpen} onOpenChange={setCreateCircleOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create study circle</DialogTitle>
                        <DialogDescription>
                            Create a focused study group. A public announcement will
                            automatically be added to the community news feed.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="circle-name">Circle name</Label>
                            <Input
                                id="circle-name"
                                value={circleName}
                                onChange={(event) => setCircleName(event.target.value)}
                                placeholder="Example: IT Passport Security Review"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="circle-topic">Certification or topic</Label>

                            <Select value={circleTopic} onValueChange={setCircleTopic}>
                                <SelectTrigger id="circle-topic">
                                    <SelectValue />
                                </SelectTrigger>

                                <SelectContent>
                                    {topicOptions.map((topic) => (
                                        <SelectItem key={topic} value={topic}>
                                            {topic}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="circle-description">Description</Label>
                            <Textarea
                                id="circle-description"
                                value={circleDescription}
                                onChange={(event) => setCircleDescription(event.target.value)}
                                placeholder="Explain what learners will study and discuss in this circle..."
                                className="min-h-28"
                            />
                        </div>

                        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
                            After creation, the circle will appear in the Study Circles list
                            and a joinable announcement post will be published to the news
                            feed.
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setCreateCircleOpen(false)}>
                            Cancel
                        </Button>

                        <Button type="button" onClick={createStudyCircle} disabled={isCreatingCircle}>
                            {isCreatingCircle ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <UsersRound className="mr-2 h-4 w-4" />
                            )}
                            {isCreatingCircle ? "Creating..." : "Create study circle"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={confirmDeleteCircleId != null} onOpenChange={(open) => { if (!open) setConfirmDeleteCircleId(null) }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete this study circle?</DialogTitle>
                        <DialogDescription>
                            The circle, its members, and every post written in it are removed. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setConfirmDeleteCircleId(null)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                                const id = confirmDeleteCircleId
                                setConfirmDeleteCircleId(null)
                                removeCircle(id)
                            }}
                        >
                            Delete circle
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={reportPostId != null} onOpenChange={(open) => { if (!open) setReportPostId(null) }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Report post</DialogTitle><DialogDescription>Tell us why this post should be reviewed.</DialogDescription></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2"><Label>Reason</Label><Select value={reportReason} onValueChange={setReportReason}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SPAM">Spam or misleading</SelectItem><SelectItem value="HARASSMENT">Harassment</SelectItem><SelectItem value="COPYRIGHT">Copyright concern</SelectItem><SelectItem value="EXAM_CONTENT">Active exam content</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label htmlFor="report-details">Details (optional)</Label><Textarea id="report-details" value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} placeholder="Add context that helps an admin review it." /></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setReportPostId(null)}>Cancel</Button><Button variant="destructive" onClick={submitReport}>Submit report</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
