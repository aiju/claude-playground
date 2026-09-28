# Agent instructions

This repo is a collection of small, independent projects, mostly written by Claude. These rules apply to all of them.

## Projects and folders

- Every project gets its own top-level folder. Don't put project files in the repo root, and don't touch another project's folder unless the task is about that project.
- Folder names are lowercase and hyphen-separated, and they say what the project is: `sudoku-solver`, `tube-map-quiz`, `pixel-weather`. Don't use generic names like `test`, `demo`, `app`, `project` or `music`. Check that no existing folder has the same name or one that's easy to confuse with it.
- Keep each project self-contained: its own dependency files (`package.json`, `requirements.txt`, …), its own `.gitignore` if it needs one, and no imports from other projects' folders.
- Each project has a `README.md` that says what it is and how to run or build it.
- When you add a project, add a row for it to the table in the root `README.md`, keeping the table sorted by folder name.

## Git

- Everything ends up in `main`. Start your branch from the latest `main`, and when the work is done, open a pull request against `main`. Leave merging to the user.
- Don't target other feature branches or stack PRs on top of each other.
- Keep each commit and PR to one project.

## Big files

Git history is permanent, so a big file stays in every clone even after it's been deleted.

- Never commit dependencies or build output (`node_modules/`, virtualenvs, `dist/`, `build/`, `out/`, caches). The root `.gitignore` covers the most common ones; add anything project-specific to the project's own `.gitignore`.
- Don't commit anything that can be regenerated from the code, unless it's the point of the project (for example the rendered track of a music project). In that case commit a compressed version: mp3 rather than wav, png or webp at a sensible resolution.
- Keep every file under 10 MB. If something needs to be bigger, ask the user first.
- No datasets, model weights, videos, archives or disk images.
- Before committing, check `git diff --cached --stat` for anything unexpectedly large.
