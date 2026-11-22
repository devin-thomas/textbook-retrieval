# textbook-retrieval

Textbook Desk is a small web app for asking questions about your own PDF textbooks. It indexes each PDF page by page, finds the passages that best match a question, and asks a language model to answer only from those passages. Every answer cites the textbook and page it came from, and a citation opens the PDF at that exact page. If the indexed books do not support an answer, the app says so instead of calling a model.

The backend is FastAPI with SQLite (full-text search plus stored embeddings). The frontend is React built with Vite. Optional PowerShell scripts run the app as a pair of Windows scheduled tasks and publish it to your tailnet with Tailscale Serve.

## How it works

- **Ingestion** reads every PDF listed in `config/sources.json`, extracts text per physical page (keeping printed page labels where the PDF has them), splits it into chunks, and stores the chunks, their embeddings and a full-text index in `data/textbook-desk.sqlite3`.
- **Retrieval** combines embedding similarity (Ollama embeddings) with SQLite full-text search and keeps the top chunks. Questions that clearly fall outside static textbook content (your grades, exam dates, instructor contact details, the latest version of something) are rejected before any model is called. If the embedding model is unreachable, retrieval falls back to keyword search for that request and the UI says so.
- **Answering** goes to one of two providers:
  - **NVIDIA**: a hosted, OpenAI-compatible endpoint (`integrate.api.nvidia.com`). Needs an API key.
  - **Ollama**: a local model on a machine you control.
  - **Auto** (the default) tries NVIDIA first and falls back to Ollama only when NVIDIA fails.
- **History** of questions and answers is kept in the same local SQLite database. It can be searched, filtered, and deleted from the UI.

The app serves its UI and API under the `/textbooks` path (for example `http://127.0.0.1:8766/textbooks/`) and binds to loopback only.

## Requirements

- Python 3.12. The pinned `pydantic` release has no prebuilt wheel for Python 3.14, so installing there needs a Rust toolchain to compile `pydantic-core`.
- Node.js 20.19 or 22.12 and later, with npm, to build the frontend.
- [Ollama](https://ollama.com) on this machine or on another machine you can reach over SSH, with these models pulled:
  - `qwen3-embedding:4b` (embeddings, required for semantic retrieval)
  - `qwen3.5:9b` (answers when the Ollama provider is used)
- Optional: an NVIDIA API key from [build.nvidia.com](https://build.nvidia.com) for the NVIDIA provider.
- Optional, for the scripts in `scripts/`: Windows with Windows PowerShell 5.1, the OpenSSH client, the Tailscale CLI, and the `TailscaleServe` PowerShell module from [ps-kit](https://github.com/uppercut-labs/ps-kit) (copy `packages/tailscale-serve/TailscaleServe` into a folder on `$env:PSModulePath`, or set `PS_KIT` to a clone of that repository).

Model names, the embedding dimension and the endpoints can all be changed in `.env`.

## Setup

1. Get the code:

   ```sh
   git clone <repository-url> textbook-retrieval
   cd textbook-retrieval
   ```

2. Create your configuration file and fill in what you need:

   ```sh
   cp .env.example .env
   ```

   `.env` is ignored by git. Set `NVIDIA_API_KEY` here if you use NVIDIA, or set `NVIDIA_DOTENV_PATH` to an absolute path of another ignored dotenv file that contains `NVIDIA_API_KEY=...`. Set `OLLAMA_BASE_URL` to wherever Ollama answers; the default `http://127.0.0.1:11435` is the local end of the SSH tunnel described below. Use `http://127.0.0.1:11434` if Ollama runs on the same machine.

3. Add your textbooks:
   - Copy your PDFs into the repository root. `*.pdf` is ignored by git.
   - Edit `config/sources.json`. Each course has an `id` and a `name`. Each source has an `id`, a `title`, the PDF's plain `file_name`, and the `course_ids` it belongs to. The file in the repository is an example with four placeholder books.
   - Edit `frontend/src/catalog.ts` so its `COURSES` list matches the courses in `config/sources.json`. The scope picker and the history filter read courses from there; textbook titles come from the API.

4. Install the backend into a virtual environment:

   ```sh
   python3.12 -m venv .venv
   .venv/bin/pip install -e '.[dev]'
   ```

   On Windows: `py -3.12 -m venv .venv`, then `.venv\Scripts\pip install -e ".[dev]"`. Leave out `[dev]` if you do not need the test tools.

5. Build the frontend:

   ```sh
   cd frontend
   npm ci
   npm run build
   cd ..
   ```

   On Windows, `.\scripts\Setup-TextbookRetrieval.ps1 -IncludeDevDependencies` does steps 4 and 5 in one go. Add `-WhatIf` to see what it would do first.

6. Index the textbooks (Ollama must be reachable at `OLLAMA_BASE_URL`):

   ```sh
   set -a; . ./.env; set +a
   .venv/bin/python -m textbook_retrieval.ingest
   ```

   Add `--force` to rebuild books that are already indexed, or `--source <id>` to index one book. A summary is written to `reports/generated/ingestion.json`. On Windows: `.\scripts\Invoke-Ingestion.ps1` (add `-Rebuild` to force), which loads `.env` for you.

## Run

Start the server from the repository root:

```sh
set -a; . ./.env; set +a
.venv/bin/python -m uvicorn textbook_retrieval.app:app --host 127.0.0.1 --port 8766
```

Then open `http://127.0.0.1:8766/textbooks/`.

On Windows, `.\scripts\Start-TextbookRetrieval.ps1` does the same, loads `.env`, and refuses any bind address other than `127.0.0.1`. Use `-Reload` while developing and `-NvidiaDotEnvPath <path>` to point at a separate key file.

For frontend work, run the API as above and start Vite in `frontend/` with `npm run dev`. Vite serves `http://127.0.0.1:5173/textbooks/` and proxies `/textbooks/api` to port 8766.

### Batch questions

`textbook-quiz` (installed with the package) sends a file of questions to a running server and writes JSON and HTML results under `reports/generated/quiz`. Input can be JSON, CSV, TXT or Markdown; `quiz/questions.example.json` shows the JSON shape.

```sh
.venv/bin/textbook-quiz quiz/questions.example.json --requests-per-minute 6
```

On Windows: `.\scripts\Invoke-QuizMode.ps1 -InputPath quiz\questions.example.json`.

## Ollama on another machine over SSH

If Ollama runs on a different computer, keep it bound to that computer's loopback (`127.0.0.1:11434`) and reach it through an SSH local forward instead of opening its port to the network:

```sh
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:11435:127.0.0.1:11434 <ssh-host>
```

`<ssh-host>` is a host name or an alias from your `~/.ssh/config`. The app then talks to `http://127.0.0.1:11435`, which is the default `OLLAMA_BASE_URL`.

On Windows, `.\scripts\Start-OllamaTunnel.ps1 -SshHost <ssh-host>` starts the same tunnel with key-only authentication (`BatchMode=yes`), checks that the new listener is on loopback only, and stops the SSH process if anything else is listening on the port. The default `-SshHost` is `ollama-host`, so you can also add an `ollama-host` entry to your SSH config and omit the parameter.

## Start at sign-in on Windows

`scripts\Manage-StartupTasks.ps1` registers two scheduled tasks for the current user, `TextbookDesk-OllamaTunnel` and `TextbookDesk-App`, that start at sign-in and restart on failure:

```powershell
.\scripts\Manage-StartupTasks.ps1 -Action Install -OllamaSshHost <ssh-host>
.\scripts\Manage-StartupTasks.ps1 -Action Inspect
.\scripts\Manage-StartupTasks.ps1 -Action Restart
.\scripts\Manage-StartupTasks.ps1 -Action Remove
```

`Inspect` also lists the listeners on ports 8766 and 11435 and fails if any of them is bound to something other than loopback. Every action supports `-WhatIf`.

## Tailscale Serve

To use the app from your phone or other computers, publish it on your tailnet with [Tailscale Serve](https://tailscale.com/kb/1312/serve). Serve terminates HTTPS on the machine's tailnet name and proxies to the loopback server, so the app never has to listen on a network interface. It is reachable only by devices on your tailnet; do not use Tailscale Funnel for it.

```sh
tailscale serve --bg --https=443 --set-path=/textbooks http://127.0.0.1:8766/textbooks
```

The app is then at `https://<machine>.<tailnet>.ts.net/textbooks/`. Remove the mapping with `tailscale serve --https=443 --set-path=/textbooks off`.

On Windows, `.\scripts\Manage-TailscaleServe.ps1 -Action Install` (or `Inspect`, `Rollback`) does this and changes only the `/textbooks` path: the module reads the configuration back afterwards and fails if any other mapping, the root included, changed or if Funnel is on. `-RequireRoot 'http://127.0.0.1:<port>'` refuses to install unless the root maps to that target.

`.\scripts\Test-Deployment.ps1 -TailnetUrl 'https://<machine>.<tailnet>.ts.net'` checks the loopback listeners, both scheduled tasks, the Serve mapping, the local health and UI endpoints, the Ollama tunnel and the tailnet URL, and prints a PASS/FAIL table. If another app is served at `/` on the same machine, add `-RootTarget 'http://127.0.0.1:<port>'` to check that it is still mapped and reachable. `reports/templates/deployment-validation.md` is a checklist for recording a deployment check.

## Evaluate retrieval

`eval/questions.json` lists questions with the sources that should be retrieved, plus questions the app should decline. Replace it with questions about your own books, then run:

```sh
.venv/bin/python -m textbook_retrieval.evaluate
```

This needs an indexed database and Ollama. It writes `reports/generated/retrieval-evaluation.json` and `.md`. On Windows: `.\scripts\Invoke-RetrievalEvaluation.ps1`.

## Tests

Backend (no Ollama, NVIDIA or PDFs needed; the tests use fakes):

```sh
.venv/bin/python -m pytest
```

Frontend unit tests and type check:

```sh
cd frontend
npm test
npm run typecheck
```

Browser layout tests with Puppeteer start their own Vite server and use a mocked API. They need the browser Puppeteer downloads (`npx puppeteer browsers install chrome`):

```sh
npm run test:e2e
```

Screenshots go to the system temp folder, or to `PUPPETEER_ARTIFACT_DIR` if set. Each one is taken after CSS transitions have finished.

The browser tests include a layout audit. For every screen state (empty, loading, answered, evidence expanded, insufficient evidence, provider abstention, error, history drawer, book picker, confirm dialogs and so on) at every phone and desktop size, it checks from element rectangles that nothing is hidden behind a fixed layer, that open sheets, dialogs and drawers cover the page completely, that nothing scrolls sideways, and that text stays inside its boxes. Optional environment variables:

- `AUDIT_REPORT=1` lists every audit finding instead of stopping at the first.
- `AUDIT_SHOTS_DIR=<folder>` saves a screenshot of every audited state, at the start and the end of its scroll.
- `E2E_ONLY=<viewport name>` runs one viewport, for example `phone-390x844`.

PowerShell script tests (Windows PowerShell 5.1 or PowerShell 7):

```powershell
Get-ChildItem tests\operations\*.Tests.ps1 | ForEach-Object { & $_.FullName }
```

Each file prints a `PASS` line or throws on the first failed check.

## Configuration reference

All settings are environment variables, usually set in `.env`. Relative paths are resolved from the repository root.

| Variable | Default | Purpose |
| --- | --- | --- |
| `TEXTBOOK_CATALOG` | `config/sources.json` | Course and textbook list |
| `TEXTBOOK_DATABASE` | `data/textbook-desk.sqlite3` | Index and history database |
| `TEXTBOOK_INGESTION_REPORT` | `reports/generated/ingestion.json` | Ingestion summary |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11435` | Ollama endpoint |
| `OLLAMA_EMBEDDING_MODEL` | `qwen3-embedding:4b` | Embedding model |
| `OLLAMA_EMBEDDING_DIMENSION` | `2560` | Embedding size; must match the model |
| `OLLAMA_GENERATION_MODEL` | `qwen3.5:9b` | Answer model for the Ollama provider |
| `NVIDIA_BASE_URL` | `https://integrate.api.nvidia.com/v1` | NVIDIA endpoint |
| `NVIDIA_MODEL` | `nvidia/nemotron-3-super-120b-a12b` | NVIDIA answer model |
| `NVIDIA_API_KEY` | none | NVIDIA key |
| `NVIDIA_DOTENV_PATH` | none | Separate dotenv file to read `NVIDIA_API_KEY` from |
| `RETRIEVAL_SEMANTIC_CANDIDATES` | `24` | Embedding candidates per question |
| `RETRIEVAL_FTS_CANDIDATES` | `24` | Full-text candidates per question |
| `RETRIEVAL_FINAL_CHUNKS` | `8` | Chunks sent to the model |
| `RETRIEVAL_MIN_SEMANTIC_SCORE` | `0.35` (`.env.example` sets `0.18`) | Minimum similarity for a semantic match |
| `MAX_QUESTION_CHARS` | `4000` | Longest accepted question |

## License

Textbook Desk is released under the MIT License. See [LICENSE](LICENSE) for the full text.
