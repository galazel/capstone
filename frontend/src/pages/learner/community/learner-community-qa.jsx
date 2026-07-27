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
    Users,
    UsersRound,
    X,
} from "lucide-react"
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

const POST_TYPE_STYLES = {
    discussion: "border-blue-200 bg-blue-50 text-blue-700",
    quiz: "border-blue-200 bg-blue-50 text-blue-700",
    flashcard: "border-violet-200 bg-violet-50 text-violet-700",
    circle: "border-cyan-200 bg-cyan-50 text-cyan-700",
}

const POST_TYPE_LABELS = {
    discussion: "Discussion",
    quiz: "Quiz",
    flashcard: "Flashcards",
    circle: "Study Circle",
}

/** Post types where the composer offers an optional real file attachment. */
const ATTACHABLE_TYPES = new Set(["image", "notes", "docx"])

function CommunityAvatar({ initials, className = "" }) {
    return (
        <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ${className}`}
            aria-hidden="true"
        >
            {initials}
        </div>
    )
}

function AttachmentIcon({ type }) {
    if (type === "QUIZ") return <BookOpen className="h-5 w-5 text-primary" />
    if (type === "DOCX") return <FileArchive className="h-5 w-5 text-emerald-600" />
    return <FileText className="h-5 w-5 text-blue-600" />
}

function PostTypeBadge({ type }) {
    return (
        <Badge
            variant="outline"
            className={`h-5 rounded-full px-1.5 text-[10px] ${POST_TYPE_STYLES[type] ?? POST_TYPE_STYLES.discussion}`}
        >
            {POST_TYPE_LABELS[type] ?? "Post"}
        </Badge>
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
        <article className="overflow-hidden rounded-md border bg-background shadow-sm transition-shadow hover:shadow-md">
            <div className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                    <CommunityAvatar initials={post.initials} />

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                                {post.authorName}
                            </span>

                            <Badge
                                variant="outline"
                                className={`h-5 rounded-full px-1.5 text-[10px] ${post.badgeClass}`}
                            >
                                {post.badge}
                            </Badge>
                        </div>

                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {post.createdAt} · {post.community}
                        </p>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
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
                    <div className="mb-2">
                        <PostTypeBadge type={post.postType} />
                    </div>

                    <h2 className="text-base font-semibold leading-6 text-foreground">
                        {post.title}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {post.description}
                    </p>
                </div>

                {post.attachment?.type === "IMAGE" && post.attachment.key ? (
                    <figure className="mt-4 overflow-hidden rounded-md border bg-muted/30">
                        <img src={getFileDownloadUrl(post.attachment.key)} alt={post.attachment.name || "Community post attachment"} className="max-h-[560px] w-full object-contain" loading="lazy" />
                    </figure>
                ) : null}

                {post.attachment && post.attachment.type !== "IMAGE" ? (
                    <div className="mt-4 flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background">
                            <AttachmentIcon type={post.attachment.type} />
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                                {post.attachment.name}
                            </p>

                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {post.attachment.key ? post.attachment.meta : "No file attached"}
                            </p>
                        </div>

                        {post.attachment.key ? (
                            <Button asChild size="sm" variant="outline" className="shrink-0">
                                <a href={getFileDownloadUrl(post.attachment.key)}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download
                                </a>
                            </Button>
                        ) : null}
                    </div>
                ) : null}

                {linkedCircle ? (
                    <div className="mt-4 flex flex-col gap-3 rounded-lg border bg-muted/20 px-3 py-3 sm:flex-row sm:items-center">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                            {linkedCircle.initials}
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                                {linkedCircle.name}
                            </p>

                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {linkedCircle.members?.toLocaleString?.() ?? 0} members
                            </p>
                        </div>

                        <Button
                            type="button"
                            size="sm"
                            variant={linkedCircle.joined ? "outline" : "default"}
                            onClick={() => onJoinCircle(linkedCircle.circleId)}
                        >
                            {linkedCircle.joined ? "Joined" : "Join circle"}
                        </Button>
                    </div>
                ) : null}

                {["quiz", "flashcard"].includes(post.postType) ? (
                    <Button type="button" className="mt-4" onClick={() => onStartPractice(post.postId)}>
                        <BookOpen className="mr-2 h-4 w-4" />Start practice
                    </Button>
                ) : null}

                <div className="mt-4 flex items-center justify-between gap-4 text-xs text-muted-foreground">
                    <button
                        type="button"
                        className="hover:text-foreground"
                        onClick={() => onToggleLike(post.postId)}
                    >
                        {post.reactions + (post.liked ? 1 : 0)} reactions
                    </button>

                    <button
                        type="button"
                        className="hover:text-foreground"
                        onClick={() => onOpenComments(post.postId)}
                    >
                        {post.comments} comments
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-3 border-t">
                <Button type="button" variant="ghost" className="h-11 rounded-none" onClick={() => onToggleLike(post.postId)}>
                    <Heart className={`mr-2 h-4 w-4 ${post.liked ? "fill-primary text-primary" : ""}`} />
                    Like
                </Button>
                <Button type="button" variant="ghost" className="h-11 rounded-none border-x" onClick={() => onOpenComments(post.postId)}>
                    <MessageCircle className="mr-2 h-4 w-4" />Comment
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    className="h-11 rounded-none"
                    onClick={() => {
                        navigator.clipboard?.writeText(
                            `${window.location.origin}/learner/community?post=${post.postId}`
                        )
                        toast.success("Post link copied.")
                    }}
                >
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                </Button>
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
            <div className="sticky top-16 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                <div className="mx-auto flex w-full max-w-[1200px] items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {FEED_TABS.map((tab, index) => {
                                    const Icon = index === 0
                                    ? Home
                                    : tab.value === "circle"
                                        ? UsersRound
                                        : tab.value === "discussion"
                                            ? MessageCircle
                                            : tab.value === "quizzes"
                                                ? BookOpen
                                                : FileText

                                return (
                                    <button
                                        key={tab.value}
                                        type="button"
                                        onClick={() => selectFeedTab(tab.value)}
                                        className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                                            !showSavedOnly && activeTab === tab.value
                                                ? "bg-primary text-primary-foreground"
                                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                        }`}
                                    >
                                        <Icon className="size-4" />
                                        {tab.label}
                                    </button>
                                )
                            })}
                        <button
                            type="button"
                            className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent ${
                                showSavedOnly ? "bg-accent" : ""
                            }`}
                            onClick={() => {
                                setShowSavedOnly((current) => !current)
                            }}
                        >
                            <Bookmark className="size-4 text-primary" />
                            Saved posts ({savedCount})
                        </button>
                        <Button
                            type="button"
                            size="sm"
                            className="ml-auto shrink-0"
                            onClick={() => setCreateCircleOpen(true)}
                        >
                            Create a circle
                        </Button>
                </div>
            </div>

            <div className="mx-auto grid w-full max-w-[1200px] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">

                <main className="min-w-0 space-y-4">
                    <section className="rounded-md border bg-background p-4 shadow-sm">
                        <button type="button" className="flex w-full items-center gap-3" onClick={() => openComposer("discussion")}>
                            <CommunityAvatar initials="GG" />
                            <div className="flex h-10 min-w-0 flex-1 items-center rounded-full border bg-muted/40 px-4 text-left text-sm text-muted-foreground transition hover:bg-muted">
                                Start a discussion or share a review resource...
                            </div>
                        </button>
                        <div className="mt-4 grid gap-1 border-t pt-3 sm:grid-cols-3">
                            <Button type="button" variant="ghost" size="sm" onClick={() => openComposer("discussion")}><MessageCircle className="mr-2 size-4 text-blue-600" />Discussion</Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => openComposer("quiz")}><BookOpen className="mr-2 size-4 text-blue-600" />Share quiz</Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => openComposer("flashcard")}><Sparkles className="mr-2 size-4 text-violet-600" />Share flashcards</Button>
                        </div>
                    </section>

                    {composerOpen ? (
                        <section className="rounded-lg border border-primary/30 bg-card p-4 sm:p-5">
                            <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-4">
                                <div>
                                    <h2 className="text-sm font-semibold">Create a post</h2>
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
                                    return <Button key={type.value} type="button" variant={shareType === type.value ? "secondary" : "ghost"} size="sm" className="shrink-0" onClick={() => { setShareType(type.value); setAttachedFile(null) }}><Icon className="mr-1.5 size-4" />{type.label}</Button>
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
                                        <button type="button" disabled={isUploadingAttachment} onClick={() => fileInputRef.current?.click()} className="flex w-full items-center gap-3 border border-dashed border-border px-4 py-3 text-left hover:border-primary/50 disabled:opacity-60">
                                            {isUploadingAttachment ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : shareType === "image" ? <ImageIcon className="size-5 text-primary" /> : <FileText className="size-5 text-primary" />}
                                            <span className="min-w-0 flex-1 truncate text-sm">{attachedFile?.name ?? `Add ${shareType === "image" ? "a photo or screenshot" : shareType === "docx" ? "a DOCX file" : "a PDF file"}`}</span>
                                            {attachedFile ? <span className="text-xs font-medium text-primary">Change</span> : null}
                                        </button>
                                    </div>
                                ) : null}
                            </div>

                            <div className="mt-4 flex justify-end gap-2 border-t border-border/70 pt-4">
                                <Button type="button" variant="ghost" onClick={() => { setComposerOpen(false); setAttachedFile(null) }}>Cancel</Button>
                                <Button type="button" onClick={publishPost} disabled={isUploadingAttachment || (["quiz", "flashcard"].includes(shareType) ? !selectedStudyItemId : !shareTitle.trim() || !shareDescription.trim())}><Send className="mr-2 size-4" />Post</Button>
                            </div>
                        </section>
                    ) : null}

                    <div className="flex flex-col gap-3 border-b pb-3 xl:hidden sm:flex-row sm:items-center sm:justify-between">
                        <h2 className="text-sm font-semibold">
                            {showSavedOnly ? "Saved posts" : "Community news feed"}
                        </h2>

                        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
                            {FEED_TABS.map((tab) => (
                                <Button
                                    key={tab.value}
                                    type="button"
                                    variant={!showSavedOnly && activeTab === tab.value ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => selectFeedTab(tab.value)}
                                    className="shrink-0"
                                >
                                    {tab.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {showSavedOnly ? (
                        <div className="hidden items-center justify-between border-b pb-3 xl:flex">
                            <h2 className="text-sm font-semibold">Saved posts</h2>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setShowSavedOnly(false)}>
                                <X className="mr-2 h-4 w-4" />
                                Back to feed
                            </Button>
                        </div>
                    ) : null}

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
                        <div className="border-y py-16 text-center">
                            <MessageCircle className="mx-auto h-6 w-6 text-muted-foreground" />
                            <p className="mt-3 text-sm font-semibold">
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

                <aside className="sticky top-24 hidden space-y-4 lg:block">
                    <section className="rounded-md border bg-background p-4 shadow-sm">
                        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" /><h2 className="text-sm font-semibold">Community ranking</h2></div>
                        <p className="mt-1 text-xs text-muted-foreground">XP earned from shared quiz practice.</p>
                        <div className="mt-3 space-y-2">
                            {communityLeaderboard.map((entry) => <div key={entry.learnerId} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${entry.currentLearner ? "bg-primary/10 font-semibold" : ""}`}><span className="w-5 text-center font-bold text-muted-foreground">{entry.rank}</span><span className="min-w-0 flex-1 truncate">{entry.learnerName}</span><span className="font-semibold">{Number(entry.xp).toLocaleString()} XP</span></div>)}
                            {communityLeaderboard.length === 0 ? <p className="py-2 text-xs text-muted-foreground">Complete a shared quiz to begin the ranking.</p> : null}
                        </div>
                    </section>
                    <section className="rounded-md border bg-background p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-semibold">Study circles</h2>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Join or create focused review groups.
                                </p>
                            </div>

                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setCreateCircleOpen(true)}
                                aria-label="Create study circle"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="mt-3 divide-y">
                            {circles.map((circle) => (
                                <div key={circle.circleId} className="py-3">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                                            {circle.initials}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">{circle.name}</p>
                                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                                                {circle.members?.toLocaleString?.() ?? 0} members
                                                {circle.owner ? " · You own this circle" : ""}
                                            </p>
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={circle.joined ? "outline" : "default"}
                                        className="mt-2 w-full"
                                        onClick={() => toggleJoinCircle(circle.circleId)}
                                        disabled={circle.owner}
                                    >
                                        {circle.owner ? "Owner" : circle.joined ? "Joined" : "Join circle"}
                                    </Button>
                                </div>
                            ))}

                            {circles.length === 0 ? (
                                <p className="py-3 text-xs text-muted-foreground">
                                    No study circles yet. Create the first one.
                                </p>
                            ) : null}
                        </div>
                    </section>

                    <section className="rounded-md border bg-background p-4 shadow-sm">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <h2 className="text-sm font-semibold">Community reminder</h2>
                        </div>

                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            Be respectful during discussions. Do not share active exam
                            answers, copied reviewer courses, or files you are not allowed to
                            distribute.
                        </p>
                    </section>
                </aside>
            </div>

            <Dialog
                open={false}
                onOpenChange={(open) => {
                    setComposerOpen(open)
                    if (!open) setAttachedFile(null)
                }}
            >
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Create community post</DialogTitle>
                        <DialogDescription>
                            Start a discussion or share a study resource with a study circle.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="grid gap-2 sm:grid-cols-4">
                            {[
                                { value: "discussion", label: "Discussion", icon: MessageCircle },
                                { value: "quizzes", label: "Quiz", icon: BookOpen },
                                { value: "notes", label: "PDF / Notes", icon: FileText },
                                { value: "docx", label: "DOCX", icon: FileArchive },
                            ].map((type) => {
                                const Icon = type.icon

                                return (
                                    <Button
                                        key={type.value}
                                        type="button"
                                        variant={shareType === type.value ? "default" : "outline"}
                                        onClick={() => {
                                            setShareType(type.value)
                                            setAttachedFile(null)
                                        }}
                                    >
                                        <Icon className="mr-2 h-4 w-4" />
                                        {type.label}
                                    </Button>
                                )
                            })}
                        </div>

                        <Select value={shareCommunity} onValueChange={setShareCommunity}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a study circle (optional)" />
                            </SelectTrigger>

                            <SelectContent>
                                {circles
                                    .filter((circle) => circle.joined || circle.owner)
                                    .map((circle) => (
                                        <SelectItem key={circle.circleId} value={String(circle.circleId)}>
                                            {circle.name}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>

                        <Input
                            value={shareTitle}
                            onChange={(event) => setShareTitle(event.target.value)}
                            placeholder={shareType === "discussion" ? "Discussion title or question" : "Resource title"}
                        />

                        <Textarea
                            value={shareDescription}
                            onChange={(event) => setShareDescription(event.target.value)}
                            placeholder={
                                shareType === "discussion"
                                    ? "Write your question, opinion, or discussion..."
                                    : "Add a short description of what this resource covers..."
                            }
                            className="min-h-28"
                        />

                        {ATTACHABLE_TYPES.has(shareType) ? (
                            <div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={shareType === "image" ? "image/png,image/jpeg,image/webp,image/gif" : shareType === "docx" ? ".docx" : ".pdf"}
                                    className="hidden"
                                    onChange={handleAttachmentSelected}
                                />

                                {attachedFile ? (
                                    <div className="flex items-center gap-3 rounded-xl border px-4 py-3">
                                        {shareType === "image" ? <ImageIcon className="h-5 w-5 shrink-0 text-primary" /> : <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />}
                                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                            {attachedFile.name}
                                        </span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 shrink-0"
                                            onClick={() => setAttachedFile(null)}
                                            aria-label="Remove attachment"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={isUploadingAttachment}
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex min-h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed px-4 text-center disabled:opacity-60"
                                    >
                                        {isUploadingAttachment ? (
                                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                        ) : (
                                            shareType === "image"
                                                ? <ImageIcon className="h-5 w-5 text-primary" />
                                                : <FileText className="h-5 w-5 text-muted-foreground" />
                                        )}
                                        <span className="mt-2 text-sm font-medium">
                                            {isUploadingAttachment
                                                ? "Uploading..."
                                                : `Choose a ${shareType === "image" ? "photo or screenshot" : shareType === "docx" ? "DOCX" : "PDF"} file (optional)`}
                                        </span>
                                        <span className="mt-1 text-xs text-muted-foreground">
                                            Select a file you created or have permission to share.
                                        </span>
                                    </button>
                                )}
                            </div>
                        ) : null}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setComposerOpen(false)}>
                            Cancel
                        </Button>

                        <Button type="button" onClick={publishPost} disabled={isUploadingAttachment}>
                            <Send className="mr-2 h-4 w-4" />
                            {shareType === "discussion" ? "Post discussion" : "Share resource"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                                <div key={comment.commentId} className="flex gap-3 rounded-lg border p-3">
                                    <CommunityAvatar initials={comment.initials} className="h-8 w-8" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold">{comment.authorName}</p>
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
