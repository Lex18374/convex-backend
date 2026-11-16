# /// script
# requires-python = ">=3.11"
# dependencies = ["PyYAML==6.0.3"]
# ///
"""Verify the complete workspace lock against the unpatched base commit."""

import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

import yaml

workspace = Path(__file__).resolve().parent.parent
base_ref = sys.argv[1]
base = yaml.safe_load(
    subprocess.check_output(
        ["git", "show", f"{base_ref}:npm-packages/pnpm-lock.yaml"], cwd=workspace
    )
)
lock_text = (workspace / "pnpm-lock.yaml").read_text()
lock = yaml.safe_load(lock_text)
config = yaml.safe_load((workspace / "pnpm-workspace.yaml").read_text())
patch = "patches/decode-uri-component@0.2.2.patch"
digest = hashlib.sha256((workspace / patch).read_bytes()).hexdigest()
assert config["patchedDependencies"] == {"decode-uri-component@0.2.2": patch}
assert lock["patchedDependencies"] == {"decode-uri-component@0.2.2": digest}

# The workspace lists explicit directories. Include the root importer as pnpm does.
expected = {".", *config["packages"]}
assert set(lock["importers"]) == expected == set(base["importers"])
for importer in expected:
    assert (workspace / importer / "package.json").is_file(), importer
assert lock["importers"] == base["importers"]
decoder_keys = [key for key in lock["snapshots"] if key.startswith("decode-uri-component@")]
assert decoder_keys == [f"decode-uri-component@0.2.2(patch_hash={digest})"]
assert lock["snapshots"]["query-string@7.1.3"]["dependencies"]["decode-uri-component"] == f"0.2.2(patch_hash={digest})"

# Removing only the native patch annotation must recover the complete base lock.
normalized = re.sub(r"\(patch_hash=" + digest + r"\)", "", lock_text)
normalized = yaml.safe_load(normalized)
del normalized["patchedDependencies"]
assert normalized == base, "Unrelated lock changes detected"
print(json.dumps({"importers": len(expected), "patch_sha256": digest, "unrelated_changes": 0}))
