"""Understanding of Security -> Information Security Fundamentals (MID 123).

Completes the category at five lessons. content_security_01 supplied
cryptography and hashing; these two supply what is built on top of them --
proving who someone is, and deciding what they may then do.

Rebuilt to the format the system's own lessons use: roughly 4,900 words over
28-40 sections, about 46 blocks, diagrams where a picture does the explaining,
and no coloured card grids.

Written against TOPCIT ESSENCE Understanding of Security (Technical Field
03-2, Ver.2), sections "03 Authentication Technologies" and "01 Access
Control".
"""

from builders import (accordion, desc, descriptive, image, lesson_structure,
                      mcq, ol, short_answer, sub, tabs, ul)

MID_SEC_FUNDAMENTALS = 123

SIGNATURE_DIAGRAM = "/lesson-media/digital-signature.svg"
PKI_DIAGRAM = "/lesson-media/pki-trust-chain.svg"
AC_DIAGRAM = "/lesson-media/access-control-models.svg"
# ===========================================================================
# Authentication, Digital Signatures, and PKI
# ===========================================================================

_auth_sections = [
    ("Identification, Authentication, Authorisation", [
        desc(
            "Three words used interchangeably in conversation and precisely in "
            "exams. Identification is the CLAIM -- typing a username asserts "
            "who you are, and asserts nothing more. Authentication is the "
            "PROOF -- supplying something that substantiates the claim. "
            "Authorisation is what happens afterwards -- deciding what the "
            "now-authenticated identity is permitted to do."
        ),
        desc(
            "They occur in that order and cannot be reordered: you cannot "
            "authorise an identity you have not authenticated, and you cannot "
            "authenticate a claim nobody has made."
        ),
    ]),

    ("Why the Distinction Is Operational, Not Academic", [
        desc(
            "The three fail differently, and a support desk that cannot tell "
            "them apart will apply the wrong fix every time."
        ),
        desc(
            "An authentication failure means the system does not believe you "
            "are who you say -- the remedy is a password reset, a token "
            "resynchronisation, an account unlock. An authorisation failure "
            "means the system believes you completely and is refusing anyway "
            "-- the remedy is a permission or role change, and resetting the "
            "password will achieve nothing except annoying the user. 'I can't "
            "get in' covers both, and the first diagnostic question is which "
            "one it is."
        ),
    ]),

    ("A Fourth Word: Accountability", [
        desc(
            "Accountability closes the loop: actions are recorded against the "
            "authenticated identity so that they can be attributed afterwards. "
            "It is what makes an investigation possible at all."
        ),
        desc(
            "It depends entirely on the first three being sound. Shared "
            "accounts destroy it completely, because the log can only ever "
            "record that somebody who knew the password did something -- and "
            "if six people know it, the log has narrowed the field to six. "
            "This is why 'no shared accounts' appears in every security policy "
            "and why it is so often quietly violated for service accounts."
        ),
    ]),

    ("The Three Authentication Factors", [
        desc(
            "Every authentication method belongs to one of three categories, "
            "and they fail in genuinely different ways -- which is the entire "
            "reason the categories matter."
        ),
        sub("Something you know"),
        desc(
            "Passwords, PINs, passphrases, answers to security questions. "
            "Cheap, universal and requiring no hardware. Can be guessed, "
            "phished, reused across sites, or shared without leaving any trace "
            "whatsoever -- the owner cannot tell that a password has been "
            "copied."
        ),
        sub("Something you have"),
        desc(
            "A hardware token, a smart card, a phone running an authenticator "
            "app, a SIM. Cannot be guessed, and its absence is noticeable in a "
            "way a copied password is not. Can be stolen, lost, or -- for SMS "
            "codes -- intercepted without the owner ever losing possession."
        ),
        sub("Something you are"),
        desc(
            "Fingerprint, face, iris, voice, gait. Convenient and hard to "
            "share deliberately. Probabilistic rather than exact, and "
            "unrevocable: a compromised password can be changed, and a "
            "compromised fingerprint cannot be reissued."
        ),
    ]),

    ("Multi-Factor Authentication", [
        desc(
            "Multi-factor authentication requires evidence from two or more "
            "DIFFERENT categories. A password plus a security question is not "
            "multi-factor -- both are things you know, and a single phishing "
            "page collects both in one screen."
        ),
        desc(
            "A password plus a hardware token is genuinely multi-factor, "
            "because an attacker must both learn a secret and physically "
            "obtain an object, and the two require entirely different attacks. "
            "This is the single most examined point in the topic, and it is "
            "also the one most often got wrong in real deployments."
        ),
    ]),

    ("The Question to Ask of Any Second Factor", [
        desc(
            "The useful test is not 'is it an extra step?' but 'does it fail "
            "to the same attack as the first?' If one phishing page can "
            "harvest both, adding the second gained little."
        ),
        desc(
            "This is why SMS codes, while genuinely a second category, are "
            "considered the weakest option: a sufficiently determined attacker "
            "performs a SIM swap and receives the code without touching the "
            "phone, and a real-time phishing proxy can relay a code the user "
            "types within its validity window. They raise the bar rather than "
            "closing the door, which is still worth doing."
        ),
    ]),

    ("Why Biometrics Are Different", [
        desc(
            "Biometric matching is a similarity judgement rather than a "
            "comparison for equality. Your fingerprint is never presented "
            "identically twice -- pressure, moisture, angle and dirt all vary "
            "-- so the system compares a reading against a stored template and "
            "asks whether they are close enough."
        ),
        desc(
            "That means every system has a threshold, and every threshold "
            "produces two error rates. The false acceptance rate is how often "
            "an impostor is admitted; the false rejection rate is how often a "
            "legitimate user is turned away."
        ),
    ]),

    ("The Threshold Trade-off", [
        desc(
            "Tightening the threshold lowers false acceptance and raises false "
            "rejection. Loosening it does the reverse. They cannot both be "
            "reduced by moving the threshold, because it is a single dial -- "
            "improving both simultaneously requires a better sensor or "
            "algorithm, which is what the equal error rate measures."
        ),
        desc(
            "In deployment the two are deliberately unbalanced according to "
            "context. A building's secure door tolerates some false rejection "
            "to keep false acceptance near zero, because a rejected employee "
            "can call security while an admitted intruder cannot be undone. A "
            "consumer phone unlock leans the other way, because an irritated "
            "user will simply disable the feature and use a four-digit PIN "
            "instead -- which is worse."
        ),
    ]),

    ("Passwords and Why They Persist", [
        desc(
            "Passwords are the weakest common factor and by far the most "
            "widely deployed, because they cost nothing, need no hardware, "
            "work on every device, and require no enrolment process."
        ),
        desc(
            "Their weaknesses are thoroughly understood: reuse across sites "
            "means one breach compromises many accounts, predictability makes "
            "guessing viable, phishing extracts them wholesale, and a stolen "
            "password gives no sign whatever of having been stolen. Modern "
            "guidance has changed substantially in response, and some of it "
            "reverses advice that was standard for twenty years."
        ),
    ]),

    ("What Current Password Guidance Says", [
        ul([
            "Length beats complexity: a long passphrase resists guessing far "
            "better than a short string with substitutions, which is why "
            "forced complexity rules have been dropped from modern guidance",
            "Forced frequent rotation is now discouraged, because it drives "
            "predictable increments -- Summer2024 becoming Autumn2024 -- and "
            "encourages writing passwords down",
            "Checking new passwords against known-breach corpora catches the "
            "reuse that actually causes most compromises",
            "Rate limiting and account lockout matter more than composition "
            "rules, because they bound how many guesses an attacker gets "
            "online",
            "None of this helps against an offline attack on a stolen "
            "database, which is why the password hashing from the previous "
            "lesson matters",
        ]),
    ]),

    ("One-Time Passwords", [
        tabs([
            ("HOTP", "HMAC-based one-time password",
             "A counter is incremented on each use and combined with a shared "
             "secret through HMAC to produce the code. Both sides must keep "
             "their counters in step, so a device whose button is pressed a "
             "few times in a pocket drifts ahead and needs resynchronisation. "
             "The code remains valid until used."),
            ("TOTP", "Time-based one-time password",
             "The counter is derived from the current time divided into fixed "
             "windows, typically 30 seconds, so no counter state can drift -- "
             "only clocks, which are easier to keep synchronised. This is what "
             "an authenticator app generates, and its codes expire whether "
             "used or not."),
            ("SMS codes", "Codes delivered by text message",
             "Widely used and the weakest of the three. The message crosses a "
             "telephone network the service does not control, SIM swap attacks "
             "let an attacker receive the code without ever touching the "
             "phone, and the code can be relayed by a real-time phishing "
             "proxy. Better than nothing, and no longer considered strong."),
        ]),
    ]),

    ("How a Digital Signature Works", [
        desc(
            "A digital signature reuses the asymmetric machinery from the "
            "cryptography lesson in the authentication direction. Crucially, "
            "the signer does not encrypt the document -- that would be slow, "
            "and it would make the document unreadable to anyone without the "
            "key, which is usually not what is wanted."
        ),
        image(SIGNATURE_DIAGRAM),
    ]),

    ("The Signing and Verification Steps", [
        ol([
            "Compute a hash of the document, giving a short fixed-length "
            "digest regardless of document size",
            "Encrypt that digest with the signer's PRIVATE key; the result is "
            "the signature",
            "Send the document and the signature together, with the document "
            "in the clear",
            "The verifier decrypts the signature with the signer's PUBLIC key, "
            "recovering the digest the signer computed",
            "The verifier independently hashes the received document and "
            "compares the two digests",
        ]),
    ]),

    ("What a Matching Digest Actually Proves", [
        desc(
            "If the two digests match, three things follow simultaneously, and "
            "being able to state all three is what the exam is testing."
        ),
        ul([
            "Integrity: the document is unaltered, because any change would "
            "have produced a different digest",
            "Authentication: it came from the holder of the private key, "
            "because nothing else produces a signature verifying with that "
            "public key",
            "Non-repudiation: the signer cannot deny it, because only they "
            "hold that key -- which is the property no shared-key mechanism "
            "can provide",
        ]),
        desc(
            "What it does NOT provide is confidentiality. The document travels "
            "in the clear and anyone can read it. Signing and encrypting are "
            "separate operations with different keys, and a system needing "
            "both must perform both."
        ),
    ]),

    ("Why Signatures Depend on Hash Strength", [
        desc(
            "Because the signature covers the digest rather than the document "
            "itself, a collision in the hash function breaks the entire "
            "scheme. An attacker who can produce two documents sharing a "
            "digest can have an innocuous one signed and then attach that "
            "signature to the other."
        ),
        desc(
            "The signature verifies perfectly, because verification only ever "
            "compares digests and the digests match. This is precisely why "
            "SHA-1's demonstrated collision forced certificate authorities to "
            "abandon it, and it is the clearest illustration of why the "
            "hashing lesson matters to this one."
        ),
    ]),

    ("The Problem PKI Solves", [
        desc(
            "Public key cryptography assumes you have the RIGHT public key. If "
            "an attacker can persuade you that their public key belongs to "
            "your bank, every guarantee collapses at once: you will encrypt "
            "confidential data straight to the attacker and verify the "
            "attacker's signatures with complete confidence."
        ),
        desc(
            "No amount of algorithmic strength helps, because the mathematics "
            "is working perfectly -- it is simply working on behalf of the "
            "wrong party. Binding a public key to a verified real-world "
            "identity is the entire purpose of a public key infrastructure."
        ),
        image(PKI_DIAGRAM),
    ]),

    ("The Components of a PKI", [
        accordion([
            ("Certificate Authority (CA)",
             "Issues certificates and signs them with its own private key. Its "
             "signature is the assertion that a named public key belongs to a "
             "named entity. The whole system's trust reduces to trusting CAs, "
             "which is simultaneously its strength -- one trusted party serves "
             "everyone -- and its central weakness, since a compromised CA can "
             "vouch for anything."),
            ("Registration Authority (RA)",
             "Verifies the identity of an applicant before the CA issues "
             "anything. Separating the checking from the signing means the "
             "expensive, heavily guarded signing key is not involved in "
             "routine identity work, and the two functions can be operated by "
             "different people in different places."),
            ("Certificate",
             "A signed document binding a public key to an identity, together "
             "with a validity period, an issuer, a serial number and the "
             "purposes for which the key may be used. X.509 is the format in "
             "universal use."),
            ("Certificate Revocation List (CRL)",
             "A published list of certificates no longer valid despite not "
             "having expired. Simple, and it grows continuously and goes stale "
             "between publications, so a freshly revoked certificate may be "
             "accepted for hours."),
            ("OCSP",
             "The Online Certificate Status Protocol answers a live query "
             "about one specific certificate. Fresher than a CRL, at the cost "
             "of a round trip during connection setup and a privacy leak -- "
             "the responder learns which sites you visit."),
            ("Certificate repository",
             "Where certificates and revocation information are published so "
             "that relying parties can fetch them."),
        ]),
    ]),

    ("The Chain of Trust", [
        desc(
            "A browser does not hold a certificate for every website in the "
            "world, which would be impossible. It holds a comparatively small "
            "set of root CA certificates, installed with the operating system "
            "or browser and updated with them."
        ),
        desc(
            "A website's certificate is signed by an intermediate CA, whose "
            "certificate is signed by a root. Verification walks that chain "
            "upward, checking each signature in turn, until it reaches a root "
            "the browser already trusts. If the chain does not terminate at a "
            "trusted root, verification fails regardless of how correct every "
            "other detail is."
        ),
    ]),

    ("Why Roots Sign Intermediates", [
        desc(
            "Roots sign intermediates rather than end-entity certificates for "
            "a specific operational reason. The root's private key can then "
            "stay offline in a physical vault, used a handful of times a year "
            "under multi-person control, which makes it extremely difficult to "
            "steal."
        ),
        desc(
            "The intermediate does the day-to-day issuing and is necessarily "
            "online. If an intermediate is compromised it can be revoked and "
            "replaced, whereas a compromised root would invalidate every "
            "certificate beneath it and require redistributing trust stores to "
            "every device on Earth."
        ),
    ]),

    ("What Certificate Validation Actually Checks", [
        ol([
            "The signature on each certificate in the chain verifies with the "
            "issuer's public key",
            "The chain terminates at a root the verifier already trusts",
            "The current date falls inside every certificate's validity period",
            "The subject name matches the entity being contacted -- the "
            "hostname, for a website",
            "No certificate in the chain has been revoked, checked by CRL or "
            "OCSP",
            "The certificate's declared key usage permits what it is being "
            "used for, so a code-signing certificate cannot serve a website",
        ]),
    ]),

    ("What a Certificate Does Not Prove", [
        desc(
            "A certificate proves that a public key belongs to the named "
            "domain. It makes no judgement whatever about whether the operator "
            "of that domain is honest, competent or safe to deal with."
        ),
        desc(
            "A phishing site that registers a convincing lookalike domain can "
            "obtain a perfectly valid certificate for it in minutes, and the "
            "browser will show no warning at all -- because nothing is wrong. "
            "The system is working exactly as specified. This is why domain "
            "names still have to be read by humans, and why the padlock icon "
            "was eventually de-emphasised in browsers: it was being read as a "
            "safety indicator when it is an identity-binding indicator."
        ),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Calling a password plus a security question two factors",
             "Both are things you know and both fall to the same phishing "
             "page. Multi-factor means different CATEGORIES, not merely two "
             "prompts."),
            ("Believing a signature keeps a document secret",
             "It does not. The document travels in the clear. Signing gives "
             "integrity, authentication and non-repudiation; confidentiality "
             "is a separate operation with a different key."),
            ("Signing with the wrong key",
             "Signing uses the sender's PRIVATE key and verification the "
             "sender's public key. Encrypting for confidentiality uses the "
             "RECIPIENT's public key. Getting this backwards is the classic "
             "exam trap and it appears in almost every paper."),
            ("Treating a valid certificate as proof of trustworthiness",
             "A certificate proves the key belongs to the named domain. A "
             "phishing site can hold a perfectly valid certificate for its own "
             "lookalike domain."),
            ("Ignoring revocation",
             "A stolen private key is useless to an attacker only if the "
             "certificate is revoked AND relying parties actually check. "
             "Clients that skip revocation checking silently keep trusting "
             "compromised keys until expiry."),
            ("Assuming biometrics can be reissued",
             "A compromised password is changed in seconds. A compromised "
             "fingerprint cannot be changed at all, which is a fundamental "
             "difference from every other factor."),
        ]),
    ]),

    ("Practical Example: A Certificate Warning", [
        desc(
            "A user reaches an internal application and the browser warns that "
            "the connection is not private. Investigation shows the "
            "certificate is technically valid, correctly dated, and matches "
            "the hostname exactly -- but it was signed by the organisation's "
            "own internal CA, which the browser has never heard of."
        ),
        desc(
            "The chain does not terminate at a trusted root, so verification "
            "fails at step two of the six. Nothing else is wrong with it."
        ),
    ]),

    ("The Right Fix and the Common Wrong One", [
        desc(
            "The correct fix is to distribute the organisation's root "
            "certificate to managed devices so that the chain completes -- "
            "which is a routine device management task and takes an afternoon."
        ),
        desc(
            "The common wrong fix is to teach users to click through the "
            "warning. This trains precisely the reflex an attacker needs, "
            "permanently: a user who has learned that certificate warnings are "
            "normal noise will click through the one that matters. Security "
            "controls that people are routinely instructed to bypass are worse "
            "than absent ones, because they consume attention while teaching "
            "the opposite of what they were installed for."
        ),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "The identification/authentication/authorisation distinction, "
            "often as a scenario asking which has failed",
            "Whether a given combination is genuinely multi-factor",
            "False acceptance versus false rejection and the threshold "
            "trade-off",
            "HOTP versus TOTP versus SMS",
            "The signing process step by step, and which key is used where",
            "The three properties a signature provides and the one it does not",
            "PKI components and the six validation checks",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "Identification claims, authentication proves, authorisation "
            "permits, accountability records",
            "Multi-factor requires different categories -- know, have, are",
            "Biometrics trade false acceptance against false rejection; the "
            "equal error rate is the comparison figure",
            "TOTP is time-based, HOTP is counter-based, SMS is the weak one",
            "Signing: hash the document, encrypt the digest with the PRIVATE "
            "key",
            "A signature gives integrity, authentication and non-repudiation "
            "-- never confidentiality",
            "Validation checks signature chain, trusted root, dates, name, "
            "revocation and key usage",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "The three words are not synonyms and their failures need "
            "different fixes",
            "A second factor is only a second factor if it fails to a "
            "different attack",
            "Biometric accuracy is a threshold choice rather than a fixed "
            "property, and biometrics cannot be reissued",
            "A digital signature covers the hash, which is why hash collisions "
            "break signature schemes",
            "A signature gives three properties and confidentiality is not one "
            "of them",
            "PKI exists because public key cryptography is worthless without "
            "knowing whose key you hold",
            "Certificate validation is six checks, and revocation is the one "
            "most often skipped",
        ]),
    ]),
]

_auth_quiz = [
    mcq("EASY",
        "A system requires a password and then the answer to a security "
        "question.\n\nIs this multi-factor authentication?",
        [("No -- both are 'something you know', so both fall to the same "
          "attack.", True),
         ("Yes -- any two separate authentication steps constitute two "
          "factors.", False),
         ("Yes -- the security question counts as 'something you are' because "
          "it is personal.", False),
         ("No -- multi-factor requires at least three separate steps.", False)],
        "Multi-factor means evidence from different categories, not merely two "
        "prompts. A password and a security answer are both knowledge, and a "
        "single phishing page collects both in one screen. Personal "
        "information is still knowledge rather than an inherent physical "
        "characteristic, and two factors is the threshold, not three."),
    mcq("EASY",
        "Which key is used to create a digital signature?",
        [("The signer's private key", True),
         ("The signer's public key", False),
         ("The recipient's public key", False),
         ("A symmetric key shared between signer and recipient", False)],
        "Signing encrypts the document's digest with the signer's private key, "
        "so that anyone holding the matching public key can verify it and only "
        "the signer could have produced it. The recipient's public key is used "
        "for confidentiality, not signing, and a shared symmetric key would "
        "give a MAC -- which cannot provide non-repudiation."),
    mcq("AVERAGE",
        "Why does a digital signature cover the document's hash rather than "
        "the document itself?",
        [("Asymmetric operations are slow, and a digest is short and "
          "fixed-length regardless of document size.", True),
         ("Hashing encrypts the document so the signature also keeps it "
          "secret.", False),
         ("The signature algorithm cannot process binary data "
          "directly.", False),
         ("It allows the same signature to be reused for similar "
          "documents.", False)],
        "Public key operations are expensive, so signing a gigabyte directly "
        "would be impractical; hashing reduces any input to a short fixed "
        "digest signable in one operation. Hashing provides no secrecy, "
        "signature algorithms handle binary fine, and a signature being "
        "reusable across documents would be a catastrophic flaw rather than a "
        "feature."),
    mcq("AVERAGE",
        "A collision attack is found against the hash function used in a "
        "signature scheme.\n\nWhat becomes possible?",
        [("An attacker can have an innocuous document signed and attach that "
          "signature to a different document with the same digest.", True),
         ("An attacker can recover the signer's private key from the "
          "signature.", False),
         ("An attacker can decrypt documents that were signed but not "
          "encrypted.", False),
         ("Nothing changes, because the signature also covers the document "
          "length.", False)],
        "Verification only compares digests, so two documents sharing a digest "
        "are indistinguishable to the verifier and one signature serves for "
        "both. This is precisely why SHA-1's demonstrated collision forced its "
        "removal from certificates. Collisions reveal nothing about the "
        "private key, signed documents were never encrypted to begin with, and "
        "the signature covers the digest alone."),
    mcq("AVERAGE",
        "A biometric system's threshold is tightened to make impostor "
        "acceptance less likely.\n\nWhat is the unavoidable consequence?",
        [("The false rejection rate rises, so more legitimate users are turned "
          "away.", True),
         ("The false acceptance rate also rises, because matching becomes less "
          "stable.", False),
         ("Both error rates fall together, since the system is now more "
          "accurate.", False),
         ("The equal error rate rises, making the system worse "
          "overall.", False)],
        "Biometric matching is a similarity judgement against a threshold, so "
        "the two error rates trade against each other: demanding a closer "
        "match admits fewer impostors and also rejects more genuine users "
        "whose reading varies with pressure, moisture or angle. They cannot "
        "both be reduced by moving the threshold; that would require a better "
        "sensor or algorithm, which is what the equal error rate measures."),
    mcq("AVERAGE",
        "What distinguishes TOTP from HOTP?",
        [("TOTP derives its counter from the current time in fixed windows, "
          "while HOTP increments a counter on each use.", True),
         ("TOTP uses a shared secret while HOTP uses a public key "
          "pair.", False),
         ("TOTP codes remain valid until used, while HOTP codes "
          "expire.", False),
         ("TOTP is delivered by SMS while HOTP is generated on the "
          "device.", False)],
        "Both use HMAC with a shared secret; the difference is what feeds the "
        "counter. TOTP uses time divided into windows, typically 30 seconds, "
        "so codes expire whether used or not and no counter state can drift. "
        "HOTP increments per use, which means a device whose button is pressed "
        "accidentally drifts ahead of the server and needs resynchronisation. "
        "Neither is inherently SMS-delivered."),
    mcq("HARD",
        "Why do root certificate authorities sign intermediate CA certificates "
        "rather than signing end-entity certificates directly?",
        [("The root's private key can then stay offline, and a compromised "
          "intermediate can be revoked without invalidating everything the "
          "root has signed.", True),
         ("Browsers are unable to verify a signature made directly by a root "
          "certificate.", False),
         ("Intermediates use a different algorithm that is faster for "
          "high-volume issuance.", False),
         ("It allows the root certificate to have a shorter validity "
          "period.", False)],
        "The root key is the foundation of the entire trust chain, so it is "
        "kept offline in a vault and used a handful of times a year under "
        "multi-person control; intermediates do the day-to-day issuing and are "
        "necessarily online. If an intermediate is compromised it is revoked "
        "and replaced, while a compromised root would invalidate everything "
        "beneath it and require redistributing trust stores worldwide. Roots "
        "have LONGER validity than intermediates, not shorter."),
    mcq("HARD",
        "A phishing site presents a valid certificate for its own lookalike "
        "domain, and the browser shows no warning.\n\nWhat does this reveal "
        "about what a certificate proves?",
        [("It proves the public key belongs to that domain, not that the "
          "domain's operator is trustworthy.", True),
         ("It proves the certificate authority has been compromised.", False),
         ("It proves the browser's revocation checking has failed.", False),
         ("It proves the certificate was self-signed and should have "
          "warned.", False)],
        "Certificate validation binds a key to a name; it makes no judgement "
        "about the character of whoever registered that name. An attacker "
        "controlling a lookalike domain can obtain a perfectly legitimate "
        "certificate for it. No CA compromise, revocation failure or "
        "self-signing is involved -- the system is working exactly as "
        "specified, which is why domain names must still be read by humans."),
    short_answer("EASY",
        "What term describes requiring evidence from two different "
        "authentication categories? Give the common term or its acronym.",
        "Multi-factor authentication",
        ["multi-factor authentication", "mfa", "multifactor authentication",
         "two-factor authentication", "2fa"]),
    short_answer("AVERAGE",
        "Which protocol answers a live query about whether a single "
        "certificate has been revoked? Give the acronym.",
        "OCSP",
        ["ocsp", "online certificate status protocol"]),
    descriptive("HARD",
        "Explain what a public key infrastructure is for, and describe what a "
        "browser checks when validating a website's certificate.",
        "Public key cryptography is only as good as your confidence that a "
        "public key belongs to who you think it does. If an attacker can "
        "convince you that their key is your bank's, you will encrypt "
        "confidential data straight to them and accept their signatures as "
        "genuine, and no amount of algorithmic strength helps -- the "
        "mathematics is working perfectly, simply on behalf of the wrong "
        "party. A public key infrastructure exists to bind public keys to "
        "verified identities: a registration authority checks an applicant's "
        "identity, then a certificate authority issues a certificate -- a "
        "document stating that a named public key belongs to a named entity, "
        "with a validity period and permitted usages -- and signs it with the "
        "authority's own private key. Relying parties who trust the authority "
        "can therefore trust the binding without having verified the identity "
        "themselves, which is what makes the system scale. When a browser "
        "validates a website's certificate it performs several checks "
        "together. It verifies the signature on each certificate in the chain "
        "using the issuer's public key, following that chain from the site's "
        "certificate through any intermediates until it reaches a root already "
        "present in its trust store; a chain not terminating at a trusted root "
        "fails. It checks that the current date falls within each "
        "certificate's validity period. It checks that the subject name "
        "matches the hostname actually being contacted. It checks revocation "
        "status by CRL or OCSP, because a certificate can be withdrawn before "
        "it expires, typically after a key compromise. And it checks that the "
        "declared key usage permits server authentication. Passing all of "
        "these proves the key belongs to that domain -- it emphatically does "
        "not prove the operator of the domain is honest, which is why a "
        "phishing site with a lookalike domain can hold a perfectly valid "
        "certificate.",
        [("Explains that PKI binds public keys to verified identities and why "
          "that is necessary", 4),
         ("Describes chain verification up to a trusted root", 3),
         ("Names further checks such as validity dates, hostname match or "
          "revocation", 3)]),
]

LESSON_AUTH = {
    "middle": MID_SEC_FUNDAMENTALS,
    "name": "Authentication, Digital Signatures, and PKI",
    "quiz": _auth_quiz,
    "structure": lesson_structure(
        "Authentication, Digital Signatures, and PKI",
        "Cryptography gives you the mathematics; this lesson is about using it "
        "to answer the question 'who am I actually talking to?'. You will "
        "learn the precise difference between identification, authentication "
        "and authorisation and why a support desk that confuses them applies "
        "the wrong fix, the three authentication factors and the test that "
        "decides whether a second factor is genuinely second, why biometric "
        "accuracy is a threshold choice rather than a fixed number, how a "
        "digital signature is constructed and exactly which three properties a "
        "matching digest proves, and why public key cryptography is worthless "
        "without an infrastructure to say whose key you are holding.",
        [
            "Distinguish identification, authentication, authorisation and "
            "accountability, and diagnose which has failed from a symptom",
            "Name the three authentication factors and judge whether a given "
            "combination is genuinely multi-factor",
            "Explain false acceptance and false rejection rates, the threshold "
            "trade-off, and how context decides which to favour",
            "Compare HOTP, TOTP and SMS delivery of one-time codes",
            "Describe the digital signature process step by step and state the "
            "three properties it provides and the one it does not",
            "Explain why signature security depends entirely on hash collision "
            "resistance",
            "Describe the components of a PKI and the role of each",
            "List the six checks a client performs when validating a "
            "certificate chain",
            "Explain what a valid certificate does not prove",
        ],
        60,
        _auth_sections,
        [
            ("Identification / authentication / authorisation",
             "Claiming an identity, proving it, and being permitted to act. "
             "Three separate steps with three separate failure modes and "
             "remedies."),
            ("Accountability",
             "Attributing recorded actions to an authenticated identity. "
             "Destroyed completely by shared accounts."),
            ("Authentication factor",
             "Something you know, something you have, or something you are. "
             "Multi-factor requires different categories."),
            ("False acceptance / false rejection rate",
             "How often a biometric system admits an impostor, and how often "
             "it turns away a legitimate user. They trade against each other "
             "along a single threshold."),
            ("Equal error rate",
             "The threshold at which the two biometric error rates are equal; "
             "the conventional single figure for comparing systems."),
            ("HOTP / TOTP",
             "Counter-based and time-based one-time passwords. TOTP is what an "
             "authenticator app generates and cannot drift."),
            ("Digital signature",
             "The document's hash encrypted with the signer's private key, "
             "giving integrity, authentication and non-repudiation -- but "
             "never confidentiality."),
            ("Certificate Authority",
             "The entity verifying identities and signing certificates, making "
             "it the root of trust and the central point of weakness."),
            ("X.509 certificate",
             "The standard format binding a public key to an identity, with "
             "issuer, validity period, serial number and permitted usages."),
            ("CRL / OCSP",
             "Published revocation list and live revocation query "
             "respectively, for certificates withdrawn before expiry."),
            ("Chain of trust",
             "The sequence from an end certificate through intermediates to a "
             "root already trusted by the verifier."),
        ],
        "Identification claims, authentication proves, authorisation permits "
        "and accountability records -- four steps that fail differently and "
        "need entirely different remedies, which is why the distinction is "
        "operational rather than academic. A second authentication factor only "
        "helps if it belongs to a different category and therefore fails to a "
        "different attack, which is exactly why a password plus a security "
        "question is not multi-factor. Biometrics are probabilistic, so their "
        "accuracy is a threshold decision between admitting impostors and "
        "rejecting legitimate users, deliberately unbalanced according to "
        "context -- and unlike a password, a compromised fingerprint cannot be "
        "reissued. A digital signature encrypts the document's hash with the "
        "signer's private key, giving integrity, authentication and "
        "non-repudiation while leaving the document readable, and depending "
        "completely on the hash function's collision resistance. PKI exists "
        "because all of this presumes you hold the right public key: "
        "certificate authorities vouch for that binding, validation means "
        "verifying a chain to a trusted root within its dates matching the "
        "name and not revoked -- and even a perfect result proves only that "
        "the key belongs to that domain, never that its owner is honest."),
}


# ===========================================================================
# Access Control Models
# ===========================================================================

_ac_sections = [
    ("What Access Control Decides", [
        desc(
            "Authentication establishes who a request comes from. Access "
            "control decides what that identity may do with which resource, "
            "and it is a separate discipline with its own models, its own "
            "vocabulary and its own characteristic failures."
        ),
        desc(
            "The vocabulary is small and worth fixing precisely: the SUBJECT "
            "is the active party making the request, the OBJECT is the "
            "resource being acted on, and the OPERATION is what is being "
            "attempted -- read, write, execute, delete. Every access control "
            "question is about some triple of those three."
        ),
    ]),

    ("Least Privilege", [
        desc(
            "A subject receives the minimum access needed for its function, "
            "and no more. This sounds like tidiness and is actually a damage "
            "limitation strategy."
        ),
        desc(
            "Its value shows entirely at the moment of compromise: an attacker "
            "who takes over an account inherits precisely what that account "
            "could do, and nothing else. An administrator account compromised "
            "is a catastrophe; a tightly scoped service account compromised is "
            "an incident. The difference was decided months earlier, when the "
            "permissions were granted."
        ),
    ]),

    ("Separation of Duties", [
        desc(
            "No single subject can complete a sensitive transaction alone. The "
            "person who raises a payment cannot also approve it; the developer "
            "who writes a change cannot also deploy it to production "
            "unreviewed."
        ),
        desc(
            "This is what makes fraud require collusion rather than one bad "
            "decision by one person having a bad month. It is also why it "
            "resists the argument that a particular employee is trustworthy: "
            "the control is not about distrust of individuals but about not "
            "placing anyone in a position where a single lapse has "
            "unrecoverable consequences."
        ),
    ]),

    ("Fail-Safe Defaults", [
        desc(
            "The default answer must be denial. A system permitting anything "
            "not explicitly forbidden fails open: every resource nobody "
            "remembered to protect is exposed, and the omissions are invisible "
            "until somebody finds them."
        ),
        desc(
            "Deny-by-default makes an omission produce a support ticket rather "
            "than a breach, which is a far better failure mode -- somebody "
            "complains that they cannot reach something, and the gap is closed "
            "deliberately. The complaints are the control working, not the "
            "control failing."
        ),
    ]),

    ("The Four Models", [
        desc(
            "Four models dominate, and they differ in who makes the decision "
            "and on what basis. The diagram below places them side by side."
        ),
        image(AC_DIAGRAM),
    ]),

    ("Discretionary Access Control", [
        desc(
            "Under DAC, the owner of a resource decides who may access it. "
            "This is the model behind ordinary file permissions on Windows and "
            "Unix: the file's owner grants and revokes rights at their own "
            "discretion, which is where the name comes from."
        ),
        desc(
            "It is flexible, intuitive, and what most people mean when they "
            "think of permissions. A user who creates a document can share it "
            "with whoever they judge appropriate, without involving an "
            "administrator."
        ),
    ]),

    ("Why DAC's Flexibility Is Also Its Weakness", [
        desc(
            "A user can pass on access they were granted, so an "
            "organisation's actual security posture is only as good as the "
            "judgement of every individual owner, and there is no central "
            "guarantee anywhere."
        ),
        desc(
            "Worse, malware running as a user inherits that user's discretion "
            "and can re-share anything they could reach. The system cannot "
            "distinguish a deliberate share from a malicious one, because both "
            "are the owner exercising a right the model grants them."
        ),
    ]),

    ("Mandatory Access Control", [
        desc(
            "Under MAC, a system-wide policy decides and owners cannot "
            "override it. Subjects hold clearances and objects hold "
            "classifications, and the system compares the two on every access "
            "attempt."
        ),
        desc(
            "A user cleared to Confidential cannot read a Secret document no "
            "matter who wants them to -- not the document's author, not their "
            "manager, not themselves. They also cannot grant anyone else "
            "access, because granting is not a right the model gives them. "
            "This is the model of military and government systems and of "
            "frameworks such as SELinux, and it is rigid and administratively "
            "expensive by design."
        ),
    ]),

    ("Bell-LaPadula: Protecting Confidentiality", [
        desc(
            "Bell-LaPadula enforces two rules: no read up, and no write down. "
            "A subject may not read data classified above its clearance, which "
            "is the obvious protection."
        ),
        desc(
            "The second rule is less obvious and equally necessary. A subject "
            "may not write to a level BELOW its own, because doing so would "
            "let someone cleared to Secret transcribe secret material into an "
            "unclassified file where uncleared subjects could read it. The "
            "model prevents the leak indirectly as well as directly."
        ),
    ]),

    ("Biba: Protecting Integrity", [
        desc(
            "Biba states the mirror image: no read down, and no write up. A "
            "subject may not read data of lower integrity, because "
            "untrustworthy input could corrupt its conclusions, and may not "
            "write to a level above its own, which would contaminate more "
            "trusted data with less trusted content."
        ),
        desc(
            "The two models read as exact opposites because they protect "
            "opposite things. A memory hook that survives exam pressure: "
            "Bell-LaPadula protects confidentiality and is about not letting "
            "secrets escape DOWNWARD; Biba protects integrity and is about not "
            "letting rubbish flow UPWARD."
        ),
    ]),

    ("Role-Based Access Control", [
        desc(
            "RBAC assigns permissions to roles and roles to users, so nobody "
            "holds permissions directly. A new nurse is given the Nurse role "
            "and immediately has exactly what nurses need; when they leave, "
            "removing the role removes everything at once, with nothing left "
            "behind."
        ),
        desc(
            "This indirection is what makes RBAC the dominant model in "
            "business systems, and the reason is administrative arithmetic "
            "rather than security theory."
        ),
    ]),

    ("Why RBAC Scales", [
        ul([
            "Administration scales with the number of ROLES rather than the "
            "number of users, which is what makes it workable across thousands "
            "of staff",
            "Joiners, movers and leavers become role assignments rather than "
            "permission audits, and a mover's old role is removed cleanly",
            "Separation of duties can be enforced structurally, by declaring "
            "two roles mutually exclusive so no account can hold both",
            "Roles can be hierarchical, so a senior role inherits a junior "
            "one's permissions rather than restating them",
            "Review is tractable: a role assignment can be read off a screen "
            "and confirmed by a manager who understands the job",
        ]),
    ]),

    ("Where RBAC Runs Out", [
        desc(
            "RBAC decides on identity alone, and many real policies depend on "
            "context that a role simply cannot express."
        ),
        desc(
            "Consider: 'nurses may read the records of patients on their own "
            "ward, during their rostered shift, from a hospital device'. Ward, "
            "shift and device are not properties of the job. Attempting to "
            "encode them as roles produces a separate role per ward per shift "
            "-- an explosion that quickly becomes unmanageable and, more "
            "importantly, unauditable."
        ),
    ]),

    ("Attribute-Based Access Control", [
        desc(
            "ABAC evaluates a policy over attributes of the subject, the "
            "object, the action and the environment. Instead of asking which "
            "role you hold, it asks a question about the whole situation, "
            "which is what lets one rule replace the hundreds of roles the "
            "previous example would need."
        ),
        ol([
            "Subject attributes: department, clearance, employment status, "
            "assigned ward, current shift",
            "Object attributes: classification, owner, the patient's assigned "
            "ward, record type, age of the record",
            "Action attributes: read, write, print, export, share externally",
            "Environment attributes: time of day, network location, device "
            "posture, threat level",
        ]),
    ]),

    ("What ABAC Costs", [
        desc(
            "The price is comprehensibility, and it is a real one. A role "
            "assignment can be read off a screen and understood by a manager "
            "in seconds."
        ),
        desc(
            "Answering 'who can actually reach this record?' under ABAC "
            "requires evaluating policy across every possible combination of "
            "attribute values, which may not be tractable by inspection at "
            "all. Powerful policies are correspondingly harder to audit, and "
            "an access control system nobody can reason about is its own kind "
            "of risk. That trade-off is precisely the point of comparing the "
            "two models."
        ),
    ]),

    ("Choosing Between the Models", [
        ul([
            "File owners decide who may read their documents: DAC",
            "Clearance levels enforced regardless of any owner's wishes: MAC",
            "Permissions follow job function across five thousand staff: RBAC",
            "Access depends on time of day and device location: ABAC",
            "Secrets must not flow to lower classifications: Bell-LaPadula",
            "Untrusted data must not contaminate trusted records: Biba",
        ]),
    ]),

    ("Access Control Lists and Capabilities", [
        desc(
            "Two ways of storing the same conceptual access matrix, and exams "
            "distinguish them. An access control list is attached to the "
            "OBJECT and lists which subjects may do what -- answering 'who can "
            "reach this file?' immediately."
        ),
        desc(
            "A capability is held by the SUBJECT and lists what it may reach "
            "-- answering 'what can this user reach?' immediately. Each makes "
            "the other question expensive: revoking one user's access is easy "
            "with ACLs and awkward with capabilities, since the capability is "
            "already out in the world; enumerating a user's rights is easy "
            "with capabilities and requires scanning every object with ACLs."
        ),
    ]),

    ("Common Mistakes", [
        accordion([
            ("Confusing authentication with authorisation",
             "Authentication decides who you are; access control decides what "
             "you may do. A correctly authenticated user being refused is not "
             "a login problem, and resetting their password will achieve "
             "nothing."),
            ("Reversing Bell-LaPadula and Biba",
             "Bell-LaPadula is confidentiality: no read up, no write down. "
             "Biba is integrity: no read down, no write up. Anchor on which "
             "property each protects and the rules follow rather than needing "
             "separate memorisation."),
            ("Granting permissions directly under RBAC",
             "A single 'just this once' direct grant defeats the model's whole "
             "benefit, because it is invisible to role review and survives the "
             "person changing jobs or departments."),
            ("Building roles per department per location per shift",
             "That is role explosion, and it means the requirement was really "
             "attribute-based. Adding roles indefinitely produces something "
             "nobody can audit, which is worse than the problem it solved."),
            ("Defaulting to allow",
             "Deny by default. A permissive default hides every omission until "
             "somebody discovers it, and they may not be friendly."),
            ("Treating separation of duties as distrust",
             "It is not about any individual's character. It is about not "
             "placing one person where a single lapse is unrecoverable, which "
             "protects them as much as the organisation."),
        ]),
    ]),

    ("Practical Example: A Hospital Records System", [
        desc(
            "A hospital starts with RBAC: Doctor, Nurse, Administrator, "
            "Auditor. Four roles, easily understood, easily reviewed, and it "
            "works well for a considerable time."
        ),
        desc(
            "Then the privacy team asks that staff see only the records of "
            "patients currently on their own ward. That is not a property of "
            "the job -- it is a relationship between the subject and the "
            "specific object -- so no arrangement of roles expresses it "
            "without a role per ward, multiplied again per shift, and "
            "multiplied again if bank staff rotate."
        ),
    ]),

    ("The Hybrid That Real Systems Use", [
        desc(
            "The practical answer is to keep RBAC for the coarse decision and "
            "add attribute rules for the fine one. The Nurse role grants the "
            "ability to open patient records at all -- the question of whether "
            "this person is clinical staff."
        ),
        desc(
            "An attribute policy then requires that the patient's ward matches "
            "the nurse's current assignment and that the request originates on "
            "a hospital network during a rostered shift. Roles stay few and "
            "auditable, the contextual condition lives in one rule rather than "
            "in a combinatorial explosion, and a manager reviewing access can "
            "still understand what the roles mean."
        ),
    ]),

    ("How This Lesson Is Examined", [
        ul([
            "Matching a scenario to a model: who decides, and on what basis",
            "The Bell-LaPadula and Biba rules, and which property each "
            "protects",
            "Least privilege versus separation of duties -- which principle a "
            "given failure breaches",
            "Recognising role explosion and naming what it indicates",
            "ABAC's four attribute categories",
            "ACL versus capability, and which question each makes cheap",
        ]),
    ]),

    ("Certification Exam Tips", [
        ul([
            "Subject acts on object; least privilege and separation of duties "
            "constrain every model",
            "DAC = owner decides; MAC = system policy decides and owners "
            "cannot override",
            "Bell-LaPadula: no read up, no write down, confidentiality. Biba: "
            "no read down, no write up, integrity",
            "RBAC scales administration by role and is the business default; "
            "role explosion is the sign you needed ABAC",
            "ABAC evaluates subject, object, action and environment attributes",
            "ACLs attach to objects, capabilities to subjects",
        ]),
    ]),

    ("Key Takeaways", [
        ul([
            "Access control answers what an authenticated identity may do, "
            "which is a different question from who they are",
            "Least privilege limits the damage of a compromise; separation of "
            "duties makes fraud require collusion; deny-by-default turns "
            "omissions into tickets rather than breaches",
            "DAC is flexible and ungoverned; MAC is governed and rigid",
            "Bell-LaPadula stops secrets flowing down; Biba stops untrusted "
            "data flowing up",
            "RBAC is the business default because administration scales with "
            "roles rather than people",
            "ABAC expresses contextual policy that roles cannot, at a real "
            "cost in auditability",
            "Most real systems end up hybrid: roles for the coarse decision, "
            "attributes for the conditional one",
        ]),
    ]),
]

_ac_quiz = [
    mcq("EASY",
        "Under which access control model does the owner of a resource decide "
        "who may access it?",
        [("Discretionary Access Control (DAC)", True),
         ("Mandatory Access Control (MAC)", False),
         ("Role-Based Access Control (RBAC)", False),
         ("Attribute-Based Access Control (ABAC)", False)],
        "DAC leaves the decision to the resource owner's discretion, which is "
        "how ordinary file permissions work on Windows and Unix. MAC removes "
        "that discretion in favour of a system-wide policy over clearances, "
        "RBAC derives access from job function, and ABAC evaluates attributes "
        "of the whole request."),
    mcq("EASY",
        "What does the principle of least privilege require?",
        [("A subject is granted only the minimum access needed for its "
          "function.", True),
         ("Sensitive transactions require at least two different "
          "people.", False),
         ("Access is denied unless a rule explicitly permits it.", False),
         ("Permissions are granted through roles rather than "
          "individually.", False)],
        "Least privilege bounds what any one identity can do, so a compromised "
        "account inherits as little as possible -- its value shows entirely at "
        "the moment of compromise. The second option describes separation of "
        "duties, the third fail-safe defaults, and the fourth is RBAC. All are "
        "related principles answering different questions."),
    mcq("AVERAGE",
        "The Bell-LaPadula model enforces \"no read up, no write down\". Which "
        "property is it protecting, and what would \"write down\" allow?",
        [("Confidentiality; writing down would let a subject copy "
          "highly-classified information to a lower level where uncleared "
          "subjects could read it.", True),
         ("Integrity; writing down would let low-quality data corrupt "
          "high-integrity records.", False),
         ("Availability; writing down would let a subject exhaust storage at "
          "lower levels.", False),
         ("Confidentiality; writing down would let a subject overwrite records "
          "it is not cleared to see.", False)],
        "Bell-LaPadula is the confidentiality model. Reading up would expose "
        "material above the subject's clearance directly; writing down would "
        "achieve the same leak indirectly, by transcribing classified content "
        "somewhere less protected. Integrity is Biba's concern, and "
        "availability is not modelled by either."),
    mcq("AVERAGE",
        "An organisation using RBAC finds itself creating roles such as "
        "\"Nurse-WardA-DayShift\" and \"Nurse-WardB-NightShift\".\n\nWhat does "
        "this indicate?",
        [("Role explosion -- the requirement is contextual and calls for "
          "attribute-based rules rather than more roles.", True),
         ("Correct application of RBAC, since each distinct job needs its own "
          "role.", False),
         ("A need to switch to mandatory access control with clearance "
          "levels.", False),
         ("A failure of least privilege, since the roles are too "
          "narrow.", False)],
        "Ward and shift are attributes of the request rather than properties "
        "of the job, and encoding them as roles multiplies the role count by "
        "every combination until nobody can audit it. ABAC expresses the "
        "condition in a single rule. MAC addresses classification rather than "
        "context, and the roles are not violating least privilege -- they are "
        "over-fragmenting it."),
    mcq("AVERAGE",
        "What is the practical difference between an access control list and a "
        "capability?",
        [("An ACL is attached to the object and lists permitted subjects; a "
          "capability is held by the subject and lists permitted "
          "objects.", True),
         ("An ACL applies to files while a capability applies to network "
          "resources.", False),
         ("An ACL is used in MAC systems while a capability is used in DAC "
          "systems.", False),
         ("An ACL is evaluated at login while a capability is evaluated on "
          "each request.", False)],
        "They store the same access matrix from opposite sides, which makes "
        "different questions cheap: ACLs answer 'who can reach this object?' "
        "and make revocation easy, while capabilities answer 'what can this "
        "subject reach?' and make enumeration easy. The distinction is not "
        "about resource type, model or evaluation timing."),
    mcq("AVERAGE",
        "Why is deny-by-default preferred over permit-by-default in an access "
        "control system?",
        [("An omission then produces a refusal somebody reports, rather than "
          "an exposure nobody notices.", True),
         ("It reduces the number of rules that must be written.", False),
         ("It allows the system to process requests faster.", False),
         ("It is required by every access control model.", False)],
        "With a permissive default, every resource nobody remembered to "
        "protect is silently exposed and the omission is invisible until "
        "somebody finds it -- possibly an attacker. Deny-by-default converts "
        "the same omission into a user complaining they cannot reach "
        "something, which is a far better failure mode. It usually requires "
        "MORE rules, not fewer, and performance is not the consideration."),
    mcq("HARD",
        "Why is the Biba model's rule \"no write up\" the opposite of "
        "Bell-LaPadula's \"no write down\"?",
        [("They protect opposite properties: Biba prevents low-integrity data "
          "contaminating trusted levels, while Bell-LaPadula prevents "
          "high-confidentiality data leaking to lower levels.", True),
         ("Biba was designed to correct an error in the Bell-LaPadula "
          "rules.", False),
         ("Biba applies to subjects while Bell-LaPadula applies to "
          "objects.", False),
         ("The models use opposite numbering, so 'up' in one means 'down' in "
          "the other.", False)],
        "The rules look contradictory only if you forget what each model is "
        "for. Confidentiality is threatened by information moving downward, so "
        "Bell-LaPadula forbids writing down. Integrity is threatened by "
        "untrusted data moving upward, so Biba forbids writing up. Both models "
        "govern subjects acting on objects, neither corrects the other, and "
        "the level numbering is consistent between them."),
    mcq("HARD",
        "A payments system lets the same employee both raise and approve a "
        "supplier payment.\n\nWhich principle is violated, and why does least "
        "privilege not address it?",
        [("Separation of duties; the employee may legitimately need both "
          "abilities in general, so restricting privilege does not stop one "
          "person completing a transaction alone.", True),
         ("Least privilege; the employee simply holds more permissions than "
          "necessary.", False),
         ("Fail-safe defaults; the system should have denied the second action "
          "by default.", False),
         ("Accountability; the log cannot attribute the payment to a "
          "person.", False)],
        "Separation of duties is specifically about splitting a sensitive "
        "transaction so no individual can complete it, which then makes fraud "
        "require collusion. Least privilege is about the SIZE of a grant "
        "rather than its combination, and each permission here may be "
        "individually justified for the role. Defaults and accountability are "
        "not the issue -- the actions are permitted and fully logged."),
    short_answer("EASY",
        "Which access control model assigns permissions to job functions "
        "rather than to individuals? Give the acronym.",
        "RBAC",
        ["rbac", "role-based access control", "role based access control"]),
    short_answer("AVERAGE",
        "Which security model enforces integrity with the rules \"no read "
        "down, no write up\"?",
        "Biba",
        ["biba", "biba model", "the biba model", "biba integrity model"]),
    descriptive("HARD",
        "Compare role-based and attribute-based access control, and describe a "
        "requirement that RBAC cannot express cleanly along with how a hybrid "
        "design would handle it.",
        "RBAC assigns permissions to roles and roles to users, so access "
        "derives from job function and nobody holds permissions directly. Its "
        "strength is administrative: the number of things to manage scales "
        "with the number of roles rather than the number of people, joiners "
        "and leavers become role assignments, and review is tractable because "
        "a role assignment can be read off a screen and confirmed by a manager "
        "who understands the job. ABAC instead evaluates a policy over "
        "attributes of the subject, the object, the action and the "
        "environment, so the decision can depend on the whole situation rather "
        "than on identity alone. Its strength is expressiveness and its "
        "weakness is auditability: answering 'who can actually reach this "
        "record?' requires evaluating policy across attribute combinations "
        "rather than reading a list, and an access control system nobody can "
        "reason about is its own kind of risk. A requirement RBAC cannot "
        "express cleanly is one involving a relationship between subject and "
        "object, or the environment: for example, that a nurse may read only "
        "the records of patients currently on their own ward, during a "
        "rostered shift, from a hospital device. Ward, shift and device are "
        "not properties of the job, so encoding them as roles produces a role "
        "per ward per shift, which multiplies beyond anything auditable -- "
        "role explosion. A hybrid handles it by keeping RBAC for the coarse "
        "decision and adding attribute rules for the fine one: the Nurse role "
        "grants the ability to open patient records at all, and an attribute "
        "policy then requires that the patient's ward matches the nurse's "
        "current assignment and that the request originates on the hospital "
        "network during their shift. The role list stays short and reviewable "
        "while the contextual condition lives in a single rule.",
        [("Correctly characterises RBAC and its administrative advantage", 3),
         ("Correctly characterises ABAC and its expressiveness/auditability "
          "trade-off", 3),
         ("Gives a requirement RBAC cannot express and a workable hybrid", 4)]),
]

LESSON_ACCESS = {
    "middle": MID_SEC_FUNDAMENTALS,
    "name": "Access Control Models",
    "quiz": _ac_quiz,
    "structure": lesson_structure(
        "Access Control Models",
        "Once a system knows who you are, it has to decide what you may do -- "
        "and that is a separate discipline with its own models and its own "
        "characteristic failures. This lesson covers the subject/object/"
        "operation vocabulary, the three principles that constrain every model "
        "and what each protects against, and then the four models in turn: "
        "discretionary, mandatory, role-based and attribute-based. It works "
        "through Bell-LaPadula and Biba and why their rules read as exact "
        "opposites, explains role explosion as the signal that a requirement "
        "is really attribute-based, and ends on the hybrid design most real "
        "systems settle on.",
        [
            "Use the subject, object and operation vocabulary precisely",
            "Explain least privilege, separation of duties and fail-safe "
            "defaults, and identify which a given failure breaches",
            "Distinguish discretionary from mandatory access control and state "
            "the weakness of each",
            "State the Bell-LaPadula and Biba rules and explain why they are "
            "opposites",
            "Explain RBAC and why its administration scales better than direct "
            "permission assignment",
            "Recognise role explosion and explain what it indicates",
            "Explain ABAC's four attribute categories and its auditability "
            "cost",
            "Distinguish access control lists from capabilities and say which "
            "question each makes cheap",
            "Design a hybrid RBAC/ABAC arrangement for a contextual "
            "requirement",
        ],
        60,
        _ac_sections,
        [
            ("Subject / object / operation",
             "The active requester, the resource acted on, and the action "
             "attempted. Every access decision concerns a triple of these."),
            ("Least privilege",
             "Granting the minimum access needed, so a compromised identity "
             "inherits as little as possible."),
            ("Separation of duties",
             "Splitting a sensitive transaction so no one subject can complete "
             "it alone, making fraud require collusion."),
            ("Fail-safe defaults",
             "Denying by default, so an omission produces a refusal somebody "
             "reports rather than an exposure nobody notices."),
            ("DAC",
             "Discretionary Access Control: the resource owner decides. "
             "Flexible, intuitive and ungoverned."),
            ("MAC",
             "Mandatory Access Control: a system-wide policy over clearances "
             "and classifications that owners cannot override."),
            ("Bell-LaPadula",
             "Confidentiality model: no read up, no write down -- secrets must "
             "not flow downward."),
            ("Biba",
             "Integrity model: no read down, no write up -- untrusted data "
             "must not flow upward."),
            ("RBAC",
             "Role-Based Access Control: permissions to roles, roles to users. "
             "Administration scales with roles rather than people."),
            ("Role explosion",
             "Proliferation of narrow roles encoding context, indicating the "
             "requirement was really attribute-based."),
            ("ABAC",
             "Attribute-Based Access Control: policy evaluated over subject, "
             "object, action and environment attributes."),
            ("ACL / capability",
             "The access matrix stored by object or by subject respectively; "
             "each makes a different question cheap and the other expensive."),
        ],
        "Access control decides what an authenticated identity may do, and "
        "three principles constrain every model that implements it: least "
        "privilege limits the damage when an account is compromised, "
        "separation of duties makes fraud require collusion rather than one "
        "bad decision, and deny-by-default turns an omission into a complaint "
        "rather than a breach. DAC leaves the decision with the owner and is "
        "therefore only as consistent as each owner's judgement -- and malware "
        "inherits that judgement. MAC removes discretion entirely in favour of "
        "clearances and classifications. Bell-LaPadula and Biba state opposite "
        "rules because they protect opposite things: secrets must not flow "
        "down, and untrusted data must not flow up. RBAC dominates business "
        "systems because administration scales with the number of roles rather "
        "than the number of people, and the moment you find yourself creating "
        "a role per ward per shift, the requirement was contextual and belongs "
        "in ABAC -- which expresses it in one rule at a real cost in "
        "auditability. Most real systems therefore end up hybrid: roles for "
        "the coarse decision, attributes for the conditional one."),
}

LESSONS = [LESSON_AUTH, LESSON_ACCESS]
