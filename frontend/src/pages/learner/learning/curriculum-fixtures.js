/**
 * Local mock curriculum for the two design-preview surfaces
 * (`learner-curriculum-page` and `learner-study-page`).
 *
 * Shaped like the real curriculum tree — major category → middle category →
 * lesson → section — plus the assessments that hang off each level, so the
 * layout is exercised against realistic depth rather than three tidy rows.
 * No API is called: these pages exist to review the design.
 */

import { BookOpen, Code2, Cpu, Database, Network, Shield } from "@/components/icons"

/** Sections of a lesson. `intro` is the welcome + objectives block every
 *  lesson opens with; the sections after it are the body. */
function lesson(id, name, minutes, completed, objectives, sections) {
  return { id, name, minutes, completed, objectives, sections, kind: "lesson" }
}

const STORAGE_LESSONS = [
  lesson(
    "l-1",
    "Introduction to Storage",
    8,
    true,
    [
      "Describe the three storage families and when each is used.",
      "Recognise the trade-off between durability, latency, and cost.",
    ],
    [
      {
        id: "s-1",
        name: "Why storage type matters",
        body: [
          "Every workload writes data somewhere, but where it writes changes what it can promise. A queue that loses a message on restart is a different product from one that does not, and the difference is usually the storage underneath it.",
          "In this section you will look at the three families — block, object, and file — and the single question that separates them: what does the application think it is talking to?",
        ],
      },
      {
        id: "s-2",
        name: "Block, object, and file",
        body: [
          "Block storage hands the application a raw device and lets the filesystem on top decide what a file means. Object storage hands it an API and a flat namespace of keys. File storage hands it a shared mount that several machines can open at once.",
          "The families are not ranked. A database wants block, a media library wants object, and a render farm wants file — picking the wrong one shows up as cost, not as failure, which is what makes it hard to spot later.",
        ],
      },
      {
        id: "s-3",
        name: "Durability and the cost curve",
        body: [
          "Durability is bought, not given. Each additional copy of your data is another copy you pay for, and the storage classes you will meet later are mostly different points on that same curve.",
        ],
      },
    ],
  ),
  lesson(
    "l-2",
    "Instance Store and Block Store",
    14,
    true,
    [
      "Describe instance store, including its benefits and use cases.",
      "Describe block store volumes, including their benefits and use cases.",
    ],
    [
      {
        id: "s-4",
        name: "Instance store",
        body: [
          "An instance store is not a stand-alone service. It refers to block-level storage physically attached to the host computer the instance runs on, which is exactly why it is fast and exactly why it is temporary.",
          "Because the data lives on the host, stopping or terminating the instance deletes it. That makes instance store right for buffers, caches, and scratch data, and wrong for anything you expect to still be there tomorrow.",
        ],
      },
      {
        id: "s-5",
        name: "Key takeaway: no data persistence",
        body: [
          "If you stop or terminate an instance, all data written to the attached instance store is deleted. There is no recovery step, because there is nothing left to recover from.",
        ],
      },
      {
        id: "s-6",
        name: "Block store volumes",
        body: [
          "Block store volumes provide persistent block-level storage for use with an instance. They behave like external hard drives: consistent, low-latency, and independent of the instance's own life.",
          "A volume exists whether or not anything is attached to it. Detach it from one instance, attach it to another, and the data goes with it — which is the whole point.",
        ],
      },
      {
        id: "s-7",
        name: "Choosing between them",
        body: [
          "Ask one question: would losing this data on a restart be a bug? If yes, it belongs on a volume. If no, the instance store is faster and already paid for.",
        ],
      },
    ],
  ),
  lesson(
    "l-3",
    "Block Store Data Lifecycle",
    11,
    false,
    [
      "Explain how snapshots capture a volume's state.",
      "Plan a retention policy that balances recovery and cost.",
    ],
    [
      {
        id: "s-8",
        name: "Snapshots",
        body: [
          "A snapshot is a point-in-time copy of a volume, stored separately from the volume itself. The first snapshot copies everything; each one after it copies only the blocks that changed.",
          "That incremental behaviour is why snapshot cost grows with write volume rather than with disk size — a mostly-idle terabyte is cheap to protect.",
        ],
      },
      {
        id: "s-9",
        name: "Retention and lifecycle policies",
        body: [
          "Retention is a business decision wearing a technical costume. Decide how far back you must be able to restore, then let a lifecycle policy delete everything older, automatically, rather than by memory.",
        ],
      },
    ],
  ),
]

const OBJECT_LESSONS = [
  lesson(
    "l-4",
    "Object Storage Fundamentals",
    12,
    false,
    [
      "Describe buckets, keys, and the flat namespace.",
      "Explain why object storage scales the way it does.",
    ],
    [
      {
        id: "s-10",
        name: "Buckets and keys",
        body: [
          "Object storage has no directories. What looks like a folder is a prefix on a key — a naming convention the console renders as a tree because people read trees more easily than they read flat lists.",
          "This matters the moment you list a few million objects: a prefix is a filter, not a location.",
        ],
      },
      {
        id: "s-11",
        name: "Consistency and versioning",
        body: [
          "Versioning keeps every write rather than overwriting, which turns an accidental delete from an incident into an undo. It also means you now pay for every version, so it pairs with a lifecycle rule rather than standing alone.",
        ],
      },
    ],
  ),
  lesson(
    "l-5",
    "Storage Classes and Lifecycle",
    16,
    false,
    [
      "Match an access pattern to the right storage class.",
      "Write a lifecycle rule that transitions objects over time.",
    ],
    [
      {
        id: "s-12",
        name: "The access-frequency ladder",
        body: [
          "Storage classes are the durability-versus-cost curve made concrete. Standard is priced for data read often; infrequent-access is cheaper to keep and dearer to read; archive tiers are cheaper still and add a retrieval delay measured in minutes or hours.",
          "Every class stores your data just as safely. What changes is how much you pay to keep it, and how much you pay — in money and in waiting — to get it back.",
        ],
      },
      {
        id: "s-13",
        name: "Writing a lifecycle rule",
        body: [
          "A lifecycle rule is a sentence: after N days, move objects matching this prefix to that class; after M days, delete them. The skill is not the syntax, it is knowing your own access pattern well enough to pick N and M.",
        ],
      },
    ],
  ),
]

const NETWORK_LESSONS = [
  lesson(
    "l-6",
    "File Storage and Shared Access",
    10,
    false,
    ["Describe shared file systems and their use cases."],
    [
      {
        id: "s-14",
        name: "When several machines need one filesystem",
        body: [
          "A shared file system is the answer to a specific question: can more than one machine mount this at the same time and see each other's writes? Block volumes generally cannot; file storage is built for exactly that.",
        ],
      },
    ],
  ),
  lesson(
    "l-7",
    "Hybrid and Gateway Patterns",
    9,
    false,
    ["Explain how on-premises systems reach cloud storage through a gateway."],
    [
      {
        id: "s-15",
        name: "The gateway pattern",
        body: [
          "A storage gateway sits on-premises and presents a familiar protocol locally while writing through to cloud storage. It buys migration time: the application keeps its interface, the data moves anyway.",
        ],
      },
    ],
  ),
]

/**
 * `quiz` follows each lesson; `assessment` closes each middle category. Both
 * carry their own icon so the outline never relies on indentation alone to say
 * what kind of thing a row is.
 */
function quiz(id, name, questions) {
  return { id, name, questions, kind: "quiz" }
}

function assessment(id, name, questions, passMark = 80) {
  return { id, name, questions, passMark, kind: "assessment" }
}

const MIDDLE_CATEGORIES = {
  storage: {
    id: "m-1",
    name: "Block Storage",
    summary:
      "Instance store versus persistent volumes, and the lifecycle that keeps volume data recoverable.",
    lessons: STORAGE_LESSONS,
    quizzes: {
      "l-1": quiz("q-1", "Introduction to Storage — quick check", 3),
      "l-2": quiz("q-2", "Instance Store and Block Store — quick check", 5),
      "l-3": quiz("q-3", "Data Lifecycle — quick check", 4),
    },
    assessment: assessment("a-1", "Block Storage Assessment", 15),
  },
  object: {
    id: "m-2",
    name: "Object Storage",
    summary:
      "Buckets, keys, versioning, and the storage-class ladder that decides what your data costs to keep.",
    lessons: OBJECT_LESSONS,
    quizzes: {
      "l-4": quiz("q-4", "Object Storage Fundamentals — quick check", 4),
      "l-5": quiz("q-5", "Storage Classes — quick check", 6),
    },
    assessment: assessment("a-2", "Object Storage Assessment", 18),
  },
  file: {
    id: "m-3",
    name: "File and Hybrid Storage",
    summary: "Shared file systems, and the gateway patterns that bridge on-premises workloads.",
    lessons: NETWORK_LESSONS,
    quizzes: {
      "l-6": quiz("q-6", "File Storage — quick check", 3),
      "l-7": quiz("q-7", "Hybrid Patterns — quick check", 3),
    },
    assessment: assessment("a-3", "File and Hybrid Assessment", 12),
  },
}

/** Majors carry the tone, so a unit is the same colour on the curriculum card
 *  as it is in the study outline. */
export const CURRICULUM = {
  certification: {
    id: "cert-1",
    title: "Cloud Practitioner",
    wordmark: "cloud",
    summary:
      "Foundational cloud certification — services, security, pricing, and the architecture principles behind them.",
    lessons: 96,
    questions: "1,240",
  },
  majors: [
    {
      id: "maj-1",
      index: 1,
      name: "Cloud Foundations",
      tone: "macaw",
      icon: Cpu,
      wordmark: "unit 01",
      summary:
        "What the cloud actually is, the deployment models, and the vocabulary the rest of the certification assumes you already have.",
      middles: [
        {
          id: "m-0a",
          name: "Cloud Concepts",
          summary: "Deployment models, the shared responsibility line, and the six pillars.",
          lessons: [
            lesson("l-0", "What Is Cloud Computing", 7, true, ["Define cloud computing in one sentence."], [
              {
                id: "s-0",
                name: "On demand, over a network",
                body: [
                  "Cloud computing is the on-demand delivery of compute, storage, and other resources over a network, paid for as you use them. Every service you meet later is a variation on that one sentence.",
                ],
              },
            ]),
          ],
          quizzes: { "l-0": quiz("q-0", "Cloud Concepts — quick check", 3) },
          assessment: assessment("a-0", "Cloud Concepts Assessment", 10),
        },
      ],
    },
    {
      id: "maj-2",
      index: 2,
      name: "Storage",
      tone: "bee",
      icon: Database,
      wordmark: "unit 02",
      summary:
        "Block, object, and file storage — how each is priced, what each guarantees, and how to move data between them as it ages.",
      middles: [MIDDLE_CATEGORIES.storage, MIDDLE_CATEGORIES.object, MIDDLE_CATEGORIES.file],
    },
    {
      id: "maj-3",
      index: 3,
      name: "Networking",
      tone: "beetle",
      icon: Network,
      wordmark: "unit 03",
      summary:
        "Virtual networks, subnets, routing, and the controls that decide what can reach what.",
      middles: [
        {
          id: "m-4",
          name: "Network Fundamentals",
          summary: "Virtual networks, subnets, and route tables.",
          lessons: [
            lesson("l-8", "Virtual Networks and Subnets", 13, false, ["Describe subnetting in a virtual network."], [
              {
                id: "s-16",
                name: "Carving a network up",
                body: [
                  "A subnet is a slice of a virtual network's address range, pinned to one availability zone. Public and private are not properties of the subnet itself — they describe whether its route table has a path to the internet.",
                ],
              },
            ]),
          ],
          quizzes: { "l-8": quiz("q-8", "Network Fundamentals — quick check", 4) },
          assessment: assessment("a-4", "Networking Assessment", 16),
        },
      ],
    },
    {
      id: "maj-4",
      index: 4,
      name: "Security and Identity",
      tone: "cardinal",
      icon: Shield,
      wordmark: "unit 04",
      summary:
        "Identity, permissions, encryption at rest and in transit, and where the shared responsibility line actually falls.",
      middles: [
        {
          id: "m-5",
          name: "Identity and Access",
          summary: "Users, roles, policies, and least privilege in practice.",
          lessons: [
            lesson("l-9", "Identity and Permissions", 15, false, ["Apply least privilege to a policy."], [
              {
                id: "s-17",
                name: "Least privilege",
                body: [
                  "Least privilege is easy to state and hard to keep: grant only the permissions a principal needs, and remove them when the need ends. The second half is the part that decays.",
                ],
              },
            ]),
          ],
          quizzes: { "l-9": quiz("q-9", "Identity and Access — quick check", 5) },
          assessment: assessment("a-5", "Security Assessment", 20),
        },
      ],
    },
  ],
  /** The final major has no lessons — it is the mock exam on its own. */
  mockExam: {
    id: "maj-final",
    name: "Mock Exam",
    tone: "fox",
    wordmark: "final",
    summary:
      "One full-length attempt under exam conditions, drawn from every unit above. Sat once you have cleared the unit assessments.",
    questions: 65,
    minutes: 90,
    passMark: 80,
  },
}

/** Convenience: the middle category the study preview opens on. */
export const DEFAULT_MIDDLE = MIDDLE_CATEGORIES.storage
export const DEFAULT_MAJOR = CURRICULUM.majors[1]

export const CURRICULUM_ICONS = { BookOpen, Code2 }

/** Sample items for the "test your skills" quiz and the module assessment. */
export const SAMPLE_QUIZ = {
  eyebrow: "Test your skills",
  prompt:
    "AnyCompany Business stores a growing amount of customer data in object storage. Their manager is concerned about storage costs and asks IT to implement a solution to move older data to cheaper storage. The data is frequently accessed for the first 30 days, occasionally accessed for the next 60 days, and rarely accessed after 90 days.\n\nWhat should they do in this situation to optimize costs while maintaining appropriate access to the data?",
  options: [
    "Create a lifecycle rule to transition objects to infrequent-access storage after 30 days, then to archive storage after 90 days.",
    "Copy every object to archive storage immediately and restore each one on demand.",
    "Keep everything in standard storage and reduce the number of objects retained.",
    "Move all objects to instance store so they are held on the host and cost nothing to keep.",
  ],
  answerIndex: 0,
  explanation:
    "The access pattern has three distinct phases, which is exactly the shape a lifecycle rule expresses: transition on age, then transition again, then optionally expire. Moving everything to archive up front would meet the cost goal and break the first 30 days of access.",
}
