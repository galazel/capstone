import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
    Bookmark,
    BookOpen,
    Download,
    FileArchive,
    FileText,
    Home,
    Heart,
    ImageIcon,
    Loader2,
    MessageCircle,
    MoreHorizontal,
    Plus,
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
import { getFileDownloadUrl } from "@/services/fileService"
import { getAllCertifications } from "@/services/certificationService"
import { getLibraryItems } from "@/services/learnerToolsService"
import { getLeaderboard } from "@/services/gamificationService"
import {
    addCommunityComment,
    createCommunityCircle,
    createCommunityPost,
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
    { value: "circle", label: "Study circles" },
]

/* The feed follows the landing page's community section: a post is a tactile
   card whose point is the thing attached to it — a set you can attempt, a file
   you can open, a circle you can join. Each post type owns one accent wash so
   the feed is scannable before a single word is read. */
const POST_TYPE_STYLES = {
    discussion: "bg-rb-macaw-wash text-rb-macaw-lip",
    quiz: "bg-rb-feather-wash text-rb-feather-lip",
    flashcard: "bg-rb-beetle-wash text-rb-beetle-lip",
    circle: "bg-rb-bee-wash text-rb-bee-lip",
    image: "bg-rb-fox-wash text-rb-fox-lip",
    notes: "bg-rb-fox-wash text-rb-fox-lip",
    docx: "bg-rb-fox-wash text-rb-fox-lip",
}

const POST_TYPE_LABELS = {
    discussion: "discussion",
    quiz: "quiz",
    flashcard: "flashcards",
    circle: "study circle",
    image: "photo",
    notes: "notes",
    docx: "document",
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

/** Post types where the composer offers an optional real file attachment. */
const ATTACHABLE_TYPES = new Set(["image", "notes", "docx"])

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

function AttachmentIcon({ type }) {
    if (type === "QUIZ") return <BookOpen className="size-5" />
    if (type === "DOCX") return <FileArchive className="size-5" />
    return <FileText className="size-5" />
}

function attachmentTone(type) {
    if (type === "QUIZ") return "bg-rb-feather-wash text-rb-feather-lip"
    if (type === "DOCX") return "bg-rb-bee-wash text-rb-bee-lip"
    return "bg-rb-cardinal-wash text-rb-cardinal-lip"
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
                           onToggleLike,
                           onToggleSave,
                           onOpenComments,
                           onJoinCircle,
                           onDelete,
                           onStartPractice,
                           onReport,
                       }) {
    const linkedCircle = post.circleId
        ? circles.find((circle) => circle.circleId === post.circleId)
        : null

    return (
        <article className="overflow-hidden rounded-rb-card border-2 border-border bg-card transition-colors hover:border-rb-macaw/60">
            <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                    <CommunityAvatar initials={post.initials} tone={avatarTone(post.authorName ?? "")} />

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-foreground">{post.authorName}</span>

                            <Badge
                                variant="outline"
                                className={`h-5 rounded-full px-1.5 text-[10px] ${post.badgeClass}`}
                            >
                                {post.badge}
                            </Badge>
                        </div>

                        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                            {post.community} · {post.createdAt}
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
                    <h2 className="font-rb-display text-lg font-extrabold leading-6 text-foreground">
                        {post.title}
                    </h2>

                    <p className="mt-2 text-[0.9375rem] leading-6 text-muted-foreground">
                        {post.description}
                    </p>
                </div>

                {post.attachment?.type === "IMAGE" && post.attachment.key ? (
                    <figure className="mt-4 overflow-hidden rounded-rb-tile border-2 border-border bg-muted/30">
                        <img src={getFileDownloadUrl(post.attachment.key)} alt={post.attachment.name || "Community post attachment"} className="max-h-[560px] w-full object-contain" loading="lazy" />
                    </figure>
                ) : null}

                {/* the attachment is the point of the post — give it a tile of its own */}
                {post.attachment && post.attachment.type !== "IMAGE" ? (
                    <div className="mt-4 flex items-center gap-3 rounded-rb-tile border-2 border-border bg-muted/40 p-3">
                        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${attachmentTone(post.attachment.type)}`}>
                            <AttachmentIcon type={post.attachment.type} />
                        </span>

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-foreground">
                                {post.attachment.name}
                            </p>

                            <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                                {post.attachment.key ? post.attachment.meta : "No file attached"}
                            </p>
                        </div>

                        {post.attachment.key ? (
                            <Button asChild size="sm" variant="outline" className="shrink-0 rounded-full">
                                <a href={getFileDownloadUrl(post.attachment.key)}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download
                                </a>
                            </Button>
                        ) : null}
                    </div>
                ) : null}

                {linkedCircle ? (
                    <div className="mt-4 flex flex-col gap-3 rounded-rb-tile border-2 border-border bg-muted/40 p-3 sm:flex-row sm:items-center">
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

                {["quiz", "flashcard"].includes(post.postType) ? (
                    <Button type="button" className="mt-4 rounded-full" onClick={() => onStartPractice(post.postId)}>
                        <BookOpen className="mr-2 h-4 w-4" />Start practice
                    </Button>
                ) : null}
            </div>

            {/* one quiet row, the way the landing feed shows it: counts are the action */}
            <div className="flex items-center gap-1 border-t-2 border-border px-3 py-2 text-sm font-bold text-muted-foreground">
                <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-accent hover:text-foreground"
                    onClick={() => onToggleLike(post.postId)}
                    aria-pressed={post.liked}
                >
                    <Heart className={`size-4 ${post.liked ? "fill-rb-cardinal text-rb-cardinal" : ""}`} />
                    {post.reactions + (post.liked ? 1 : 0)}
                    <span className="sr-only"> reactions</span>
                </button>

                <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-accent hover:text-foreground"
                    onClick={() => onOpenComments(post.postId)}
                >
                    <MessageCircle className="size-4" />
                    {post.comments}
                    <span className="sr-only"> comments</span>
                </button>

                <button
                    type="button"
                    className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-accent hover:text-foreground"
                    onClick={() => {
                        navigator.clipboard?.writeText(
                            `${window.location.origin}/learner/community?post=${post.postId}`
                        )
                        toast.success("Post link copied.")
                    }}
                >
                    <Share2 className="size-4" />
                    share
                </button>

                <button
                    type="button"
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-accent hover:text-foreground ${
                        post.saved ? "text-rb-macaw-lip" : ""
                    }`}
                    onClick={() => onToggleSave(post.postId)}
                    aria-pressed={post.saved}
                >
                    <Bookmark className={`size-4 ${post.saved ? "fill-current" : ""}`} />
                    {post.saved ? "saved" : "save"}
                </button>
            </div>
        </article>
    )
}

export default function Community() {
    const navigate = useNavigate()
    const [posts, setPosts] = useState([])
    const [circles, setCircles] = useState([])
    const [certifications, setCertifications] = useState([])
    const [studyItems, setStudyItems] = useState([])
    const [communityLeaderboard, setCommunityLeaderboard] = useState([])
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
    const fileInputRef = useRef(null)

    const [createCircleOpen, setCreateCircleOpen] = useState(false)
    const [circleName, setCircleName] = useState("")
    const [circleDescription, setCircleDescription] = useState("")
    const [circleTopic, setCircleTopic] = useState("General Study")

    const [commentsOpen, setCommentsOpen] = useState(false)
    const [commentPost, setCommentPost] = useState(null)
    const [comments, setComments] = useState([])
    const [commentBody, setCommentBody] = useState("")
    const [reportPostId, setReportPostId] = useState(null)
    const [reportReason, setReportReason] = useState("SPAM")
    const [reportDetails, setReportDetails] = useState("")

    useEffect(() => {
        Promise.all([getCommunityPosts(), getCommunityCircles(), getAllCertifications(), getLibraryItems()])
            .then(([nextPosts, nextCircles, nextCertifications, nextStudyItems]) => {
                setPosts(nextPosts)
                setCircles(nextCircles)
                setCertifications(Array.isArray(nextCertifications) ? nextCertifications : [])
                setStudyItems((Array.isArray(nextStudyItems) ? nextStudyItems : []).filter((item) => ["quiz", "flashcard"].includes(item.kind)))
                if (nextCircles[0]) setShareCommunity(String(nextCircles[0].circleId))
            })
            .catch(() => toast.error("The community could not be loaded."))
    }, [])

    useEffect(() => {
        getLeaderboard("community").then((entries) => setCommunityLeaderboard(Array.isArray(entries) ? entries : [])).catch(() => {})
    }, [])

    const topicOptions = useMemo(() => {
        const titles = certifications
            .map((certification) => certification.title || certification.name)
            .filter(Boolean)
        return [...new Set(["General Study", ...titles])]
    }, [certifications])

    const visiblePosts = useMemo(() => {
        const query = searchValue.trim().toLowerCase()

        const filtered = posts.filter((post) => {
            if (showSavedOnly && !post.saved) return false
            const matchesTab =
                showSavedOnly || activeTab === "for-you" || post.postType === activeTab

            const matchesSearch =
                !query ||
                (post.title || "").toLowerCase().includes(query) ||
                (post.description || "").toLowerCase().includes(query) ||
                (post.authorName || "").toLowerCase().includes(query) ||
                (post.community || "").toLowerCase().includes(query)

            return matchesTab && matchesSearch
        })

        return filtered
    }, [activeTab, posts, searchValue, showSavedOnly])

    function openComposer(type) {
        setShareType(type)
        setAttachedFile(null)
        setSelectedStudyItemId("")
        setComposerOpen(true)
    }

    function selectFeedTab(value) {
        setShowSavedOnly(false)
        setActiveTab(value)
    }

    async function toggleLike(postId) {
        try {
            const result = await toggleCommunityLike(postId)
            setPosts((current) =>
                current.map((post) =>
                    post.postId === postId
                        ? { ...post, liked: result.active, reactions: post.reactions + (result.active ? 1 : -1) }
                        : post
                )
            )
        } catch {
            toast.error("Could not update your reaction.")
        }
    }

    async function startPractice(postId) {
        try {
            const attempt = await startSharedCommunityPractice(postId)
            navigate(`/learner/practice/${attempt.studySetId}`)
        } catch {
            toast.error("This shared study item is not ready for practice yet.")
        }
    }

    async function submitReport() {
        if (!reportPostId) return
        try {
            await reportCommunityPost(reportPostId, reportReason, reportDetails)
            setReportPostId(null)
            setReportDetails("")
            toast.success("Post reported. Our team can review it.")
        } catch {
            toast.error("This post could not be reported.")
        }
    }

    async function toggleSave(postId) {
        try {
            const result = await toggleCommunitySave(postId)
            setPosts((current) =>
                current.map((post) =>
                    post.postId === postId ? { ...post, saved: result.active } : post
                )
            )
        } catch {
            toast.error("Could not update saved posts.")
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
        } catch {
            toast.error("Could not update circle membership.")
        }
    }

    async function handleAttachmentSelected(event) {
        const file = event.target.files?.[0]
        if (!file) return

        setIsUploadingAttachment(true)
        try {
            const { attachmentKey } = await uploadCommunityAttachment(file)
            setAttachedFile({ name: file.name, key: attachmentKey })
        } catch {
            toast.error("The file could not be uploaded.")
        } finally {
            setIsUploadingAttachment(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    async function publishPost() {
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
            } catch {
                toast.error("The study item could not be shared.")
            }
            return
        }
        if (!shareTitle.trim() || !shareDescription.trim()) {
            toast.error("Add a title and description.")
            return
        }

        try {
            const nextPost = await createCommunityPost({
                title: shareTitle.trim(),
                description: shareDescription.trim(),
                postType: shareType,
                circleId: shareCommunity ? Number(shareCommunity) : null,
                attachmentName: attachedFile?.name ?? null,
                attachmentType: shareType === "image" ? "IMAGE" : shareType === "notes" ? "PDF" : shareType === "docx" ? "DOCX" : null,
                attachmentKey: attachedFile?.key ?? null,
            })

            setPosts((current) => [nextPost, ...current])
            setShareTitle("")
            setShareDescription("")
            setAttachedFile(null)
            setComposerOpen(false)
            toast.success(
                shareType === "discussion" ? "Discussion posted." : "Resource shared with the community."
            )
        } catch {
            toast.error("The post could not be published.")
        }
    }

    async function removePost(postId) {
        try {
            await deleteCommunityPost(postId)
            setPosts((current) => current.filter((post) => post.postId !== postId))
            toast.success("Post deleted.")
        } catch {
            toast.error("The post could not be deleted.")
        }
    }

    async function createStudyCircle() {
        if (!circleName.trim() || !circleDescription.trim()) {
            toast.error("Add a circle name and description.")
            return
        }

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
        } catch {
            toast.error("The study circle could not be created.")
        }
    }

    async function openComments(postId) {
        setCommentPost(posts.find((post) => post.postId === postId) ?? null)
        setCommentsOpen(true)
        try {
            setComments(await getCommunityComments(postId))
        } catch {
            toast.error("Comments could not be loaded.")
        }
    }

    async function submitComment() {
        if (!commentBody.trim() || !commentPost) return
        try {
            const comment = await addCommunityComment(commentPost.postId, commentBody.trim())
            setComments((current) => [...current, comment])
            setPosts((current) =>
                current.map((post) =>
                    post.postId === commentPost.postId
                        ? { ...post, comments: post.comments + 1 }
                        : post
                )
            )
            setCommentBody("")
        } catch {
            toast.error("Your comment could not be posted.")
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
                                    className="group flex items-center gap-3 rounded-rb-tile px-3 py-2 transition-colors hover:bg-accent"
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
                    <PanelCard className="p-4">
                        <button type="button" className="flex w-full items-center gap-3" onClick={() => openComposer("discussion")}>
                            <CommunityAvatar initials="GG" />
                            <div className="flex h-11 min-w-0 flex-1 items-center rounded-full border-2 border-border bg-muted/40 px-4 text-left text-sm font-semibold text-muted-foreground transition-colors hover:border-rb-macaw/60 hover:bg-muted">
                                Start a discussion or share a review resource...
                            </div>
                        </button>
                        {/* Attachment-style actions on the left, the primary
                            action on the right. The labels stay visible from sm
                            up: "share a quiz" is not something an icon alone
                            communicates, unlike the photo/emoji icons this
                            shape usually carries elsewhere. */}
                        <div className="mt-3 flex items-center justify-between gap-2 border-t-2 border-border pt-3">
                            <div className="flex min-w-0 items-center gap-0.5">
                                <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => openComposer("discussion")} title="Start a discussion"><MessageCircle className="size-4 text-rb-macaw-lip sm:mr-2" /><span className="hidden sm:inline">Discussion</span></Button>
                                <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => openComposer("quiz")} title="Share a quiz"><BookOpen className="size-4 text-rb-feather-lip sm:mr-2" /><span className="hidden sm:inline">Quiz</span></Button>
                                <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => openComposer("flashcard")} title="Share flashcards"><Sparkles className="size-4 text-rb-beetle-lip sm:mr-2" /><span className="hidden sm:inline">Flashcards</span></Button>
                            </div>

                            <Button type="button" size="sm" className="shrink-0 rounded-full" onClick={() => openComposer("discussion")}>
                                Post
                            </Button>
                        </div>
                    </PanelCard>

                    {composerOpen ? (
                        <section className="rounded-rb-card border-2 border-rb-macaw bg-card p-4 sm:p-5">
                            <div className="flex items-center justify-between gap-3 border-b-2 border-border pb-4">
                                <div>
                                    <h2 className="font-rb-display text-sm font-extrabold lowercase">Create a post</h2>
                                    <p className="mt-0.5 text-xs text-muted-foreground">Share a question, resource, quiz, photo, or screenshot.</p>
                                </div>
                                <Button type="button" variant="ghost" size="icon-sm" onClick={() => { setComposerOpen(false); setAttachedFile(null) }} aria-label="Close post editor"><X /></Button>
                            </div>

                            <div className="mt-4 flex gap-1 overflow-x-auto pb-1">
                                {[
                                    { value: "discussion", label: "Discussion", icon: MessageCircle },
                                    { value: "quiz", label: "Quiz", icon: BookOpen },
                                    { value: "flashcard", label: "Flashcards", icon: Sparkles },
                                ].map((type) => {
                                    const Icon = type.icon
                                    return <Button key={type.value} type="button" variant={shareType === type.value ? "secondary" : "ghost"} size="sm" className="shrink-0 rounded-full" onClick={() => { setShareType(type.value); setAttachedFile(null) }}><Icon className="mr-1.5 size-4" />{type.label}</Button>
                                })}
                            </div>

                            <div className="mt-4 grid gap-3">
                                <Select value={shareCommunity} onValueChange={setShareCommunity}>
                                    <SelectTrigger><SelectValue placeholder="Choose a study circle (optional)" /></SelectTrigger>
                                    <SelectContent>{circles.filter((circle) => circle.joined || circle.owner).map((circle) => <SelectItem key={circle.circleId} value={String(circle.circleId)}>{circle.name}</SelectItem>)}</SelectContent>
                                </Select>
                                {["quiz", "flashcard"].includes(shareType) ? (
                                    <Select value={selectedStudyItemId} onValueChange={setSelectedStudyItemId}>
                                        <SelectTrigger><SelectValue placeholder={`Choose generated ${shareType === "quiz" ? "quiz" : "flashcards"}`} /></SelectTrigger>
                                        <SelectContent>{studyItems.filter((item) => item.kind === shareType).map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.title}</SelectItem>)}</SelectContent>
                                    </Select>
                                ) : <><Input value={shareTitle} onChange={(event) => setShareTitle(event.target.value)} placeholder="An interesting title" /><Textarea value={shareDescription} onChange={(event) => setShareDescription(event.target.value)} placeholder="What do you want to discuss?" className="min-h-32 resize-y" /></>}

                                {ATTACHABLE_TYPES.has(shareType) ? (
                                    <div>
                                        <input ref={fileInputRef} type="file" accept={shareType === "image" ? "image/png,image/jpeg,image/webp,image/gif" : shareType === "docx" ? ".docx" : ".pdf"} className="hidden" onChange={handleAttachmentSelected} />
                                        <button type="button" disabled={isUploadingAttachment} onClick={() => fileInputRef.current?.click()} className="flex w-full items-center gap-3 rounded-rb-tile border-2 border-dashed border-border px-4 py-3 text-left hover:border-rb-macaw disabled:opacity-60">
                                            {isUploadingAttachment ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : shareType === "image" ? <ImageIcon className="size-5 text-primary" /> : <FileText className="size-5 text-primary" />}
                                            <span className="min-w-0 flex-1 truncate text-sm">{attachedFile?.name ?? `Add ${shareType === "image" ? "a photo or screenshot" : shareType === "docx" ? "a DOCX file" : "a PDF file"}`}</span>
                                            {attachedFile ? <span className="text-xs font-medium text-primary">Change</span> : null}
                                        </button>
                                    </div>
                                ) : null}
                            </div>

                            <div className="mt-4 flex justify-end gap-2 border-t-2 border-border pt-4">
                                <Button type="button" variant="ghost" className="rounded-full" onClick={() => { setComposerOpen(false); setAttachedFile(null) }}>Cancel</Button>
                                <Button type="button" className="rounded-full" onClick={publishPost} disabled={isUploadingAttachment || (["quiz", "flashcard"].includes(shareType) ? !selectedStudyItemId : !shareTitle.trim() || !shareDescription.trim())}><Send className="mr-2 size-4" />Post</Button>
                            </div>
                        </section>
                    ) : null}

                    {/* Heading only -- the filters themselves live in the top
                        strip below lg and in the left rail above it, so a
                        third copy here was redundant at every width. */}
                    <div className="flex items-center justify-between gap-3 border-b-2 border-border pb-3">
                        <h2 className="font-rb-display text-sm font-extrabold lowercase">
                            {showSavedOnly
                                ? "Saved posts"
                                : activeTab === "for-you"
                                    ? "Community news feed"
                                    : FEED_TABS.find((tab) => tab.value === activeTab)?.label ?? "Community news feed"}
                        </h2>

                        {showSavedOnly ? (
                            <Button type="button" variant="ghost" size="sm" className="shrink-0 rounded-full" onClick={() => setShowSavedOnly(false)}>
                                <X className="mr-2 h-4 w-4" />
                                Back to feed
                            </Button>
                        ) : null}
                    </div>

                    {visiblePosts.length > 0 ? (
                        <div className="space-y-3">
                            {visiblePosts.map((post) => (
                                <CommunityPost
                                    key={post.postId}
                                    post={post}
                                    circles={circles}
                                    onToggleLike={toggleLike}
                                    onToggleSave={toggleSave}
                                    onJoinCircle={toggleJoinCircle}
                                    onOpenComments={openComments}
                                    onDelete={removePost}
                                    onStartPractice={startPractice}
                                    onReport={setReportPostId}
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
                    <PanelCard className="p-4">
                        <PanelHeading icon={Sparkles} tone="bg-rb-fox-wash text-rb-fox-lip" title="Community ranking" />
                        <p className="mt-2 text-xs text-muted-foreground">XP earned from shared quiz practice.</p>
                        <div className="mt-3 space-y-1.5">
                            {communityLeaderboard.map((entry) => <div key={entry.learnerId} className={`flex items-center gap-2 rounded-rb-tile px-2.5 py-2 text-xs ${entry.currentLearner ? "border-2 border-rb-macaw bg-rb-macaw-wash font-bold text-rb-macaw-lip" : "border-2 border-transparent"}`}><span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted font-rb-display text-[0.625rem] font-extrabold text-muted-foreground">{entry.rank}</span><span className="min-w-0 flex-1 truncate font-semibold">{entry.learnerName}</span><span className="shrink-0 font-bold">{Number(entry.xp).toLocaleString()} XP</span></div>)}
                            {communityLeaderboard.length === 0 ? <p className="py-2 text-xs text-muted-foreground">Complete a shared quiz to begin the ranking.</p> : null}
                        </div>
                    </PanelCard>

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

                        <Button type="button" onClick={createStudyCircle}>
                            <UsersRound className="mr-2 h-4 w-4" />
                            Create study circle
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Comments</DialogTitle>
                        <DialogDescription>{commentPost?.title || "Join the discussion"}</DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                        {comments.length ? (
                            comments.map((comment) => (
                                <div key={comment.commentId} className="flex gap-3 rounded-rb-tile border-2 border-border p-3">
                                    <CommunityAvatar initials={comment.initials} tone={avatarTone(comment.authorName ?? "")} className="!size-8 !text-xs" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold">{comment.authorName}</p>
                                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                                            {comment.body}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="py-8 text-center text-sm text-muted-foreground">
                                No comments yet. Start the conversation.
                            </p>
                        )}
                    </div>

                    <div className="flex items-end gap-2">
                        <Textarea
                            value={commentBody}
                            onChange={(event) => setCommentBody(event.target.value)}
                            placeholder="Write a helpful comment..."
                            className="min-h-20"
                        />
                        <Button
                            type="button"
                            size="icon"
                            onClick={submitComment}
                            disabled={!commentBody.trim()}
                            aria-label="Post comment"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
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
