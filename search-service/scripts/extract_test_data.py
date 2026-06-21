#!/usr/bin/env python3
"""
Extract a DwCA sub-archive for the Macropus (kangaroo) subtree, plus all ancestor taxa
needed for the hierarchy rk_* fields, from the full AFD DwCA at /data/bie/2025/.

Target taxonConceptID: https://biodiversity.org.au/afd/taxa/501c3628-1686-40b0-b291-2c09422c787b

Run from the search-service/src/test/resources/dwca-test/ directory (or set SCRIPT_DIR).
Output goes directly into this directory:
  dwca-index/   — valid DwC-Archive directory (contains one archive as a subdir, as
                  required by DwCAImportService which iterates subdirectories of dwca.dir)
  lsid-vernacularName.csv
  lsid-left-right.csv

Source data (not committed):
  /data/bie/2025/               — full DwCA
  /data/search-service/data/    — supplemental CSVs
"""

import csv
import shutil
import os
from collections import defaultdict

# dwca names index
SRC_DIR = "/data/bie/2025"

# lucene names index extracts
VERNACULAR_SRC = "/data/search-service/data/lsid-vernacularName25.csv"
LEFT_RIGHT_SRC = "/data/search-service/data/lsid-left-right25.csv"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(SCRIPT_DIR, "dwca-index")
TEST_RESOURCES = SCRIPT_DIR
TARGET_CONCEPT_ID = "https://biodiversity.org.au/afd/taxa/501c3628-1686-40b0-b291-2c09422c787b"

def read_tsv_positional(path):
    """Read a tab-separated file, return (headers_list, rows_as_lists).
    Preserves duplicate column names and all positional data.
    """
    all_rows = []
    with open(path, encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        headers = next(reader)
        for row in reader:
            all_rows.append(row)
    return headers, all_rows

def read_tsv(path):
    """Read a tab-separated file, return (headers, rows_as_dicts).
    Note: if duplicate column names exist (e.g. taxonID appears twice),
    we use positional reader and manual header assignment to avoid DictReader
    collapsing duplicates.
    """
    rows = []
    with open(path, encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        headers = next(reader)
        for row in reader:
            # Build dict; for duplicate keys the first occurrence wins (col 0 = coreid)
            d = {}
            for i, (h, v) in enumerate(zip(headers, row)):
                if h not in d:
                    d[h] = v
            rows.append(d)
    return rows

def write_tsv(path, headers, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers, delimiter="\t",
                                extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

def write_tsv_positional(path, headers, rows):
    """Write positional (list-of-lists) rows, preserving duplicate column names."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter="\t", lineterminator="\n")
        writer.writerow(headers)
        writer.writerows(rows)

print("Reading taxon.txt ...")
taxon_rows = read_tsv(f"{SRC_DIR}/taxon.txt")

# Index by taxonID and taxonConceptID
by_taxon_id = {}
by_concept_id = {}
children_of = defaultdict(list)  # parentNameUsageID -> [taxonID, ...]
synonyms_of = defaultdict(list)  # acceptedNameUsageID -> [taxonID, ...]

for row in taxon_rows:
    tid = row["taxonID"]
    by_taxon_id[tid] = row
    cid = row.get("taxonConceptID", "")
    if cid:
        by_concept_id[cid] = row
    parent = row.get("parentNameUsageID", "")
    if parent:
        children_of[parent].append(tid)
    accepted = row.get("acceptedNameUsageID", "")
    if accepted and accepted != tid:
        synonyms_of[accepted].append(tid)

# Find target row by taxonConceptID
target_row = by_concept_id.get(TARGET_CONCEPT_ID)
if not target_row:
    # Try by taxonID directly
    target_row = by_taxon_id.get(TARGET_CONCEPT_ID)
if not target_row:
    raise ValueError(f"Target taxonConceptID {TARGET_CONCEPT_ID} not found")

target_id = target_row["taxonID"]
print(f"Found target: {target_row['scientificName']} ({target_id})")

# Collect ancestors (walk parentNameUsageID up)
ancestor_ids = []
current = target_row
while True:
    parent_id = current.get("parentNameUsageID", "")
    if not parent_id or parent_id == current["taxonID"] or parent_id not in by_taxon_id:
        break
    ancestor_ids.append(parent_id)
    current = by_taxon_id[parent_id]
print(f"Ancestors: {len(ancestor_ids)}")

# Collect descendants (BFS via parentNameUsageID)
descendant_ids = []
queue = [target_id]
visited = {target_id}
while queue:
    current_id = queue.pop(0)
    for child_id in children_of.get(current_id, []):
        if child_id not in visited:
            visited.add(child_id)
            descendant_ids.append(child_id)
            queue.append(child_id)
print(f"Descendants: {len(descendant_ids)}")

# Collect synonyms for all accepted taxa in our set
all_accepted_ids = {target_id} | set(descendant_ids)
synonym_ids = []
for acc_id in all_accepted_ids:
    for syn_id in synonyms_of.get(acc_id, []):
        if syn_id not in visited:
            synonym_ids.append(syn_id)
print(f"Synonyms: {len(synonym_ids)}")

# All taxon IDs to include
all_taxon_ids = set([target_id] + ancestor_ids + descendant_ids + synonym_ids)
print(f"Total taxon rows to include: {len(all_taxon_ids)}")

selected_taxons = [by_taxon_id[tid] for tid in all_taxon_ids if tid in by_taxon_id]
taxon_headers = list(taxon_rows[0].keys()) if taxon_rows else []

# Write taxon.txt
write_tsv(f"{OUT_DIR}/taxon.txt", taxon_headers, selected_taxons)
print(f"Written {len(selected_taxons)} taxon rows -> {OUT_DIR}/taxon.txt")

# --- Extensions ---
for ext_file, id_col_idx in [
    # id_col_idx: positional index of the coreid column (0 for all extension files)
    ("vernacularname.txt", 0),
    ("identifier.txt", 0),
    ("taxonvariant.txt", 0),
    ("rightsholder.txt", None),   # no coreid filter, include all
    ("distribution.txt", 0),
]:
    src = f"{SRC_DIR}/{ext_file}"
    if not os.path.exists(src):
        print(f"  Skipping {ext_file} (not found)")
        continue

    headers, rows = read_tsv_positional(src)

    if id_col_idx is None:
        # Keep all rows
        filtered = rows
    else:
        filtered = [r for r in rows if len(r) > id_col_idx and r[id_col_idx] in all_taxon_ids]

    write_tsv_positional(f"{OUT_DIR}/{ext_file}", headers, filtered)
    print(f"Written {len(filtered)} rows -> {OUT_DIR}/{ext_file}")

# --- Copy meta.xml and eml.xml ---
shutil.copy(f"{SRC_DIR}/meta.xml", f"{OUT_DIR}/meta.xml")
shutil.copy(f"{SRC_DIR}/eml.xml",  f"{OUT_DIR}/eml.xml")
print(f"Copied meta.xml and eml.xml -> {OUT_DIR}/")

# --- Extract matching rows from lsid-vernacularName25.csv (no header) ---
print("Extracting lsid-vernacularName25.csv ...")
vn_rows_out = []
with open(VERNACULAR_SRC, encoding="utf-8") as f:
    reader = csv.reader(f)
    for row in reader:
        if row and row[0].strip('"') in all_taxon_ids:
            vn_rows_out.append(row)

vn_out_path = f"{TEST_RESOURCES}/lsid-vernacularName.csv"
os.makedirs(os.path.dirname(vn_out_path), exist_ok=True)
with open(vn_out_path, "w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f)
    writer.writerows(vn_rows_out)
print(f"Written {len(vn_rows_out)} vernacular rows -> {vn_out_path}")

# --- Extract matching rows from lsid-left-right25.csv (no header) ---
print("Extracting lsid-left-right25.csv ...")
lr_rows_out = []
with open(LEFT_RIGHT_SRC, encoding="utf-8") as f:
    reader = csv.reader(f)
    for row in reader:
        if row and row[0].strip('"') in all_taxon_ids:
            lr_rows_out.append(row)

lr_out_path = f"{TEST_RESOURCES}/lsid-left-right.csv"
with open(lr_out_path, "w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f)
    writer.writerows(lr_rows_out)
print(f"Written {len(lr_rows_out)} left-right rows -> {lr_out_path}")

# --- Summary ---
print("\n=== Summary ===")
print(f"DwCA archive:     {OUT_DIR}/")
print(f"Vernacular CSV:   {vn_out_path}")
print(f"Left-right CSV:   {lr_out_path}")
print(f"Taxon IDs in set: {sorted(all_taxon_ids)}")
print("\nDone.")
