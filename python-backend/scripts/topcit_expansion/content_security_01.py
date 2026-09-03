"""Understanding of Security -> Information Security Fundamentals (MID 123).

Rebuilt to the format the system's own lessons use: roughly 4,900 words over
28-40 sections, about 46 blocks, diagrams where a picture does the explaining,
most sections carrying more than one block, and no coloured card grids.

Written against TOPCIT ESSENCE Understanding of Security (Technical Field
03-2, Ver.2), sections "01 Outline of Cryptography" and "02 Hash function".
"""

from builders import (accordion, desc, descriptive, image, lesson_structure,
                      mcq, ol, short_answer, sub, tabs, ul)

MID_SEC_FUNDAMENTALS = 123

SYMMETRIC_DIAGRAM = "/lesson-media/symmetric-encryption.svg"
ASYMMETRIC_DIAGRAM = "/lesson-media/asymmetric-encryption.svg"
HASH_DIAGRAM = "/lesson-media/hash-function.svg"
# ===========================================================================
# Cryptography Fundamentals: Symmetric and Asymmetric Encryption
# ===========================================================================

_crypto_sections = [
    ("What Cryptography Is Actually For", [
        desc(
            "Cryptography is usually introduced as 'making messages secret', "
            "which undersells it badly and causes real design errors "
            "downstream. Secrecy is one of four properties it provides, and in "
            "modern systems it is frequently not the most important of them."
        ),
        desc(
            "Consider a payment instruction. One that everyone can read but "
            "nobody can alter or later deny sending is far more useful to a "
            "bank than one that is secret but forgeable. Most of the "
            "cryptography deployed on the internet today is doing "
            "authentication and integrity work rather than hiding anything."
        ),
    ]),

    ("Four Properties, Four Mechanisms", [
        desc(
            "Naming the four separately is worth the effort, because a great "
            "many security design failures come from assuming that one "
            "mechanism delivers all of them. Encryption in particular is "
            "routinely expected to provide integrity, which it does not."
        ),
        sub("Confidentiality"),
        desc(
            "Only the intended recipient can read the message. Provided by "
            "encryption, whether symmetric or asymmetric. This is the property "
            "everyone thinks of first and it is genuinely only one quarter of "
            "the subject."
        ),
        sub("Integrity"),
        desc(
            "The message has not been altered in transit. Provided by hash "
            "functions and message authentication codes -- NOT by encryption. "
            "Ciphertext can be modified, and the recipient will decrypt "
            "whatever arrives."
        ),
        sub("Authentication"),
        desc(
            "The message genuinely came from who it claims. Provided by a MAC "
            "using a shared key, or by a digital signature using a private "
            "key. The two differ in an important way covered later."
        ),
        sub("Non-repudiation"),
        desc(
            "The sender cannot later deny having sent it. Provided ONLY by "
            "digital signatures. A shared-key MAC cannot deliver this, because "
            "either party holding the key could have produced it, so neither "
            "can prove anything to a third party."
        ),
    ]),

    ("The Vocabulary", [
        desc(
            "A small set of terms recurs throughout the whole security module, "
            "and using them precisely saves confusion later."
        ),
        ul([
            "Plaintext: the original readable message, before any "
            "transformation",
            "Ciphertext: the transformed, unreadable message",
            "Encryption: plaintext to ciphertext; decryption is the reverse",
            "Key: the secret parameter making the transformation specific to "
            "its holder",
            "Cipher: the algorithm itself, which is public and published",
            "Cryptanalysis: the study of breaking ciphers, as distinct from "
            "cryptography, which is the study of building them",
        ]),
    ]),

    ("Kerckhoffs's Principle", [
        desc(
            "A cryptosystem must remain secure even if everything about it "
            "except the key is public knowledge. This is not academic modesty "
            "but a practical engineering constraint, and it has held for over "
            "a century."
        ),
        desc(
            "The reasoning is straightforward. An algorithm's secrecy cannot "
            "be maintained: it is compiled into software that can be "
            "disassembled, or into hardware that can be examined. A key, by "
            "contrast, can be changed the moment it is suspected, and changing "
            "it costs nothing. Security must therefore rest on the thing that "
            "can be replaced, not on the thing that cannot."
        ),
    ]),

    ("Why Home-Grown Ciphers Fail", [
        desc(
            "The practical consequence of Kerckhoffs's principle is that a "
            "secret, proprietary cipher is treated as broken by default -- not "
            "because secrecy makes it weak, but because secrecy means it has "
            "had no public scrutiny."
        ),
        desc(
            "Published algorithms such as AES have been attacked continuously "
            "by thousands of researchers for decades without falling. That "
            "accumulated failure to break it is the only evidence of strength "
            "anyone has, and an unpublished algorithm has none of it. "
            "'Nobody has broken our cipher' means nothing if nobody has tried."
        ),
    ]),

    ("Symmetric Encryption", [
        desc(
            "In symmetric cryptography the same key encrypts and decrypts. It "
            "is fast -- typically hundreds of times faster than asymmetric "
            "cryptography for the same volume of data -- and it is what "
            "actually protects the bulk of data in every real system."
        ),
        image(SYMMETRIC_DIAGRAM),
    ]),

    ("The Key Distribution Problem", [
        desc(
            "Symmetric encryption's difficulty is entirely one of logistics. "
            "Both parties must already share the key, and getting it to them "
            "securely is the whole problem -- you cannot send the key over the "
            "channel you are trying to protect, because anyone who could read "
            "the message could read the key."
        ),
        desc(
            "The problem also scales badly. For n parties who must all "
            "communicate privately in pairs, the number of keys required is "
            "n(n-1)/2. Ten people need 45 keys. A hundred need 4,950. A "
            "thousand need almost half a million, each of which must be "
            "distributed securely and stored safely. This arithmetic is "
            "exactly what made asymmetric cryptography necessary rather than "
            "merely interesting."
        ),
    ]),

    ("Symmetric Algorithms Worth Knowing", [
        desc(
            "Four names recur, and the useful thing to carry is not the "
            "internal design of each but where it sits in the sequence: what "
            "replaced what, and why."
        ),
        accordion([
            ("DES",
             "Data Encryption Standard, 1977. A 64-bit block cipher with an "
             "effective 56-bit key, which was adequate then and is trivially "
             "brute-forced now -- a purpose-built machine broke it in under a "
             "day in 1998. Its historical importance is that it established "
             "the modern block cipher design and demonstrated that key length "
             "is a moving target rather than a fixed choice."),
            ("3DES",
             "Applies DES three times with two or three keys, raising the "
             "effective strength while allowing existing DES hardware to be "
             "reused. Slow, since it performs three passes over every block, "
             "and now deprecated in favour of AES."),
            ("AES",
             "Advanced Encryption Standard, selected in 2001 from the Rijndael "
             "cipher after an open international competition -- a process "
             "notable in itself, since it built the public confidence "
             "Kerckhoffs's principle requires. A 128-bit block cipher with "
             "128, 192 or 256-bit keys. Modern processors implement it in "
             "hardware, making it extremely fast."),
            ("SEED and ARIA",
             "Korean national block cipher standards, both 128-bit block "
             "ciphers. TOPCIT asks about them because they are mandated in "
             "Korean public sector and financial systems, so a candidate "
             "working in that environment will meet them."),
        ]),
    ]),

    ("Block and Stream Ciphers", [
        desc(
            "A block cipher transforms fixed-size blocks -- 128 bits for AES "
            "-- and therefore needs a mode of operation to handle any message "
            "longer than one block, which is nearly all of them."
        ),
        desc(
            "A stream cipher instead generates a keystream and combines it "
            "with the plaintext bit by bit or byte by byte. This suits data of "
            "unpredictable length arriving continuously, such as a live audio "
            "channel, where waiting to fill a block would add latency."
        ),
    ]),

    ("Why the Mode of Operation Matters", [
        desc(
            "Encrypting each block independently is called Electronic Code "
            "Book mode, and it is the classic worked example of a correct "
            "cipher used incorrectly. Identical plaintext blocks produce "
            "identical ciphertext blocks, so any structure in the data "
            "survives encryption intact."
        ),
        desc(
            "The famous demonstration is an image encrypted in ECB mode, in "
            "which the original picture remains plainly visible -- the "
            "colours change but every outline is preserved, because repeated "
            "regions encrypt repeatedly. The cipher is doing exactly what it "
            "promised; the mode is leaking everything."
        ),
    ]),

    ("CBC, CTR and GCM", [
        desc(
            "Cipher Block Chaining fixes ECB's leak by combining each block "
            "with the previous ciphertext before encrypting, so identical "
            "plaintext blocks encrypt differently depending on what preceded "
            "them. It requires an initialisation vector for the first block, "
            "and that IV must be unpredictable."
        ),
        desc(
            "Counter mode turns a block cipher into a stream cipher by "
            "encrypting an incrementing counter and combining the result with "
            "the plaintext, which has the practical advantage of being "
            "parallelisable. Galois/Counter Mode goes further and produces an "
            "authentication tag alongside the ciphertext, providing "
            "confidentiality and integrity in one operation -- which is why it "
            "is the mode most modern protocols choose."
        ),
    ]),

    ("Asymmetric Encryption", [
        desc(
            "Asymmetric, or public key, cryptography uses a mathematically "
            "related key pair. What one key encrypts, only the other can "
            "decrypt. The public key is published freely to anyone who wants "
            "it; the private key never leaves its owner."
        ),
        image(ASYMMETRIC_DIAGRAM),
    ]),

    ("Why the Key Pair Solves Distribution", [
        desc(
            "The single idea of a published key solves the key distribution "
            "problem outright, because a public key can be sent over an "
            "insecure channel, printed in a newspaper or posted on a website "
            "without harming anything."
        ),
        desc(
            "It also collapses the key count. Instead of n(n-1)/2 shared "
            "secrets, n parties need n key pairs -- one each. A thousand "
            "people need a thousand key pairs rather than half a million "
            "shared keys, and none of the thousand needs a prior relationship "
            "with any of the others."
        ),
    ]),

    ("Which Key for Which Purpose", [
        desc(
            "This is the point that separates people who understand public key "
            "cryptography from people who have memorised it, and exams test it "
            "directly and repeatedly. The direction you encrypt in determines "
            "what property you obtain."
        ),
        tabs([
            ("Confidentiality", "Encrypt with the recipient's PUBLIC key",
             "Only the recipient's private key can decrypt the result, and "
             "only the recipient holds that key. Anyone at all can therefore "
             "send a confidential message to the recipient, which is exactly "
             "the property wanted. Note carefully that it says nothing "
             "whatever about who the sender was -- anyone could have used that "
             "public key."),
            ("Authentication", "Encrypt with the sender's PRIVATE key",
             "Anyone holding the sender's public key can decrypt it, so the "
             "message is not secret at all. But the fact that it decrypts "
             "correctly with that public key proves it was produced with the "
             "matching private key, which only the sender holds. This is the "
             "basis of the digital signature."),
            ("Both", "Sign with your private key, then encrypt with theirs",
             "Combining the two operations gives a message that only the "
             "recipient can read AND that provably came from the sender. This "
             "layering is what real protocols do, and the order matters -- "
             "sign first, then encrypt, so that the signature is itself "
             "protected."),
        ]),
    ]),

    ("Asymmetric Algorithms", [
        desc(
            "Unlike the symmetric list, these are not interchangeable. Two of "
            "them encrypt, one only agrees a key, and one only signs -- so a "
            "question about which algorithm suits a task is really a question "
            "about which of those jobs is being done."
        ),
        accordion([
            ("RSA",
             "Rests on the difficulty of factoring the product of two large "
             "primes. The best known and most widely deployed public key "
             "algorithm, usable for both encryption and signatures. Typical "
             "key sizes are 2048 or 4096 bits, which is why it is slow -- the "
             "arithmetic is on numbers of that size."),
            ("Diffie-Hellman",
             "A key AGREEMENT algorithm rather than an encryption algorithm. "
             "Two parties who have never met derive a shared secret over a "
             "public channel, with an eavesdropper who saw every message "
             "unable to compute it. It does not encrypt messages and it does "
             "not authenticate anybody, which is why it must be combined with "
             "signatures to resist a man-in-the-middle."),
            ("ECC",
             "Elliptic Curve Cryptography. Achieves equivalent strength with "
             "far shorter keys -- a 256-bit elliptic curve key is roughly "
             "comparable to a 3072-bit RSA key -- which matters enormously on "
             "constrained devices, smart cards and mobile networks where every "
             "byte and every millisecond counts."),
            ("DSA and ECDSA",
             "Signature algorithms specifically. Unlike RSA they cannot be "
             "used to encrypt at all, only to sign and verify. An exam option "
             "proposing DSA for confidentiality is wrong on its face."),
        ]),
    ]),

    ("Why Real Systems Use Both", [
        desc(
            "Asymmetric cryptography is slow. Encrypting a gigabyte file with "
            "RSA directly would take an impractical amount of time, and no "
            "system does it."
        ),
        desc(
            "Real protocols therefore use a hybrid arrangement: asymmetric "
            "cryptography establishes a shared symmetric key, and the fast "
            "symmetric cipher then protects the actual data. This gives the "
            "key distribution advantage of public key cryptography with the "
            "performance of symmetric cryptography, and it is the pattern "
            "behind essentially every secure protocol in use."
        ),
    ]),

    ("How a Hybrid Exchange Works", [
        ol([
            "The client obtains the server's public key, usually from its "
            "certificate, and verifies that the certificate is genuine",
            "A symmetric session key is agreed -- either encrypted with the "
            "server's public key and sent, or derived independently by both "
            "sides using Diffie-Hellman",
            "Everything after that point is encrypted with the fast symmetric "
            "cipher using that session key",
            "The session key is discarded when the session ends, so it exists "
            "only for the duration of the conversation",
        ]),
    ]),

    ("Perfect Forward Secrecy", [
        desc(
            "If a session key is simply encrypted with the server's public key "
            "and transmitted, then anyone who later obtains that private key "
            "-- by compromise, by legal compulsion, or when the key is "
            "eventually retired carelessly -- can decrypt every recorded past "
            "session. An attacker who has been patiently recording traffic for "
            "years suddenly has all of it."
        ),
        desc(
            "Ephemeral Diffie-Hellman avoids this by generating a fresh key "
            "pair for every session and discarding it afterwards, so there is "
            "no long-term key whose loss unlocks the archive. Each session's "
            "secret dies with the session. This property is called perfect "
            "forward secrecy, and it is why modern TLS configurations prefer "
            "ephemeral key exchange over RSA key transport."
        ),
    ]),

    ("Key Length and What It Does Not Mean", [
        desc(
            "Key lengths are not comparable across algorithm families, and "
            "assuming they are is a common and confident error. A 128-bit AES "
            "key, a 3072-bit RSA key and a 256-bit elliptic curve key offer "
            "broadly similar security."
        ),
        desc(
            "A candidate who concludes that RSA is stronger because its number "
            "is larger has misunderstood what the number counts: for a "
            "symmetric cipher it is the size of the search space directly, "
            "while for RSA it is the size of a modulus whose factorisation is "
            "very much easier than an exhaustive search. Within a family, "
            "longer is stronger; across families, only the estimated work "
            "factor is comparable at all."
        ),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Believing encryption provides integrity",
             "It does not. Ciphertext can be altered, and the result decrypts "
             "to something -- garbage in most modes, but in a stream or "
             "counter mode an attacker can flip specific plaintext bits by "
             "flipping the corresponding ciphertext bits. Integrity requires a "
             "MAC or an authenticated encryption mode such as GCM."),
            ("Encrypting with your own public key to send a secret",
             "Then only you can read it, which is not usually the intention. "
             "Confidentiality requires the RECIPIENT's public key. This is the "
             "single most common error in the topic and it appears in exams "
             "every time."),
            ("Using ECB mode",
             "Identical plaintext blocks produce identical ciphertext blocks, "
             "so patterns in the data survive encryption. Use CBC, CTR or "
             "preferably GCM, which adds integrity as well."),
            ("Comparing key lengths across algorithms",
             "2048-bit RSA is not sixteen times stronger than 128-bit AES. The "
             "numbers count different things entirely."),
            ("Thinking Diffie-Hellman encrypts or authenticates",
             "It does neither. It agrees a shared secret, and without an "
             "accompanying signature an attacker in the middle can run a "
             "separate exchange with each party and relay everything."),
            ("Inventing your own cipher",
             "Kerckhoffs's principle says security must rest on the key rather "
             "than on the algorithm's obscurity, and an unreviewed algorithm "
             "has no evidence of strength whatsoever."),
        ]),
    ]),

    ("Practical Example: Reading a TLS Handshake", [
        desc(
            "A browser connects to a bank. The server presents a certificate "
            "containing its public key together with a signature from a "
            "certificate authority. The browser verifies that signature using "
            "the authority's public key, which it already holds in its trust "
            "store, establishing that the public key really does belong to the "
            "bank."
        ),
        desc(
            "Everything else in the handshake follows from that one "
            "verification. Without it, an attacker could substitute their own "
            "public key and the rest of the exchange would proceed perfectly "
            "-- with the attacker."
        ),
    ]),

    ("What Each Step Provides", [
        ol([
            "Certificate verification gives authentication of the server: you "
            "are talking to the bank rather than an impostor",
            "An ephemeral Diffie-Hellman exchange, signed by the server's "
            "private key, establishes a shared secret with forward secrecy -- "
            "the signature is what stops a man in the middle",
            "A symmetric key is derived from that shared secret and used with "
            "AES-GCM for the remainder of the session",
            "GCM provides confidentiality and integrity together, so an "
            "attacker can neither read the traffic nor alter it undetectably",
        ]),
        desc(
            "Notice that asymmetric cryptography is used only for "
            "authentication and key agreement, while every byte of actual page "
            "content is protected symmetrically. That division of labour is "
            "the single most useful thing to carry away from this lesson."
        ),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "The four properties and which mechanism provides each, especially "
            "non-repudiation",
            "Which key to use for confidentiality versus authentication -- "
            "asked in almost every paper",
            "The n(n-1)/2 key count, usually as a calculation",
            "Symmetric versus asymmetric on speed, key distribution and "
            "typical algorithms",
            "Why real protocols are hybrid",
            "ECB's weakness, and which modes fix it",
            "Forward secrecy, usually as a scenario about a later key "
            "compromise",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "Symmetric: one shared key, fast, key distribution is the problem. "
            "AES, DES, 3DES, SEED, ARIA",
            "Asymmetric: key pair, slow, solves distribution. RSA, "
            "Diffie-Hellman, ECC, DSA",
            "Recipient's public key for confidentiality; sender's private key "
            "for authentication",
            "Symmetric key count for n parties is n(n-1)/2 -- expect to "
            "calculate it",
            "Diffie-Hellman exchanges a key; it does not encrypt and does not "
            "authenticate",
            "Encryption alone gives no integrity; that needs a MAC or an "
            "authenticated mode such as GCM",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "Cryptography provides four distinct properties, and only digital "
            "signatures give non-repudiation",
            "Security must rest on the key, never on keeping the algorithm "
            "secret -- which is why unreviewed ciphers are treated as broken",
            "Symmetric cryptography is fast but needs a pre-shared key, and "
            "the key count grows quadratically with the number of parties",
            "Asymmetric cryptography solves distribution at a large "
            "performance cost, so every real system is hybrid",
            "Which key you encrypt with determines whether you obtain "
            "confidentiality or authentication",
            "The mode of operation matters as much as the cipher: ECB leaks "
            "structure and GCM adds integrity",
            "Forward secrecy means a later key compromise cannot decrypt "
            "recorded past sessions",
        ]),
    ]),
]

_crypto_quiz = [
    mcq("EASY",
        "Which cryptographic property can ONLY be provided by a digital "
        "signature, and not by a message authentication code using a shared "
        "key?",
        [("Non-repudiation", True),
         ("Confidentiality", False),
         ("Integrity", False),
         ("Availability", False)],
        "A shared-key MAC proves the message came from someone holding the "
        "key, but both parties hold it, so neither can prove to a third party "
        "that the other produced a given message. A digital signature uses a "
        "private key only one party holds, which is what makes denial "
        "impossible. Integrity is provided by both mechanisms, confidentiality "
        "by neither, and availability is not a cryptographic property at all."),
    mcq("EASY",
        "Alice wants to send a confidential message to Bob. Which key should "
        "she encrypt it with?",
        [("Bob's public key", True),
         ("Bob's private key", False),
         ("Alice's private key", False),
         ("Alice's public key", False)],
        "Only Bob's private key can decrypt what his public key encrypted, and "
        "only Bob holds it -- which is exactly what confidentiality requires. "
        "Alice does not have Bob's private key. Encrypting with Alice's private "
        "key produces a signature readable by anyone, and encrypting with her "
        "own public key would produce a message only she could read."),
    mcq("AVERAGE",
        "Twelve people need to communicate privately in pairs using symmetric "
        "encryption.\n\nHow many distinct keys are required?",
        [("66", True), ("12", False), ("144", False), ("24", False)],
        "Each unordered pair needs its own key, so the count is n(n-1)/2 = "
        "12 x 11 / 2 = 66. This quadratic growth is precisely the key "
        "distribution problem asymmetric cryptography was invented to solve -- "
        "at a hundred people it would be 4,950. Twelve would be one key per "
        "person, 144 is n squared, and 24 is two per person."),
    mcq("AVERAGE",
        "An image is encrypted with AES in ECB mode, and the outline of the "
        "original picture is still visible in the ciphertext.\n\nWhat does "
        "this demonstrate?",
        [("A correct cipher can still leak structure if the mode of operation "
          "encrypts each block independently.", True),
         ("AES has been broken and should not be used.", False),
         ("The key was too short for the amount of data encrypted.", False),
         ("The image was not fully encrypted because of its file "
          "format.", False)],
        "In ECB mode identical plaintext blocks always produce identical "
        "ciphertext blocks, so repeated regions of the image remain visibly "
        "repeated and every outline survives. AES itself is unbroken -- the "
        "fault is entirely in the mode. Neither key length nor file format is "
        "responsible. CBC, CTR and GCM all avoid the problem by making each "
        "block's encryption depend on more than its own content."),
    mcq("AVERAGE",
        "Why do real protocols such as TLS use both asymmetric and symmetric "
        "cryptography rather than one alone?",
        [("Asymmetric cryptography solves key distribution but is far too slow "
          "for bulk data, so it is used to establish a symmetric session "
          "key.", True),
         ("Symmetric cryptography cannot provide confidentiality, so "
          "asymmetric encryption is needed for the payload.", False),
         ("Asymmetric algorithms cannot encrypt binary data, so symmetric "
          "algorithms handle anything that is not text.", False),
         ("Using two algorithm families doubles the effective key "
          "length.", False)],
        "The hybrid exists for performance. Asymmetric operations are hundreds "
        "of times slower, so they are confined to authentication and key "
        "agreement, and a fast symmetric cipher protects the actual traffic. "
        "Symmetric encryption certainly provides confidentiality, asymmetric "
        "algorithms handle binary fine, and combining families does not add "
        "key lengths together."),
    mcq("AVERAGE",
        "Which statement about elliptic curve cryptography is correct?",
        [("It achieves comparable security to RSA with much shorter keys, "
          "which matters on constrained devices.", True),
         ("It is a symmetric algorithm optimised for embedded systems.", False),
         ("It can only be used for key agreement, never for "
          "signatures.", False),
         ("It requires longer keys than RSA for equivalent security.", False)],
        "A 256-bit elliptic curve key is roughly comparable to a 3072-bit RSA "
        "key, so ECC delivers the same strength with far less computation and "
        "far smaller keys -- which is why it dominates on smart cards, mobile "
        "devices and anywhere bandwidth or battery is scarce. It is asymmetric, "
        "and elliptic curve variants exist for both key agreement and "
        "signatures."),
    mcq("HARD",
        "A server's TLS configuration uses RSA key transport rather than "
        "ephemeral Diffie-Hellman. An attacker records the encrypted traffic "
        "today and obtains the server's private key two years later.\n\nWhat "
        "is the consequence?",
        [("The recorded traffic can be decrypted, because the session keys "
          "were encrypted with that long-term key.", True),
         ("The recorded traffic remains secure, because session keys are "
          "discarded when the session ends.", False),
         ("Only traffic sent after the key was compromised is at risk.", False),
         ("The attacker can impersonate the server but cannot read past "
          "traffic.", False)],
        "With RSA key transport the session key is encrypted with the server's "
        "long-term public key and transmitted, so anyone later obtaining the "
        "private key can recover every recorded session key and decrypt the "
        "entire archive. Ephemeral Diffie-Hellman prevents this by generating "
        "and discarding a fresh key pair per session, which is what forward "
        "secrecy means. Discarding the session key at the endpoint does not "
        "help when the recorded handshake still contains it encrypted."),
    mcq("HARD",
        "Which statement about Diffie-Hellman is correct?",
        [("It establishes a shared secret over a public channel but provides "
          "no authentication, so it must be combined with signatures to resist "
          "a man-in-the-middle.", True),
         ("It encrypts messages directly using the recipient's public "
          "key.", False),
         ("It provides authentication of both parties as a side effect of the "
          "exchange.", False),
         ("It requires the two parties to have exchanged a secret in "
          "advance.", False)],
        "Diffie-Hellman is a key agreement algorithm: two parties derive a "
        "shared secret an eavesdropper cannot compute, with no prior secret "
        "required. But because neither side proves who it is, an attacker in "
        "the middle can run a separate exchange with each and relay traffic "
        "transparently, which is why deployed protocols sign the exchange. It "
        "does not encrypt messages and it authenticates nobody."),
    short_answer("EASY",
        "Which principle states that a cryptosystem must remain secure even if "
        "everything except the key is public knowledge?",
        "Kerckhoffs's principle",
        ["kerckhoffs's principle", "kerckhoffs principle", "kerckhoff's "
         "principle", "kerckhoffs", "kerckhoffs law"]),
    short_answer("AVERAGE",
        "Which block cipher mode provides authentication alongside encryption "
        "and is preferred by modern protocols? Give the acronym.",
        "GCM",
        ["gcm", "galois/counter mode", "galois counter mode", "aes-gcm"]),
    descriptive("HARD",
        "Explain why encrypting a message does not guarantee that it has not "
        "been tampered with, and describe how a real protocol addresses this.",
        "Encryption transforms plaintext into ciphertext so that only a key "
        "holder can recover the original, but it makes no promise whatever "
        "about the ciphertext itself arriving unaltered. An attacker who "
        "cannot read the message can still modify the bytes in transit, and "
        "the recipient will faithfully decrypt whatever arrives. In some modes "
        "the result is merely garbage, which the application may or may not "
        "notice; in others the consequence is far worse. With a stream cipher "
        "or counter mode, flipping a bit of ciphertext flips exactly the "
        "corresponding bit of plaintext, so an attacker who knows the message "
        "structure -- say, that byte 12 holds a transaction amount -- can make "
        "targeted, predictable changes without ever decrypting anything or "
        "knowing the key. Confidentiality and integrity are therefore separate "
        "properties requiring separate mechanisms, and assuming one delivers "
        "the other is a well-documented source of real vulnerabilities. A real "
        "protocol addresses it by adding a message authentication code "
        "computed over the ciphertext with a key, so that any modification "
        "produces a MAC mismatch and the message is rejected before it is "
        "acted on. Better still, it uses an authenticated encryption mode such "
        "as Galois/Counter Mode, which produces the ciphertext and an "
        "authentication tag in a single operation. The latter is preferred "
        "because it removes the opportunity for a developer to combine the two "
        "mechanisms incorrectly -- ordering them wrongly, or authenticating "
        "the plaintext rather than the ciphertext -- which is itself a "
        "recurring source of flaws.",
        [("States clearly that encryption does not protect against "
          "modification", 3),
         ("Explains a concrete tampering scenario such as bit flipping in a "
          "stream or counter mode", 3),
         ("Describes MACs or authenticated encryption as the remedy", 4)]),
]

LESSON_CRYPTO = {
    "middle": MID_SEC_FUNDAMENTALS,
    "name": "Cryptography Fundamentals: Symmetric and Asymmetric Encryption",
    "quiz": _crypto_quiz,
    "structure": lesson_structure(
        "Cryptography Fundamentals: Symmetric and Asymmetric Encryption",
        "Cryptography underpins every other security topic, and this category "
        "previously had nothing on it. This lesson builds the foundation "
        "properly: the four properties cryptography provides and which "
        "mechanism supplies each, why the algorithm is public and only the key "
        "is secret, how symmetric encryption works and why its key "
        "distribution problem grows quadratically, why the mode of operation "
        "can defeat a perfectly good cipher, how asymmetric key pairs solve "
        "distribution, and -- the point exams test hardest -- how the choice "
        "of which key you encrypt with decides whether you obtain "
        "confidentiality or authentication. It closes on why every real "
        "protocol is a hybrid, and what forward secrecy protects against.",
        [
            "Distinguish confidentiality, integrity, authentication and "
            "non-repudiation, and name the mechanism providing each",
            "State Kerckhoffs's principle and explain why unpublished ciphers "
            "are treated as broken",
            "Explain symmetric encryption, name the main algorithms, and "
            "calculate the key count for n communicating parties",
            "Distinguish block from stream ciphers and explain why the mode of "
            "operation matters",
            "Explain what is wrong with ECB and what CBC, CTR and GCM each add",
            "Explain asymmetric encryption and determine which key to use for "
            "confidentiality and which for authentication",
            "Describe RSA, Diffie-Hellman, ECC and DSA and state what each is "
            "actually for",
            "Explain why real protocols combine both families and how a hybrid "
            "exchange proceeds",
            "Explain perfect forward secrecy and the attack it prevents",
        ],
        60,
        _crypto_sections,
        [
            ("Plaintext / ciphertext",
             "The readable message and its encrypted form."),
            ("Kerckhoffs's principle",
             "A cryptosystem must stay secure when everything but the key is "
             "public; security rests on the key alone, because only the key "
             "can be changed."),
            ("Symmetric encryption",
             "One shared key encrypts and decrypts. Fast, but requires secure "
             "key distribution; n parties need n(n-1)/2 keys."),
            ("Asymmetric encryption",
             "A mathematically related key pair: what one encrypts only the "
             "other decrypts. Solves distribution at a large speed cost."),
            ("Mode of operation",
             "How a block cipher handles messages longer than one block. ECB "
             "leaks structure; CBC, CTR and GCM do not."),
            ("GCM",
             "Galois/Counter Mode: authenticated encryption providing "
             "confidentiality and integrity in one operation."),
            ("Diffie-Hellman",
             "A key agreement algorithm producing a shared secret over a "
             "public channel. It does not encrypt and does not authenticate."),
            ("ECC",
             "Elliptic Curve Cryptography: equivalent strength at much shorter "
             "key lengths, valuable on constrained devices."),
            ("Hybrid cryptosystem",
             "Asymmetric cryptography to authenticate and agree a key, "
             "symmetric cryptography to protect the data."),
            ("Perfect forward secrecy",
             "A property whereby compromise of a long-term key cannot decrypt "
             "previously recorded sessions, achieved with ephemeral key "
             "exchange."),
        ],
        "Cryptography provides four properties rather than one, and only a "
        "digital signature gives non-repudiation. Security rests on the key "
        "rather than on hiding the algorithm, which is why an unreviewed "
        "cipher has no evidence of strength at all. Symmetric encryption is "
        "fast but demands that both parties already share a key, and the "
        "number of keys grows as n(n-1)/2 -- 4,950 for a hundred people. "
        "Asymmetric encryption solves that with a published key pair but is "
        "far too slow for bulk data. Which key you encrypt with is the whole "
        "question: the recipient's public key gives confidentiality, your own "
        "private key gives authentication. The mode of operation matters as "
        "much as the cipher, since ECB preserves every pattern in the "
        "plaintext while GCM adds integrity for free. Real protocols therefore "
        "combine everything -- asymmetric to authenticate and agree a session "
        "key, symmetric with an authenticated mode to carry the traffic -- and "
        "prefer ephemeral key exchange so that losing a long-term key tomorrow "
        "does not expose what an attacker recorded today."),
}


# ===========================================================================
# Hash Functions and Message Integrity
# ===========================================================================

_hash_sections = [
    ("What a Hash Function Is", [
        desc(
            "A cryptographic hash function takes an input of any length and "
            "produces a fixed-length output called the digest, or message "
            "digest. SHA-256 produces exactly 256 bits whether the input is a "
            "single byte or a gigabyte film."
        ),
        image(HASH_DIAGRAM),
    ]),

    ("Hashing Is Not Encryption", [
        desc(
            "A hash is a one-way function: computing the digest from the "
            "message is easy and fast, and recovering the message from the "
            "digest is intended to be infeasible. This is not a technicality "
            "but the defining property."
        ),
        desc(
            "Encryption is reversible by design -- that is the entire point of "
            "holding the key -- while hashing is deliberately not reversible "
            "at all. Nothing decrypts a hash, because there is nothing to "
            "decrypt to: the digest is far smaller than the input and most of "
            "the information is genuinely gone. An examiner asking you to "
            "'decrypt the hash' is testing exactly this misconception."
        ),
    ]),

    ("The Four Required Properties", [
        desc(
            "A checksum such as CRC32 satisfies the first of these and none of "
            "the rest, which is precisely why it detects accidental corruption "
            "and offers no defence at all against a deliberate change."
        ),
        sub("Deterministic and fixed-length"),
        desc(
            "The same input always produces the same digest, and every digest "
            "is the same size regardless of input length. Without this, "
            "comparison would be impossible."
        ),
        sub("Preimage resistance"),
        desc(
            "Given a digest, it is infeasible to find any message producing "
            "it. This is the one-way property, and it is what makes password "
            "hashing possible at all."
        ),
        sub("Second preimage resistance"),
        desc(
            "Given a specific message, it is infeasible to find a DIFFERENT "
            "message with the same digest. This is what stops a signed "
            "document being substituted for another."
        ),
        sub("Collision resistance"),
        desc(
            "It is infeasible to find ANY two messages sharing a digest, where "
            "the attacker may choose both freely. This is a harder requirement "
            "than second preimage resistance, and it is the property MD5 and "
            "SHA-1 have lost."
        ),
    ]),

    ("The Avalanche Effect", [
        desc(
            "Changing a single bit of the input should change roughly half the "
            "bits of the digest, in a way no observer can predict. This is "
            "called the avalanche effect."
        ),
        desc(
            "It is what makes a digest useful for detecting tampering: there "
            "is no way to make a small controlled change to a message and a "
            "correspondingly small change to its digest. Any modification, "
            "however trivial, produces a digest bearing no visible "
            "relationship to the original."
        ),
    ]),

    ("Algorithm by Algorithm", [
        desc(
            "Hash algorithms age in a way ciphers largely do not, because "
            "collision-finding techniques improve steadily. Knowing which of "
            "these is still acceptable is more useful than knowing how any of "
            "them works internally."
        ),
        accordion([
            ("MD5",
             "128-bit digest. Collisions can be produced in seconds on "
             "ordinary hardware, so it is cryptographically dead. It survives "
             "only as a non-security checksum for detecting accidental "
             "corruption, and even that use invites confusion about whether "
             "the check means anything."),
            ("SHA-1",
             "160-bit digest. A practical collision was demonstrated in 2017 "
             "by researchers who produced two different PDF files with the "
             "same digest, and it is now deprecated for all signature and "
             "certificate use. Some systems still carry it for legacy "
             "compatibility, and finding it in a signature path is a genuine "
             "audit finding."),
            ("SHA-2",
             "A family -- SHA-224, SHA-256, SHA-384, SHA-512 -- and the "
             "current workhorse. SHA-256 is the default choice for most "
             "purposes and has no practical attacks against it."),
            ("SHA-3",
             "Standardised in 2015 from the Keccak design, using a completely "
             "different internal construction from SHA-2. It exists as "
             "insurance rather than as a replacement: if a structural weakness "
             "were ever found in the SHA-2 family, SHA-3 would not share it "
             "because it is built differently."),
        ]),
    ]),

    ("Where Hashes Are Used", [
        ul([
            "Integrity verification: publish a file's digest so a downloader "
            "can confirm the file arrived intact",
            "Password storage: store the digest rather than the password, so a "
            "database breach does not hand over the passwords themselves",
            "Digital signatures: sign the digest rather than the document, "
            "because signing is slow and a digest is small and fixed-size",
            "Message authentication codes: combine a hash with a secret key to "
            "prove both integrity and origin",
            "Data structures and deduplication: content-addressed storage and "
            "blockchains identify data by its digest rather than by a name",
            "Change detection: comparing digests is far cheaper than comparing "
            "large files byte by byte",
        ]),
    ]),

    ("Password Storage: Why a Plain Hash Fails", [
        desc(
            "Storing a plain hash of a password is better than storing the "
            "password and is still not enough, for reasons examined "
            "regularly."
        ),
        desc(
            "Identical passwords produce identical digests, so an attacker who "
            "breaches the database immediately learns which accounts share a "
            "password -- and if one of those accounts is cracked, all of them "
            "are. Worse, precomputed tables mapping common digests back to "
            "their passwords, known as rainbow tables, are freely available "
            "and turn cracking into a lookup."
        ),
    ]),

    ("The Three Requirements for Password Storage", [
        ol([
            "Add a salt: a unique random value per user, stored alongside the "
            "digest and hashed together with the password. Identical passwords "
            "now produce different digests, and precomputed tables become "
            "useless because a table would have to be rebuilt for every salt",
            "Use a deliberately slow function: bcrypt, scrypt, Argon2 or "
            "PBKDF2 apply many iterations so each guess costs measurable time. "
            "A general-purpose hash like SHA-256 is far too fast for this job, "
            "because being fast is exactly what helps the attacker",
            "Include a tunable work factor that can be raised as hardware "
            "improves, so the cost of guessing keeps pace with the attacker's "
            "equipment rather than falling behind it",
        ]),
    ]),

    ("Why Speed Is the Enemy Here", [
        desc(
            "This point is counter-intuitive and worth stating plainly. For "
            "nearly every use of a hash function, speed is a virtue. For "
            "password storage it is a liability, because the defender hashes "
            "one password per login attempt while the attacker hashes billions "
            "per second against a stolen database."
        ),
        desc(
            "A function that takes 100 milliseconds instead of 1 microsecond "
            "is imperceptible to the user logging in and reduces the "
            "attacker's throughput by a factor of a hundred thousand. That "
            "asymmetry is the entire design goal of a password hashing "
            "function."
        ),
    ]),

    ("Message Authentication Codes", [
        desc(
            "A hash alone proves integrity only if the digest itself arrives "
            "untampered. An attacker who can modify the message can usually "
            "modify the published digest too, and then the check passes "
            "perfectly on a forged message."
        ),
        desc(
            "A message authentication code closes this by mixing a secret key "
            "into the computation. Without the key, an attacker cannot produce "
            "a valid code for a modified message, so a matching code proves "
            "both that the message is unaltered and that it came from someone "
            "holding the key."
        ),
    ]),

    ("HMAC and Length Extension", [
        desc(
            "HMAC is the standard construction, and it deliberately does not "
            "simply concatenate the key and the message before hashing. That "
            "naive approach is vulnerable to length extension attacks against "
            "hash functions built the way SHA-2 is -- an attacker who knows "
            "the digest of key-plus-message can compute the digest of "
            "key-plus-message-plus-extra without knowing the key at all."
        ),
        desc(
            "HMAC's nested structure, hashing twice with two derived keys, "
            "avoids this entirely. It is a good illustration of why standard "
            "constructions are preferred over improvised ones: the obvious "
            "approach is broken in a way that is not obvious."
        ),
    ]),

    ("MAC Versus Digital Signature", [
        desc(
            "Both prove integrity and origin, and only one of them proves it "
            "to a third party. The distinction is examined constantly."
        ),
        ul([
            "A MAC uses a shared secret key, so both parties can produce and "
            "verify it -- and therefore neither can prove the other did",
            "A signature uses a private key, so only the signer could have "
            "produced it, and anyone with the public key can verify",
            "Only a signature provides non-repudiation, which is what makes it "
            "usable in a dispute before an outside authority",
            "A MAC is much faster, being a purely symmetric operation, which "
            "matters when authenticating every packet of a high-volume session",
            "A MAC requires the parties to have already shared a key; a "
            "signature does not",
        ]),
    ]),

    ("The Birthday Attack", [
        desc(
            "Collision resistance is weaker than the digest length suggests, "
            "and the reason is a counter-intuitive piece of probability. "
            "Finding two messages sharing an n-bit digest takes roughly "
            "2^(n/2) attempts, not 2^n, because the attacker is free to choose "
            "BOTH messages."
        ),
        desc(
            "It is the same arithmetic that makes shared birthdays common in a "
            "room of twenty-three people: you are not looking for someone who "
            "shares YOUR birthday, you are looking for any pair at all, and "
            "the number of pairs grows quadratically with the number of "
            "people."
        ),
    ]),

    ("What the Birthday Bound Means for Digest Length", [
        desc(
            "The practical consequence is that a 128-bit digest offers only "
            "about 64 bits of collision resistance, which is well within reach "
            "of a determined and well-funded attacker."
        ),
        desc(
            "This is why digest lengths are chosen at twice the security level "
            "wanted: 256-bit digests for 128-bit collision resistance. It is "
            "also part of why MD5, at 128 bits, was vulnerable long before "
            "practical collisions were actually demonstrated -- the "
            "theoretical margin was always thinner than the number suggested."
        ),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Calling hashing a form of encryption",
             "Encryption is reversible with a key; hashing is one-way and has "
             "no key. A hash cannot be decrypted, and being asked to do so is "
             "a test of whether you understand the difference."),
            ("Using a fast hash for passwords",
             "SHA-256 is fast, and speed helps the attacker try billions of "
             "guesses per second against a stolen database. Password storage "
             "needs a deliberately slow function with a tunable work factor: "
             "bcrypt, scrypt, Argon2 or PBKDF2."),
            ("Omitting the salt",
             "Without a per-user salt, identical passwords hash identically, "
             "shared passwords become visible, and precomputed rainbow tables "
             "apply directly."),
            ("Still using MD5 or SHA-1 for security",
             "Both have practical collision attacks -- SHA-1's was "
             "demonstrated with two colliding PDFs in 2017. They persist in "
             "legacy systems, and finding one in a signature path is a genuine "
             "finding rather than a stylistic complaint."),
            ("Assuming a published digest alone proves integrity",
             "If an attacker can alter the file, they can usually alter the "
             "published digest too. Proving origin as well requires a MAC or a "
             "signature over the digest."),
            ("Concatenating key and message to build a MAC",
             "This naive construction is vulnerable to length extension "
             "against SHA-2-style hashes. Use HMAC, whose nested structure was "
             "designed specifically to avoid it."),
        ]),
    ]),

    ("Practical Example: Verifying a Download", [
        desc(
            "A project publishes a release file and a SHA-256 digest on the "
            "same web page. A user downloads both, computes the digest of the "
            "file, and compares. This reliably detects accidental corruption "
            "-- a truncated download or a bit-rotted disk will not match."
        ),
        desc(
            "It does not detect a deliberate attack, and the reason is worth "
            "stating precisely. Anyone who compromised the web server to "
            "replace the file could replace the published digest in the same "
            "operation, and the check would pass on the modified file. The "
            "verification confirms only that the file matches what that same "
            "server claims it should be."
        ),
    ]),

    ("Making the Verification Mean Something", [
        desc(
            "Serious projects therefore sign the digest with a private key "
            "whose public half is distributed separately -- through a package "
            "manager's trust store, a key server, or shipped with the "
            "operating system."
        ),
        desc(
            "The signature cannot be regenerated by whoever controls the web "
            "server, because they do not hold the private key. Now the "
            "verification means something: it confirms that the file matches "
            "what the PROJECT signed, not merely what the server currently "
            "serves. The general lesson is that an integrity check is only as "
            "trustworthy as the channel carrying the reference value."
        ),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "Hashing versus encryption, usually as a definitional question",
            "The four properties, especially which one MD5 and SHA-1 lost",
            "Which algorithms are acceptable today",
            "Password storage: salt, slow function, work factor",
            "MAC versus signature, focusing on non-repudiation",
            "The birthday attack and its effect on required digest length",
            "Why a published digest on the same server proves little",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "Hashing is one-way and keyless; encryption is reversible and "
            "keyed",
            "Know all four properties, and that collision resistance is the "
            "one MD5 and SHA-1 lost",
            "SHA-256 for general use; MD5 and SHA-1 are not acceptable for "
            "security",
            "Passwords need salt plus a deliberately slow function, never a "
            "bare fast hash",
            "HMAC uses a shared key; a digital signature uses a private key "
            "and is the only one giving non-repudiation",
            "A birthday attack finds collisions in about 2^(n/2) work, so a "
            "256-bit digest gives 128-bit collision resistance",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "A hash is a fixed-length, one-way, keyless digest with the "
            "avalanche property",
            "Its four security properties are distinct, and collision "
            "resistance is the hardest to keep and the first to fall",
            "Signing operates on the digest rather than the document, which is "
            "why hash weaknesses break signature schemes",
            "Password storage needs a per-user salt and a deliberately slow "
            "algorithm, because speed helps the attacker far more than the "
            "defender",
            "A MAC adds a shared key to prove origin; a signature uses a "
            "private key and adds non-repudiation",
            "Collision resistance is half the digest length in bits, which is "
            "why digests are sized at twice the target security level",
            "An integrity check is only as trustworthy as the channel carrying "
            "the reference digest",
        ]),
    ]),
]

_hash_quiz = [
    mcq("EASY",
        "Which statement correctly distinguishes hashing from encryption?",
        [("Hashing is a one-way transformation with no key; encryption is "
          "reversible using a key.", True),
         ("Hashing uses a public key while encryption uses a private "
          "key.", False),
         ("Hashing produces variable-length output while encryption produces "
          "fixed-length output.", False),
         ("Hashing is reversible only by the party that computed it.", False)],
        "A hash function takes no key and cannot be reversed -- the digest is "
        "far smaller than the input, so most of the information is genuinely "
        "gone. Encryption is reversible by design for whoever holds the key. "
        "It is hashing that produces fixed-length output, not encryption, and "
        "nobody can reverse a hash, including whoever computed it."),
    mcq("EASY",
        "Which hash algorithm is the appropriate default choice for general "
        "security use today?",
        [("SHA-256", True), ("MD5", False), ("SHA-1", False), ("CRC32", False)],
        "SHA-256, from the SHA-2 family, has no practical attacks and is the "
        "standard choice. MD5 and SHA-1 both have demonstrated collision "
        "attacks and are unacceptable for security purposes. CRC32 is an error "
        "detection checksum with none of the cryptographic properties at all."),
    mcq("AVERAGE",
        "Why must a per-user salt be stored alongside a password hash?",
        [("So that identical passwords produce different digests and "
          "precomputed rainbow tables cannot be applied.", True),
         ("So that the password can be recovered if the user forgets "
          "it.", False),
         ("So that the hash function runs more slowly and resists brute "
          "force.", False),
         ("So that the digest is padded to the required fixed length.", False)],
        "A salt makes each user's digest unique even when passwords match, "
        "which both hides shared passwords and defeats precomputed tables, "
        "since a table would have to be rebuilt for every distinct salt. It "
        "does not enable recovery -- hashing is one-way. Slowness comes from "
        "the work factor of the algorithm rather than from the salt, and "
        "digests are already fixed-length."),
    mcq("AVERAGE",
        "A developer stores passwords as a single unsalted SHA-256 "
        "digest.\n\nWhy is SHA-256 the wrong tool here even though it is "
        "cryptographically sound?",
        [("It is designed to be fast, which lets an attacker test billions of "
          "candidate passwords per second against a stolen database.", True),
         ("It produces digests that are too short to store a password "
          "safely.", False),
         ("It is vulnerable to collision attacks in the same way as "
          "SHA-1.", False),
         ("It cannot process inputs shorter than its block size.", False)],
        "Speed is a virtue for most uses of a hash and a liability for "
        "password storage: the same throughput that makes SHA-256 attractive "
        "lets an attacker with a GPU try enormous numbers of guesses offline. "
        "Password hashing needs a deliberately slow function with a tunable "
        "work factor. SHA-256's digest length is ample, it has no practical "
        "collision attack, and it handles short inputs perfectly well."),
    mcq("AVERAGE",
        "What does a message authentication code provide that a bare hash "
        "digest does not?",
        [("Proof of origin, because producing a valid code requires the shared "
          "secret key.", True),
         ("A shorter output, making it cheaper to transmit.", False),
         ("Reversibility, so the original message can be recovered.", False),
         ("Non-repudiation, so the sender cannot deny sending the "
          "message.", False)],
        "Anyone can compute a hash, so an attacker who alters a message can "
        "simply recompute its digest. A MAC mixes in a secret key, so only a "
        "key holder can produce a valid code -- which proves origin as well as "
        "integrity. It is not shorter, it is not reversible, and it cannot "
        "give non-repudiation because both parties hold the same key."),
    mcq("AVERAGE",
        "Why does HMAC use a nested construction rather than simply hashing "
        "the key concatenated with the message?",
        [("The naive construction is vulnerable to length extension attacks "
          "against SHA-2-style hash functions.", True),
         ("Concatenation would make the MAC longer than the message "
          "itself.", False),
         ("The nested construction allows the key to be recovered for "
          "auditing.", False),
         ("Concatenation cannot be computed on hardware accelerators.", False)],
        "An attacker who knows the digest of key-plus-message can compute the "
        "digest of key-plus-message-plus-extra without knowing the key, "
        "because of how SHA-2-style hashes process input in blocks. HMAC's "
        "nested double hashing with two derived keys prevents this. It is a "
        "clear illustration of why standard constructions beat improvised "
        "ones: the obvious approach fails in a non-obvious way."),
    mcq("HARD",
        "Roughly how much work does a birthday attack need to find a collision "
        "in a 256-bit hash, and why?",
        [("About 2^128 operations, because the attacker may choose both "
          "messages freely", True),
         ("About 2^256 operations, because every possible digest must be "
          "tried", False),
         ("About 2^64 operations, because only half the digest need "
          "match", False),
         ("About 256 operations, one per bit of the digest", False)],
        "Finding any two inputs that collide is far easier than matching a "
        "specific digest, because the number of possible pairs grows "
        "quadratically with the number of attempts -- the same arithmetic "
        "behind the birthday paradox. The work is approximately 2^(n/2), so "
        "2^128 for a 256-bit digest, which is why digest lengths are chosen at "
        "twice the intended security level. 2^256 would be a preimage attack."),
    mcq("HARD",
        "A project publishes a release file and its SHA-256 digest on the same "
        "web page.\n\nWhat threat does this fail to address, and what fixes "
        "it?",
        [("An attacker who compromises the server can replace both file and "
          "digest; signing the digest with a separately distributed key fixes "
          "it.", True),
         ("Accidental corruption during download; a longer digest fixes "
          "it.", False),
         ("Collision attacks against SHA-256; switching to SHA-3 fixes "
          "it.", False),
         ("Interception of the download in transit; using a MAC instead of a "
          "hash fixes it.", False)],
        "Publishing both artefacts in the same place means whoever controls "
        "that place controls both, so the check proves nothing against a "
        "deliberate attack -- it confirms only that the file matches what the "
        "server currently claims. A signature over the digest cannot be "
        "regenerated without the private key, which is held elsewhere. "
        "Accidental corruption is exactly what the digest does catch, SHA-256 "
        "has no practical collision attack, and a MAC would require a shared "
        "key the public does not have."),
    short_answer("EASY",
        "What is the name for the fixed-length output of a hash function?",
        "Digest",
        ["digest", "message digest", "hash", "hash value", "hash digest"]),
    short_answer("AVERAGE",
        "Name one password hashing algorithm designed to be deliberately slow.",
        "bcrypt",
        ["bcrypt", "scrypt", "argon2", "pbkdf2", "argon2id"]),
    descriptive("HARD",
        "Explain the difference between a message authentication code and a "
        "digital signature, and give a situation where only one of them is "
        "acceptable.",
        "Both prove that a message is unmodified and came from a party holding "
        "a particular key, but they differ fundamentally in what kind of key "
        "that is. A MAC is computed with a secret key shared between sender "
        "and recipient, so successful verification tells the recipient the "
        "message came from someone holding the shared key -- a set that "
        "includes the recipient themselves. A digital signature is computed "
        "with the sender's private key and verified with the corresponding "
        "public key, so only the sender could have produced it. The consequence "
        "is non-repudiation: a signature proves origin to a third party, while "
        "a MAC does not, because the recipient could have forged any MAC they "
        "are able to verify. A MAC is also considerably faster, being a purely "
        "symmetric operation, and it requires the two parties to have "
        "established a shared key beforehand, which a signature does not. A "
        "situation where only a signature is acceptable is any transaction "
        "that may later be disputed before an outside authority -- a contract, "
        "a payment instruction, a signed software release -- because the "
        "recipient must be able to demonstrate to a court, an auditor or the "
        "public that the sender produced it, and a MAC cannot support that "
        "claim at all. Conversely, a MAC is the right choice for "
        "authenticating high-volume traffic inside an already-established "
        "session, such as every packet of a TLS connection, where both parties "
        "share a session key and the computational cost of signing each packet "
        "would be prohibitive.",
        [("Explains the shared-key versus private-key distinction", 3),
         ("Identifies non-repudiation as the property only signatures "
          "provide", 4),
         ("Gives a valid situation requiring a signature specifically", 3)]),
]

LESSON_HASHING = {
    "middle": MID_SEC_FUNDAMENTALS,
    "name": "Hash Functions and Message Integrity",
    "quiz": _hash_quiz,
    "structure": lesson_structure(
        "Hash Functions and Message Integrity",
        "Encryption keeps a message secret; it does nothing to prove the "
        "message is unaltered or that it came from who it claims. That is what "
        "hash functions and the mechanisms built on them provide. This lesson "
        "covers what a cryptographic hash is and why it cannot be decrypted, "
        "the four properties that separate one from an ordinary checksum, "
        "which algorithms are still safe and which are demonstrably broken, "
        "how passwords must actually be stored and why speed is the enemy "
        "there, how a MAC adds proof of origin and why HMAC is built the way "
        "it is, how signatures add non-repudiation, and why a birthday attack "
        "halves the security the digest length appeared to promise.",
        [
            "Define a cryptographic hash function and explain why it cannot be "
            "reversed",
            "State the four required properties and explain what an ordinary "
            "checksum lacks",
            "Explain the avalanche effect and why it matters for tamper "
            "detection",
            "Assess MD5, SHA-1, SHA-2 and SHA-3 for current use",
            "Explain correct password storage: salting, deliberately slow "
            "algorithms and work factors",
            "Explain why speed is a liability specifically for password hashing",
            "Explain what a MAC adds over a bare digest, and what HMAC's nested "
            "construction protects against",
            "Compare MACs with digital signatures, including non-repudiation "
            "and performance",
            "Explain the birthday attack and its effect on required digest "
            "length",
        ],
        55,
        _hash_sections,
        [
            ("Hash function",
             "A one-way, keyless transformation producing a fixed-length "
             "digest from an input of any length."),
            ("Digest",
             "The fixed-length output of a hash function."),
            ("Preimage resistance",
             "Infeasibility of finding any message producing a given digest -- "
             "the one-way property."),
            ("Second preimage resistance",
             "Infeasibility of finding a different message matching a specific "
             "given message's digest."),
            ("Collision resistance",
             "Infeasibility of finding any two messages sharing a digest. The "
             "property MD5 and SHA-1 have lost."),
            ("Avalanche effect",
             "A one-bit input change alters about half the digest bits "
             "unpredictably."),
            ("Salt",
             "A unique random value stored per user and hashed with the "
             "password, defeating rainbow tables and hiding shared passwords."),
            ("Work factor",
             "A tunable iteration count making a password hash deliberately "
             "slow, raisable as attacker hardware improves."),
            ("MAC / HMAC",
             "A message authentication code mixes a shared secret into the "
             "hash to prove origin; HMAC is the standard nested construction, "
             "immune to length extension."),
            ("Length extension attack",
             "Computing the digest of a message plus an appended suffix "
             "without knowing the key, which defeats naive key-plus-message "
             "constructions."),
            ("Birthday attack",
             "Finding a collision in roughly 2^(n/2) work rather than 2^n, "
             "because the attacker may choose both messages."),
        ],
        "A cryptographic hash is one-way, keyless and fixed-length, with the "
        "avalanche property that makes any tampering obvious, and its four "
        "security properties are separate -- collision resistance being the "
        "hardest to keep and the one MD5 and SHA-1 have already lost. Because "
        "signatures are computed over digests rather than documents, a broken "
        "hash breaks every signature scheme built on it. Password storage is "
        "the case where a good general-purpose hash is precisely the wrong "
        "tool: it needs a per-user salt and a deliberately slow algorithm with "
        "a work factor that can be raised over time, because speed helps an "
        "attacker guessing billions of times per second far more than it helps "
        "a defender checking one login. Adding a shared key gives a MAC, which "
        "proves origin as well as integrity and must be built as HMAC rather "
        "than by naive concatenation; using a private key instead gives a "
        "digital signature, which additionally proves origin to a third party. "
        "And because a birthday attack finds collisions in about half the "
        "bits, a digest must be twice as long as the security level you "
        "actually want."),
}

LESSONS = [LESSON_CRYPTO, LESSON_HASHING]
