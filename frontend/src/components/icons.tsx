/* eslint-disable */
// GENERATED — do not edit by hand.
//
// FontAwesome replaces lucide as the icon set. This module keeps the lucide
// export names so call sites read the same, and accepts lucide's props so a
// stray `strokeWidth` or `size` on an existing call site is not a type error:
// FontAwesome glyphs are filled paths, so stroke props have nothing to act on
// and are dropped.
//
// Regenerate with `node scripts/gen-icons.mjs` after changing the mapping there.
import * as React from "react"
import { config, type IconDefinition } from "@fortawesome/fontawesome-svg-core"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
  faAlignLeft,
  faAnglesLeft,
  faAnglesRight,
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowRightArrowLeft,
  faArrowTrendDown,
  faArrowTrendUp,
  faArrowUp,
  faArrowUpRightFromSquare,
  faArrowsRotate,
  faAward,
  faBan,
  faBars,
  faBell,
  faBolt,
  faBookBookmark,
  faBookOpen,
  faBookOpenReader,
  faBookmark,
  faBox,
  faBrain,
  faBriefcase,
  faBuilding,
  faBullhorn,
  faBullseye,
  faCalendarCheck,
  faCalendarDays,
  faCertificate,
  faChartColumn,
  faChartLine,
  faCheck,
  faCheckDouble,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
  faCircle,
  faCircleCheck,
  faCircleDot,
  faCircleExclamation,
  faCircleInfo,
  faCircleMinus,
  faCircleNotch,
  faCirclePlay,
  faCirclePlus,
  faCircleQuestion,
  faCircleUser,
  faCircleXmark,
  faCity,
  faClipboardCheck,
  faClipboardList,
  faClock,
  faClockRotateLeft,
  faCloud,
  faCloudArrowUp,
  faCode,
  faCodeBranch,
  faCoins,
  faComment,
  faComments,
  faCompass,
  faCompress,
  faCopy,
  faCreditCard,
  faCrown,
  faDatabase,
  faDiagramProject,
  faDollarSign,
  faDownload,
  faEllipsis,
  faEllipsisVertical,
  faEnvelope,
  faEnvelopeCircleCheck,
  faExpand,
  faEye,
  faEyeSlash,
  faFile,
  faFileCircleQuestion,
  faFileExcel,
  faFileLines,
  faFileVideo,
  faFileZipper,
  faFilter,
  faFire,
  faFlag,
  faFloppyDisk,
  faFolderOpen,
  faFolderTree,
  faFont,
  faForwardStep,
  faGauge,
  faGear,
  faGift,
  faGraduationCap,
  faGripLines,
  faHandshake,
  faHeading,
  faHeadphones,
  faHeart,
  faHourglassHalf,
  faHouse,
  faImage,
  faImages,
  faInbox,
  faKey,
  faKeyboard,
  faKhanda,
  faLanguage,
  faLayerGroup,
  faLink,
  faList,
  faListCheck,
  faListOl,
  faListUl,
  faLock,
  faMagnifyingGlass,
  faMedal,
  faMicrochip,
  faMoon,
  faNetworkWired,
  faNoteSticky,
  faPaperPlane,
  faPenToSquare,
  faPencil,
  faPlay,
  faPlugCircleXmark,
  faPlus,
  faReceipt,
  faRepeat,
  faRightFromBracket,
  faRightToBracket,
  faRobot,
  faRocket,
  faRotateLeft,
  faRotateRight,
  faServer,
  faShareNodes,
  faShield,
  faShieldHalved,
  faSort,
  faSpinner,
  faStar,
  faStopwatch,
  faSun,
  faTableCells,
  faTableCellsLarge,
  faTableColumns,
  faTerminal,
  faThumbtack,
  faTicket,
  faTowerBroadcast,
  faTrash,
  faTriangleExclamation,
  faTrophy,
  faUpload,
  faUser,
  faUserCheck,
  faUserGear,
  faUserPlus,
  faUsers,
  faVideo,
  faWandMagicSparkles,
  faWrench,
  faXmark,
} from "@fortawesome/free-solid-svg-icons"

// FontAwesome injects its stylesheet at runtime by default. That CSS is
// unlayered, so `.svg-inline--fa { height: 1em }` would outrank every Tailwind
// `size-4` on an icon regardless of specificity. The handful of rules actually
// needed live in index.css inside `@layer base` instead, where utilities win.
config.autoAddCss = false

export type IconProps = Omit<React.SVGProps<SVGSVGElement>, "ref"> & {
  /** Lucide's numeric size. Maps to width/height; Tailwind `size-*` still wins. */
  size?: number | string
  /** Accepted and ignored — FontAwesome glyphs have no stroke. */
  strokeWidth?: number | string
  absoluteStrokeWidth?: boolean
}

function icon(definition: IconDefinition, displayName: string) {
  const Icon = React.forwardRef<SVGSVGElement, IconProps>(function Icon(
    { size, strokeWidth: _strokeWidth, absoluteStrokeWidth: _absolute, style, ...props },
    ref
  ) {
    return (
      <FontAwesomeIcon
        icon={definition}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={ref as any}
        style={size === undefined ? style : { width: size, height: size, ...style }}
        {...props}
      />
    )
  })
  Icon.displayName = displayName
  return Icon
}

/** Drop-in for lucide's `LucideIcon` type: anything this module exports. */
export type LucideIcon = ReturnType<typeof icon>

export const Activity = icon(faChartLine, "Activity")
export const ActivityIcon = icon(faChartLine, "ActivityIcon")
export const AlertCircle = icon(faCircleExclamation, "AlertCircle")
export const AlertCircleIcon = icon(faCircleExclamation, "AlertCircleIcon")
export const AlertOctagonIcon = icon(faTriangleExclamation, "AlertOctagonIcon")
export const AlertTriangle = icon(faTriangleExclamation, "AlertTriangle")
export const AlertTriangleIcon = icon(faTriangleExclamation, "AlertTriangleIcon")
export const AlignLeft = icon(faAlignLeft, "AlignLeft")
export const ArrowDown = icon(faArrowDown, "ArrowDown")
export const ArrowDownIcon = icon(faArrowDown, "ArrowDownIcon")
export const ArrowLeft = icon(faArrowLeft, "ArrowLeft")
export const ArrowLeftIcon = icon(faArrowLeft, "ArrowLeftIcon")
export const ArrowRight = icon(faArrowRight, "ArrowRight")
export const ArrowUp = icon(faArrowUp, "ArrowUp")
export const ArrowUpRight = icon(faArrowTrendUp, "ArrowUpRight")
export const Award = icon(faAward, "Award")
export const AwardIcon = icon(faAward, "AwardIcon")
export const BadgeCheckIcon = icon(faCertificate, "BadgeCheckIcon")
export const Ban = icon(faBan, "Ban")
export const BarChart3 = icon(faChartColumn, "BarChart3")
export const BarChart3Icon = icon(faChartColumn, "BarChart3Icon")
export const Bell = icon(faBell, "Bell")
export const BellIcon = icon(faBell, "BellIcon")
export const BetweenHorizontalEnd = icon(faTableColumns, "BetweenHorizontalEnd")
export const BookOpen = icon(faBookOpen, "BookOpen")
export const BookOpenCheck = icon(faBookOpenReader, "BookOpenCheck")
export const BookOpenCheckIcon = icon(faBookOpenReader, "BookOpenCheckIcon")
export const BookOpenIcon = icon(faBookOpen, "BookOpenIcon")
export const Bookmark = icon(faBookmark, "Bookmark")
export const Bot = icon(faRobot, "Bot")
export const BotIcon = icon(faRobot, "BotIcon")
export const Box = icon(faBox, "Box")
export const Brain = icon(faBrain, "Brain")
export const BrainCircuit = icon(faBrain, "BrainCircuit")
export const BrainCircuitIcon = icon(faBrain, "BrainCircuitIcon")
export const Briefcase = icon(faBriefcase, "Briefcase")
export const Building = icon(faBuilding, "Building")
export const Building2 = icon(faCity, "Building2")
export const Building2Icon = icon(faCity, "Building2Icon")
export const CalendarCheck = icon(faCalendarCheck, "CalendarCheck")
export const CalendarDays = icon(faCalendarDays, "CalendarDays")
export const Check = icon(faCheck, "Check")
export const CheckCheck = icon(faCheckDouble, "CheckCheck")
export const CheckCheckIcon = icon(faCheckDouble, "CheckCheckIcon")
export const CheckCircle = icon(faCircleCheck, "CheckCircle")
export const CheckCircle2 = icon(faCircleCheck, "CheckCircle2")
export const CheckCircle2Icon = icon(faCircleCheck, "CheckCircle2Icon")
export const CheckIcon = icon(faCheck, "CheckIcon")
export const ChevronDown = icon(faChevronDown, "ChevronDown")
export const ChevronDownIcon = icon(faChevronDown, "ChevronDownIcon")
export const ChevronLeft = icon(faChevronLeft, "ChevronLeft")
export const ChevronLeftIcon = icon(faChevronLeft, "ChevronLeftIcon")
export const ChevronRight = icon(faChevronRight, "ChevronRight")
export const ChevronRightIcon = icon(faChevronRight, "ChevronRightIcon")
export const ChevronUpIcon = icon(faChevronUp, "ChevronUpIcon")
export const ChevronsLeft = icon(faAnglesLeft, "ChevronsLeft")
export const ChevronsRight = icon(faAnglesRight, "ChevronsRight")
export const ChevronsUpDownIcon = icon(faSort, "ChevronsUpDownIcon")
export const Circle = icon(faCircle, "Circle")
export const CircleAlert = icon(faCircleExclamation, "CircleAlert")
export const CircleAlertIcon = icon(faCircleExclamation, "CircleAlertIcon")
export const CircleCheckIcon = icon(faCircleCheck, "CircleCheckIcon")
export const CircleDashed = icon(faCircleNotch, "CircleDashed")
export const CircleDashedIcon = icon(faCircleNotch, "CircleDashedIcon")
export const CircleDotIcon = icon(faCircleDot, "CircleDotIcon")
export const CircleHelp = icon(faCircleQuestion, "CircleHelp")
export const CircleHelpIcon = icon(faCircleQuestion, "CircleHelpIcon")
export const CirclePlay = icon(faCirclePlay, "CirclePlay")
export const CircleUserRound = icon(faCircleUser, "CircleUserRound")
export const ClipboardCheck = icon(faClipboardCheck, "ClipboardCheck")
export const ClipboardCheckIcon = icon(faClipboardCheck, "ClipboardCheckIcon")
export const ClipboardListIcon = icon(faClipboardList, "ClipboardListIcon")
export const Clock = icon(faClock, "Clock")
export const Clock3 = icon(faClock, "Clock3")
export const ClockIcon = icon(faClock, "ClockIcon")
export const Cloud = icon(faCloud, "Cloud")
export const CloudOffIcon = icon(faPlugCircleXmark, "CloudOffIcon")
export const Code2 = icon(faCode, "Code2")
export const Coins = icon(faCoins, "Coins")
export const Command = icon(faKeyboard, "Command")
export const CompassIcon = icon(faCompass, "CompassIcon")
export const Copy = icon(faCopy, "Copy")
export const Cpu = icon(faMicrochip, "Cpu")
export const CreditCard = icon(faCreditCard, "CreditCard")
export const CreditCardIcon = icon(faCreditCard, "CreditCardIcon")
export const Crown = icon(faCrown, "Crown")
export const CrownIcon = icon(faCrown, "CrownIcon")
export const Database = icon(faDatabase, "Database")
export const DollarSign = icon(faDollarSign, "DollarSign")
export const Download = icon(faDownload, "Download")
export const DownloadIcon = icon(faDownload, "DownloadIcon")
export const Edit = icon(faPenToSquare, "Edit")
export const ExternalLink = icon(faArrowUpRightFromSquare, "ExternalLink")
export const Eye = icon(faEye, "Eye")
export const EyeIcon = icon(faEye, "EyeIcon")
export const EyeOffIcon = icon(faEyeSlash, "EyeOffIcon")
export const FileArchive = icon(faFileZipper, "FileArchive")
export const FileArchiveIcon = icon(faFileZipper, "FileArchiveIcon")
export const FileIcon = icon(faFile, "FileIcon")
export const FilePlay = icon(faFileVideo, "FilePlay")
export const FileQuestion = icon(faFileCircleQuestion, "FileQuestion")
export const FileQuestionIcon = icon(faFileCircleQuestion, "FileQuestionIcon")
export const FileSpreadsheet = icon(faFileExcel, "FileSpreadsheet")
export const FileSpreadsheetIcon = icon(faFileExcel, "FileSpreadsheetIcon")
export const FileText = icon(faFileLines, "FileText")
export const FileTextIcon = icon(faFileLines, "FileTextIcon")
export const Files = icon(faFileLines, "Files")
export const FilesIcon = icon(faFileLines, "FilesIcon")
export const Filter = icon(faFilter, "Filter")
export const Flag = icon(faFlag, "Flag")
export const FlagIcon = icon(faFlag, "FlagIcon")
export const Flame = icon(faFire, "Flame")
export const FlipHorizontal = icon(faArrowRightArrowLeft, "FlipHorizontal")
export const FolderOpen = icon(faFolderOpen, "FolderOpen")
export const FolderOpenIcon = icon(faFolderOpen, "FolderOpenIcon")
export const FolderTree = icon(faFolderTree, "FolderTree")
export const Gauge = icon(faGauge, "Gauge")
export const GaugeIcon = icon(faGauge, "GaugeIcon")
export const Gift = icon(faGift, "Gift")
export const GitBranch = icon(faCodeBranch, "GitBranch")
export const GraduationCap = icon(faGraduationCap, "GraduationCap")
export const GraduationCapIcon = icon(faGraduationCap, "GraduationCapIcon")
export const Grid2X2 = icon(faTableCellsLarge, "Grid2X2")
export const GripHorizontal = icon(faGripLines, "GripHorizontal")
export const Handshake = icon(faHandshake, "Handshake")
export const HandshakeIcon = icon(faHandshake, "HandshakeIcon")
export const Heading = icon(faHeading, "Heading")
export const Headphones = icon(faHeadphones, "Headphones")
export const HeadphonesIcon = icon(faHeadphones, "HeadphonesIcon")
export const Heart = icon(faHeart, "Heart")
export const History = icon(faClockRotateLeft, "History")
export const HistoryIcon = icon(faClockRotateLeft, "HistoryIcon")
export const Home = icon(faHouse, "Home")
export const HomeIcon = icon(faHouse, "HomeIcon")
export const HourglassIcon = icon(faHourglassHalf, "HourglassIcon")
export const Image = icon(faImage, "Image")
export const ImageIcon = icon(faImage, "ImageIcon")
export const ImagePlus = icon(faImages, "ImagePlus")
export const Inbox = icon(faInbox, "Inbox")
export const Info = icon(faCircleInfo, "Info")
export const InfoIcon = icon(faCircleInfo, "InfoIcon")
export const KeyRound = icon(faKey, "KeyRound")
export const Languages = icon(faLanguage, "Languages")
export const Layers = icon(faLayerGroup, "Layers")
export const Layers3 = icon(faLayerGroup, "Layers3")
export const Layers3Icon = icon(faLayerGroup, "Layers3Icon")
export const LayersIcon = icon(faLayerGroup, "LayersIcon")
export const LayoutDashboard = icon(faTableColumns, "LayoutDashboard")
export const LibraryBig = icon(faBookBookmark, "LibraryBig")
export const Link = icon(faLink, "Link")
export const List = icon(faList, "List")
export const ListChecks = icon(faListCheck, "ListChecks")
export const ListCollapse = icon(faListUl, "ListCollapse")
export const ListIcon = icon(faList, "ListIcon")
export const ListOrdered = icon(faListOl, "ListOrdered")
export const Loader2 = icon(faSpinner, "Loader2")
export const Loader2Icon = icon(faSpinner, "Loader2Icon")
export const LoaderCircle = icon(faSpinner, "LoaderCircle")
export const Lock = icon(faLock, "Lock")
export const LockIcon = icon(faLock, "LockIcon")
export const LockKeyhole = icon(faLock, "LockKeyhole")
export const LogIn = icon(faRightToBracket, "LogIn")
export const LogOut = icon(faRightFromBracket, "LogOut")
export const LogOutIcon = icon(faRightFromBracket, "LogOutIcon")
export const Mail = icon(faEnvelope, "Mail")
export const MailIcon = icon(faEnvelope, "MailIcon")
export const MailPlusIcon = icon(faEnvelopeCircleCheck, "MailPlusIcon")
export const Maximize = icon(faExpand, "Maximize")
export const Maximize2Icon = icon(faExpand, "Maximize2Icon")
export const Medal = icon(faMedal, "Medal")
export const MegaphoneIcon = icon(faBullhorn, "MegaphoneIcon")
export const Menu = icon(faBars, "Menu")
export const MessageCircle = icon(faComment, "MessageCircle")
export const MessagesSquareIcon = icon(faComments, "MessagesSquareIcon")
export const Minimize2Icon = icon(faCompress, "Minimize2Icon")
export const MinusCircleIcon = icon(faCircleMinus, "MinusCircleIcon")
export const MoonIcon = icon(faMoon, "MoonIcon")
export const MoreHorizontal = icon(faEllipsis, "MoreHorizontal")
export const MoreHorizontalIcon = icon(faEllipsis, "MoreHorizontalIcon")
export const MoreVertical = icon(faEllipsisVertical, "MoreVertical")
export const Network = icon(faNetworkWired, "Network")
export const NotebookPenIcon = icon(faPenToSquare, "NotebookPenIcon")
export const OctagonXIcon = icon(faCircleXmark, "OctagonXIcon")
export const PanelLeft = icon(faTableColumns, "PanelLeft")
export const PanelLeftIcon = icon(faTableColumns, "PanelLeftIcon")
export const PanelRight = icon(faTableColumns, "PanelRight")
export const PanelsTopLeft = icon(faTableCells, "PanelsTopLeft")
export const Pencil = icon(faPencil, "Pencil")
export const PencilIcon = icon(faPencil, "PencilIcon")
export const PinIcon = icon(faThumbtack, "PinIcon")
export const Play = icon(faPlay, "Play")
export const PlayCircle = icon(faCirclePlay, "PlayCircle")
export const PlayIcon = icon(faPlay, "PlayIcon")
export const Plus = icon(faPlus, "Plus")
export const PlusCircleIcon = icon(faCirclePlus, "PlusCircleIcon")
export const PlusIcon = icon(faPlus, "PlusIcon")
export const Radio = icon(faTowerBroadcast, "Radio")
export const ReceiptText = icon(faReceipt, "ReceiptText")
export const ReceiptTextIcon = icon(faReceipt, "ReceiptTextIcon")
export const RefreshCw = icon(faArrowsRotate, "RefreshCw")
export const RefreshCwIcon = icon(faArrowsRotate, "RefreshCwIcon")
export const Repeat2 = icon(faRepeat, "Repeat2")
export const RocketIcon = icon(faRocket, "RocketIcon")
export const RotateCcw = icon(faRotateLeft, "RotateCcw")
export const RotateCcwIcon = icon(faRotateLeft, "RotateCcwIcon")
export const RotateCw = icon(faRotateRight, "RotateCw")
export const Save = icon(faFloppyDisk, "Save")
export const Search = icon(faMagnifyingGlass, "Search")
export const Send = icon(faPaperPlane, "Send")
export const SendHorizontal = icon(faPaperPlane, "SendHorizontal")
export const SendIcon = icon(faPaperPlane, "SendIcon")
export const Server = icon(faServer, "Server")
export const ServerCog = icon(faServer, "ServerCog")
export const Settings = icon(faGear, "Settings")
export const SettingsIcon = icon(faGear, "SettingsIcon")
export const Share2 = icon(faShareNodes, "Share2")
export const Shield = icon(faShield, "Shield")
export const ShieldAlert = icon(faTriangleExclamation, "ShieldAlert")
export const ShieldCheck = icon(faShieldHalved, "ShieldCheck")
export const ShieldCheckIcon = icon(faShieldHalved, "ShieldCheckIcon")
export const ShieldXIcon = icon(faBan, "ShieldXIcon")
export const SkipForward = icon(faForwardStep, "SkipForward")
export const SkipForwardIcon = icon(faForwardStep, "SkipForwardIcon")
export const Sparkles = icon(faWandMagicSparkles, "Sparkles")
export const SparklesIcon = icon(faWandMagicSparkles, "SparklesIcon")
export const Star = icon(faStar, "Star")
export const StarIcon = icon(faStar, "StarIcon")
export const StickyNote = icon(faNoteSticky, "StickyNote")
export const SunIcon = icon(faSun, "SunIcon")
export const Swords = icon(faKhanda, "Swords")
export const SwordsIcon = icon(faKhanda, "SwordsIcon")
export const Target = icon(faBullseye, "Target")
export const TargetIcon = icon(faBullseye, "TargetIcon")
export const Terminal = icon(faTerminal, "Terminal")
export const TerminalIcon = icon(faTerminal, "TerminalIcon")
export const TicketIcon = icon(faTicket, "TicketIcon")
export const Timer = icon(faStopwatch, "Timer")
export const TimerReset = icon(faClockRotateLeft, "TimerReset")
export const Trash2 = icon(faTrash, "Trash2")
export const Trash2Icon = icon(faTrash, "Trash2Icon")
export const TrashIcon = icon(faTrash, "TrashIcon")
export const TrendingDown = icon(faArrowTrendDown, "TrendingDown")
export const TrendingDownIcon = icon(faArrowTrendDown, "TrendingDownIcon")
export const TrendingUp = icon(faArrowTrendUp, "TrendingUp")
export const TrendingUpIcon = icon(faArrowTrendUp, "TrendingUpIcon")
export const TriangleAlertIcon = icon(faTriangleExclamation, "TriangleAlertIcon")
export const Trophy = icon(faTrophy, "Trophy")
export const Type = icon(faFont, "Type")
export const Upload = icon(faUpload, "Upload")
export const UploadCloud = icon(faCloudArrowUp, "UploadCloud")
export const UploadCloudIcon = icon(faCloudArrowUp, "UploadCloudIcon")
export const UploadIcon = icon(faUpload, "UploadIcon")
export const User = icon(faUser, "User")
export const UserCheck = icon(faUserCheck, "UserCheck")
export const UserCog = icon(faUserGear, "UserCog")
export const UserIcon = icon(faUser, "UserIcon")
export const UserPlus = icon(faUserPlus, "UserPlus")
export const UserPlusIcon = icon(faUserPlus, "UserPlusIcon")
export const UserRound = icon(faUser, "UserRound")
export const Users = icon(faUsers, "Users")
export const Users2 = icon(faUsers, "Users2")
export const UsersIcon = icon(faUsers, "UsersIcon")
export const UsersRound = icon(faUsers, "UsersRound")
export const UsersRoundIcon = icon(faUsers, "UsersRoundIcon")
export const Video = icon(faVideo, "Video")
export const VideoIcon = icon(faVideo, "VideoIcon")
export const WifiOff = icon(faPlugCircleXmark, "WifiOff")
export const Workflow = icon(faDiagramProject, "Workflow")
export const WrenchIcon = icon(faWrench, "WrenchIcon")
export const X = icon(faXmark, "X")
export const XCircle = icon(faCircleXmark, "XCircle")
export const XCircleIcon = icon(faCircleXmark, "XCircleIcon")
export const XIcon = icon(faXmark, "XIcon")
export const Zap = icon(faBolt, "Zap")
