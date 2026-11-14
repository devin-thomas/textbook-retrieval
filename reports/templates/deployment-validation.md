# Textbook Desk deployment validation

- Date/time:
- Commit:
- Operator:
- App host:
- Ollama host:
- Tailnet URL:

## Configuration evidence

- [ ] `Manage-StartupTasks.ps1 -Action Inspect` shows both tasks installed and healthy.
- [ ] `Manage-TailscaleServe.ps1 -Action Inspect` shows any existing root (`/`) mapping unchanged.
- [ ] Serve status shows `/textbooks -> http://127.0.0.1:8766/textbooks`.
- [ ] `Test-Deployment.ps1` reports both scheduled tasks `Running` and every Serve mapping check `PASS`.
- [ ] Ports `8766` and `11435` show only `SAFE` loopback listeners; no `0.0.0.0`, `::`, or LAN-address binding is present.
- [ ] No API keys, dotenv contents, or textbook excerpts are copied into this report.

## Reproducible smoke check

Command (add `-RootTarget 'http://127.0.0.1:<port>'` if another app is served at `/` and must stay reachable):

```powershell
.\scripts\Test-Deployment.ps1 -TailnetUrl 'https://<machine>.<tailnet>.ts.net'
```

Result:

```text
Paste the PASS/FAIL table here. It contains endpoints and status codes, not secrets.
```

`-SkipConfigurationChecks` is for pre-install local diagnostics only. Do not use it for the final deployment check recorded here.

## Query scenarios

| Scenario | Result | Evidence |
| --- | --- | --- |
| NVIDIA explicit succeeds without switching |  |  |
| Ollama explicit succeeds without switching |  |  |
| Auto uses NVIDIA when NVIDIA succeeds |  |  |
| Auto falls back only after a controlled NVIDIA provider failure |  |  |
| Unsupported textbook question abstains before generation |  |  |
| Citation opens the allowlisted PDF at the exact physical page |  |  |

## Client acceptance

| Client | Result | Notes |
| --- | --- | --- |
| App host loopback |  |  |
| Desktop tailnet browser |  |  |
| 390 px emulated viewport |  |  |
| Physical phone over tailnet | Not run / Pass / Fail | Keep physical-device acceptance separate from emulation. |

## Rollback rehearsal

- [ ] `Manage-TailscaleServe.ps1 -Action Rollback -WhatIf` targets only `/textbooks`.
- [ ] `Manage-StartupTasks.ps1 -Action Remove -WhatIf` targets only the two Textbook Desk tasks.
- [ ] Any existing root (`/`) app remains reachable after a real rollback.

## Open risks

- None / list remaining risks and owner.
