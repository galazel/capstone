"""Finds lesson sections that render as a heading with nothing underneath.

The first section of a lesson is the title block and is empty by convention.
Any other empty section is a defect -- usually the result of splitting a
section at the wrong point.
"""

import importlib
import sys

sys.path.insert(0, "/app")
sys.path.insert(0, "/app/scripts/topcit_expansion")

import glob
import os

# Discovered rather than listed: a batch added later would otherwise never be
# checked, which is exactly when the check is most useful.
BATCHES = sorted(
    os.path.basename(path)[len("content_"):-len(".py")]
    for path in glob.glob("/app/scripts/topcit_expansion/content_*.py"))

problems = 0
for batch in BATCHES:
    module = importlib.import_module("content_%s" % batch)
    for spec in module.LESSONS:
        for index, section in enumerate(spec["structure"]):
            if index == 0:
                continue
            if not section.get("content"):
                problems += 1
                print("  %-14s %-52s empty: %s"
                      % (batch, spec["name"][:52], section["sectionName"]))

print("\n%d empty section(s)" % problems)
