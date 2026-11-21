# CLAUDE.md

All project rules live in AGENTS.md (shared with the other AI tools). They are imported here:

@AGENTS.md

## Claude Code specifics

- Never run `git commit` or `git push` in this project unless the owner explicitly asks. Leave changes uncommitted.
- Start each session by reading `PLAN.md` §12 to find the next unticked goal.
- Verify each goal's "done when" checks by running them (Bash, starting the app, calling endpoints) before ticking the box or saying it is done.
- Use the scratchpad directory for throwaway scripts and test output, not the repo.
- Load `.env` only inside commands (`set -a; source .env; set +a`) and never echo secret values; print "set / empty" or lengths instead.
