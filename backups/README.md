# backups/

Future backup destination for the whole `tcg_master_project` repo.

- Snapshot contents are **local-only** (gitignored here — everything under `backups/` except this README).
- Version-control history in git is the durable backup for the code; keep big local snapshots (full-project copies that contain old API keys) out of the remote.
- The web-prototype checkpoint tooling lives at `tcg-web-prototype/backups/create-checkpoint.ps1`, `verify-checkpoint.ps1`, `restore-checkpoint.ps1` and is committed (referenced by `AGENTS.md` workflow).