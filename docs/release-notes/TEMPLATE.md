# Release-notes template

The canonical, machine-read template lives at
[`.github/RELEASE-NOTES-TEMPLATE.md`](../../.github/RELEASE-NOTES-TEMPLATE.md)
(single source of truth — the release workflow uses it as the release-body
header when no tag-specific notes exist). Do not duplicate or edit the section
structure here; the six mandatory sections are defined there.

## Authoring per-tag notes

To author human release notes for a tag (used by the workflow as the full
release body when present, and committed for the record):

1. Copy `.github/RELEASE-NOTES-TEMPLATE.md` to `docs/release-notes/<tag>.md`
   — the filename must be exactly the tag name, e.g. `v1.0.0.md`.
2. Replace every `{PLACEHOLDER}`; keep all six mandatory sections.
3. Commit on the release branch before the tag is pushed.
