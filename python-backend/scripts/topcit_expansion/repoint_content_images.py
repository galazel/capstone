"""Repoints the content modules at the drawn figures.

The lessons in the database already point at the local SVGs, but the modules
they were seeded from still name the dead hotlinks. Leaving that mismatch in
place means the next person to reseed silently reintroduces broken images, so
the source has to move with the data.

Each module declares its pictures as named constants, which makes this a
straight substitution: the constant becomes a root-relative path, and the
`image(...)` call loses the source arguments, because a figure we drew has
nothing external to credit.

Usage:
    python repoint_content_images.py            # dry run
    python repoint_content_images.py --apply
"""

import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

#: Image constant -> the slug of the drawn figure that replaces it.
CONSTANTS = {
    "OSI_DIAGRAM": "osi-reference-model",
    "ENCAP_DIAGRAM": "encapsulation",
    "MAC_DIAGRAM": "mac-address-structure",
    "IPV4_DIAGRAM": "ipv4-address-classes",
    "IEEE802_DIAGRAM": "ieee-802-family",
    "CSMA_DIAGRAM": "csma-cd",
    "DEVICES_DIAGRAM": "devices-by-layer",
    "VLAN_DIAGRAM": "vlan-segmentation",
    "SUBNET_DIAGRAM": "subnet-mask",
    "MASK_DIAGRAM": "cidr-block-sizes",
    "ROUTING_DIAGRAM": "distance-vector",
    "OSPF_DIAGRAM": "link-state-areas",
    "SDN_DIAGRAM": "sdn-central-idea",
    "NFV_DIAGRAM": "nfv",
    "LEAFSPINE_DIAGRAM": "leaf-spine",
    "VXLAN_DIAGRAM": "vxlan",
    "EPC_DIAGRAM": "4g-core",
    "SLICING_DIAGRAM": "network-slicing",
    "SYMMETRIC_DIAGRAM": "symmetric-encryption",
    "ASYMMETRIC_DIAGRAM": "asymmetric-encryption",
    "HASH_DIAGRAM": "hash-function",
    "SIGNATURE_DIAGRAM": "digital-signature",
    "PKI_DIAGRAM": "pki-trust-chain",
    "AC_DIAGRAM": "access-control-models",
    "STRIDE_DIAGRAM": "stride",
    "KILLCHAIN_DIAGRAM": "attack-chain",
    "VULN_DIAGRAM": "vulnerability-cycle",
    "RTO_DIAGRAM": "rto-rpo",
    "BACKUP_DIAGRAM": "backup-strategies",
    "POLICY_DIAGRAM": "policy-hierarchy",
    "IR_DIAGRAM": "incident-response",
    "SIEM_DIAGRAM": "siem",
    "ERP_DIAGRAM": "erp-shared-database",
    "SCM_DIAGRAM": "supply-chain",
    "EA_DIAGRAM": "enterprise-architecture",
    "SDLC_DIAGRAM": "total-cost-of-ownership",
    "OUTSOURCE_DIAGRAM": "outsourcing-drivers",
}

PATH = '"/lesson-media/%s.svg"'


def rewrite(source):
    changed = 0

    # The constant is a parenthesised split string; collapse it to one path.
    for name, slug in CONSTANTS.items():
        pattern = re.compile(r"^%s = \([^)]*\)\s*$" % re.escape(name), re.MULTILINE)
        replacement = "%s = %s" % (name, PATH % slug)
        source, count = pattern.subn(replacement, source)
        changed += count

        simple = re.compile(r'^%s = "[^"]*"\s*$' % re.escape(name), re.MULTILINE)
        source, count = simple.subn(replacement, source)
        changed += count

    # A figure we drew has no external source to credit.
    source, calls = re.subn(
        r"image\((\w+_DIAGRAM),\s*\w+_SOURCE,\s*\"[^\"]*\"\)",
        r"image(\1)",
        source,
    )

    # The now-unused source constants would fail lint and confuse the next reader.
    source = re.sub(r"^\w+_SOURCE = \([^)]*\)\s*\n", "", source, flags=re.MULTILINE)
    source = re.sub(r'^\w+_SOURCE = "[^"]*"\s*\n', "", source, flags=re.MULTILINE)

    return source, changed, calls


def main():
    apply = "--apply" in sys.argv
    total_constants = total_calls = 0

    for filename in sorted(os.listdir(HERE)):
        if not filename.startswith("content_") or not filename.endswith(".py"):
            continue
        path = os.path.join(HERE, filename)
        original = io.open(path, encoding="utf-8").read()
        updated, constants, calls = rewrite(original)
        if updated == original:
            continue
        total_constants += constants
        total_calls += calls
        print("  %-26s %d constant(s), %d image call(s)" % (filename, constants, calls))
        if apply:
            io.open(path, "w", encoding="utf-8").write(updated)

    print("\n%d constant(s), %d image call(s)%s"
          % (total_constants, total_calls, "" if apply else "   (dry run)"))


if __name__ == "__main__":
    main()
