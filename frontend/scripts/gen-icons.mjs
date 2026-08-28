// Generates src/components/icons.tsx: a FontAwesome-backed module exporting the
// icon names the app imports (the same names lucide used, so call sites read
// unchanged).
//
// Run after editing MAP below:
//     node scripts/gen-icons.mjs
//
// `--check` writes nothing and exits 1 if the file on disk is not what this
// script would produce. Worth running in CI: the generated module was hand-
// edited once to fix a type error, and from then on regenerating it silently
// reintroduced the error -- the fix belonged here, in the template.
//
// Every FA name in MAP is checked against the installed package before the file
// is written, so a wrong name fails loudly here instead of rendering an empty
// box in the app. The script derives the icon list from what the source
// actually imports, so unused icons drop out of the bundle on the next run.
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import * as solid from "@fortawesome/free-solid-svg-icons"

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SRC = path.join(FRONTEND, "src")

// --- canonical lucide name -> FontAwesome solid export ----------------------
const MAP = {
  Activity: "faChartLine",
  AlertCircle: "faCircleExclamation",
  AlertOctagon: "faTriangleExclamation",
  AlertTriangle: "faTriangleExclamation",
  AlignLeft: "faAlignLeft",
  ArrowDown: "faArrowDown",
  ArrowLeft: "faArrowLeft",
  ArrowRight: "faArrowRight",
  ArrowUp: "faArrowUp",
  ArrowUpRight: "faArrowTrendUp",
  Award: "faAward",
  BadgeCheck: "faCertificate",
  Ban: "faBan",
  BarChart3: "faChartColumn",
  Bell: "faBell",
  BetweenHorizontalEnd: "faTableColumns",
  Bookmark: "faBookmark",
  BookOpen: "faBookOpen",
  BookOpenCheck: "faBookOpenReader",
  Bot: "faRobot",
  Box: "faBox",
  Brain: "faBrain",
  BrainCircuit: "faBrain",
  Briefcase: "faBriefcase",
  Building: "faBuilding",
  Building2: "faCity",
  CalendarCheck: "faCalendarCheck",
  CalendarDays: "faCalendarDays",
  Check: "faCheck",
  CheckCheck: "faCheckDouble",
  CheckCircle: "faCircleCheck",
  CheckCircle2: "faCircleCheck",
  ChevronDown: "faChevronDown",
  ChevronLeft: "faChevronLeft",
  ChevronRight: "faChevronRight",
  ChevronUp: "faChevronUp",
  ChevronsLeft: "faAnglesLeft",
  ChevronsRight: "faAnglesRight",
  ChevronsUpDown: "faSort",
  Circle: "faCircle",
  CircleAlert: "faCircleExclamation",
  CircleCheck: "faCircleCheck",
  CircleDashed: "faCircleNotch",
  CircleDot: "faCircleDot",
  CircleHelp: "faCircleQuestion",
  CirclePlay: "faCirclePlay",
  CircleUserRound: "faCircleUser",
  ClipboardCheck: "faClipboardCheck",
  ClipboardList: "faClipboardList",
  Clock: "faClock",
  Clock3: "faClock",
  Cloud: "faCloud",
  CloudOff: "faPlugCircleXmark",
  Code2: "faCode",
  Coins: "faCoins",
  Command: "faKeyboard",
  Compass: "faCompass",
  Copy: "faCopy",
  Cpu: "faMicrochip",
  CreditCard: "faCreditCard",
  Crown: "faCrown",
  Database: "faDatabase",
  DollarSign: "faDollarSign",
  Download: "faDownload",
  Edit: "faPenToSquare",
  ExternalLink: "faArrowUpRightFromSquare",
  Eye: "faEye",
  EyeOff: "faEyeSlash",
  File: "faFile",
  FileArchive: "faFileZipper",
  FilePlay: "faFileVideo",
  FileQuestion: "faFileCircleQuestion",
  Files: "faFileLines",
  FileSpreadsheet: "faFileExcel",
  FileText: "faFileLines",
  Filter: "faFilter",
  Flag: "faFlag",
  Flame: "faFire",
  FlipHorizontal: "faArrowRightArrowLeft",
  FolderOpen: "faFolderOpen",
  FolderTree: "faFolderTree",
  Gauge: "faGauge",
  Gift: "faGift",
  GitBranch: "faCodeBranch",
  GraduationCap: "faGraduationCap",
  Grid2X2: "faTableCellsLarge",
  GripHorizontal: "faGripLines",
  Handshake: "faHandshake",
  Heading: "faHeading",
  Headphones: "faHeadphones",
  Heart: "faHeart",
  History: "faClockRotateLeft",
  Home: "faHouse",
  Hourglass: "faHourglassHalf",
  Image: "faImage",
  ImagePlus: "faImages",
  Inbox: "faInbox",
  Info: "faCircleInfo",
  KeyRound: "faKey",
  Languages: "faLanguage",
  Layers: "faLayerGroup",
  Layers3: "faLayerGroup",
  LayoutDashboard: "faTableColumns",
  LibraryBig: "faBookBookmark",
  Link: "faLink",
  List: "faList",
  ListChecks: "faListCheck",
  ListCollapse: "faListUl",
  ListOrdered: "faListOl",
  Loader2: "faSpinner",
  LoaderCircle: "faSpinner",
  Lock: "faLock",
  LockKeyhole: "faLock",
  LogIn: "faRightToBracket",
  LogOut: "faRightFromBracket",
  Mail: "faEnvelope",
  MailPlus: "faEnvelopeCircleCheck",
  Maximize: "faExpand",
  Maximize2: "faExpand",
  Medal: "faMedal",
  Megaphone: "faBullhorn",
  Menu: "faBars",
  MessageCircle: "faComment",
  MessagesSquare: "faComments",
  Minimize2: "faCompress",
  MinusCircle: "faCircleMinus",
  Moon: "faMoon",
  MoreHorizontal: "faEllipsis",
  MoreVertical: "faEllipsisVertical",
  Network: "faNetworkWired",
  NotebookPen: "faPenToSquare",
  OctagonX: "faCircleXmark",
  PanelLeft: "faTableColumns",
  PanelRight: "faTableColumns",
  PanelsTopLeft: "faTableCells",
  Pencil: "faPencil",
  Pin: "faThumbtack",
  Play: "faPlay",
  PlayCircle: "faCirclePlay",
  Plus: "faPlus",
  PlusCircle: "faCirclePlus",
  Radio: "faTowerBroadcast",
  ReceiptText: "faReceipt",
  RefreshCw: "faArrowsRotate",
  Repeat2: "faRepeat",
  Rocket: "faRocket",
  RotateCcw: "faRotateLeft",
  RotateCw: "faRotateRight",
  Save: "faFloppyDisk",
  Search: "faMagnifyingGlass",
  Send: "faPaperPlane",
  SendHorizontal: "faPaperPlane",
  Server: "faServer",
  ServerCog: "faServer",
  Settings: "faGear",
  Share2: "faShareNodes",
  Shield: "faShield",
  // FA free has no shield-exclamation / shield-x, so severity is carried by a
  // different glyph rather than a shield that looks identical to ShieldCheck.
  ShieldAlert: "faTriangleExclamation",
  ShieldCheck: "faShieldHalved",
  ShieldX: "faBan",
  FastForward: "faForwardFast",
  SkipForward: "faForwardStep",
  Sparkles: "faWandMagicSparkles",
  Star: "faStar",
  StickyNote: "faNoteSticky",
  Sun: "faSun",
  Swords: "faKhanda",
  Target: "faBullseye",
  Terminal: "faTerminal",
  Ticket: "faTicket",
  Timer: "faStopwatch",
  TimerReset: "faClockRotateLeft",
  Trash: "faTrash",
  Trash2: "faTrash",
  TrendingDown: "faArrowTrendDown",
  TrendingUp: "faArrowTrendUp",
  TriangleAlert: "faTriangleExclamation",
  Trophy: "faTrophy",
  Type: "faFont",
  Upload: "faUpload",
  UploadCloud: "faCloudArrowUp",
  User: "faUser",
  UserCheck: "faUserCheck",
  UserCog: "faUserGear",
  UserPlus: "faUserPlus",
  UserRound: "faUser",
  Users: "faUsers",
  Users2: "faUsers",
  UsersRound: "faUsers",
  Video: "faVideo",
  WifiOff: "faPlugCircleXmark",
  Workflow: "faDiagramProject",
  Wrench: "faWrench",
  X: "faXmark",
  XCircle: "faCircleXmark",
  Zap: "faBolt",
}

// --- collect the names actually imported from lucide-react ------------------
const files = []
;(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(jsx?|tsx?)$/.test(e.name)) files.push(p)
  }
})(SRC)

// Four stale case-duplicate pages (LandingPage.jsx vs landing-page.jsx) were
// committed in 92a346b still carrying merge-conflict markers. Nothing imports
// them, but their conflicted import blocks are unparseable — skip them here and
// in the codemod rather than silently mangling them.
export const SKIP = new Set(
  [
    "pages/public/LandingPage.jsx",
    "pages/learner/learner-certification-detail-page.jsx",
    "pages/learner/learner-assessment-attempt-page.jsx",
    "pages/admin/Certifications.jsx",
  ].map((p) => path.join(SRC, p.replace(/\//g, path.sep)))
)

const used = new Set()
// Matches both specifiers so the generator keeps working after the codemod has
// repointed every call site at the new module.
const importRe =
  /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["'](?:lucide-react|@\/components\/icons)["']/g
for (const f of files) {
  if (SKIP.has(f) || f.endsWith(path.join("components", "icons.tsx"))) continue
  const text = fs.readFileSync(f, "utf8")
  let m
  while ((m = importRe.exec(text))) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/)[0].trim()
      if (name) used.add(name)
    }
  }
}

// A type, not an icon — re-exported at the foot of the generated module.
used.delete("LucideIcon")

// --- resolve + validate -----------------------------------------------------
const resolved = []
const unresolved = []
const badFa = []

for (const name of [...used].sort()) {
  // lucide ships every icon under both `Foo` and `FooIcon`.
  const base = MAP[name] ? name : name.replace(/Icon$/, "")
  const fa = MAP[base]
  if (!fa) {
    unresolved.push(name)
    continue
  }
  if (!solid[fa] || !solid[fa].iconName) {
    badFa.push(`${name} -> ${fa}`)
    continue
  }
  resolved.push({ name, fa })
}

if (unresolved.length || badFa.length) {
  if (unresolved.length) console.error("NO MAPPING:\n  " + unresolved.join("\n  "))
  if (badFa.length) console.error("NOT IN FA FREE SOLID:\n  " + badFa.join("\n  "))
  process.exit(1)
}

// --- emit -------------------------------------------------------------------
const faImports = [...new Set(resolved.map((r) => r.fa))].sort()

const out = `/* eslint-disable */
// GENERATED — do not edit by hand.
//
// FontAwesome replaces lucide as the icon set. This module keeps the lucide
// export names so call sites read the same, and accepts lucide's props so a
// stray \`strokeWidth\` or \`size\` on an existing call site is not a type error:
// FontAwesome glyphs are filled paths, so stroke props have nothing to act on
// and are dropped.
//
// Regenerate with \`node scripts/gen-icons.mjs\` after changing the mapping there.
import * as React from "react"
import { config, type IconDefinition } from "@fortawesome/fontawesome-svg-core"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
${faImports.map((f) => `  ${f},`).join("\n")}
} from "@fortawesome/free-solid-svg-icons"

// FontAwesome injects its stylesheet at runtime by default. That CSS is
// unlayered, so \`.svg-inline--fa { height: 1em }\` would outrank every Tailwind
// \`size-4\` on an icon regardless of specificity. The handful of rules actually
// needed live in index.css inside \`@layer base\` instead, where utilities win.
config.autoAddCss = false

export type IconProps = Omit<React.SVGProps<SVGSVGElement>, "ref"> & {
  /** Lucide's numeric size. Maps to width/height; Tailwind \`size-*\` still wins. */
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
        // FontAwesome types \`style\` as \`CSSProperties & CSSVariables\`, whose
        // index signature (\`--fa-font-\${string}\`) React's plain
        // \`CSSProperties\` does not satisfy, and its props as its own SVG prop
        // set, where \`mask\` and friends mean something else. Both are cast
        // rather than modelled: this module's job is to accept lucide's props
        // at the call sites, not to re-describe FontAwesome's.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style={size === undefined ? (style as any) : ({ width: size, height: size, ...(style as any) } as any)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...(props as any)}
      />
    )
  })
  Icon.displayName = displayName
  return Icon
}

/** Drop-in for lucide's \`LucideIcon\` type: anything this module exports. */
export type LucideIcon = ReturnType<typeof icon>

${resolved.map((r) => `export const ${r.name} = icon(${r.fa}, "${r.name}")`).join("\n")}
`

const target = path.join(SRC, "components", "icons.tsx")

if (process.argv.includes("--check")) {
  const LF = String.fromCharCode(10)
  const CRLF = String.fromCharCode(13) + LF
  // Line endings are git's business (the working copy is CRLF on Windows),
  // so compare the content rather than the bytes.
  const onDisk = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : ""
  if (onDisk.split(CRLF).join(LF) !== out) {
    console.error(
      "DRIFT  src/components/icons.tsx is not what gen-icons.mjs produces." +
        LF +
        "       Put the change in scripts/gen-icons.mjs, then run `npm run icons`."
    )
    process.exit(1)
  }
  console.log(`OK  icons.tsx matches the generator (${resolved.length} icons)`)
  process.exit(0)
}

fs.writeFileSync(target, out, "utf8")
console.log(`OK  ${resolved.length} icons -> ${faImports.length} FontAwesome glyphs`)
