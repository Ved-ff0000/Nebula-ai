# Live verification (build d45f88f)
Ran a real task against the live backend. Status `COMPLETED`.
## Timeline
- **[status]** Task created — ready to start.
- **[plan]** Plan: Open the permitted listings page, read the opportunities, extract requirements, compare them against the profile in your goal, and sum
- **[action]** Open the target page
- **[action]** Opened http://localhost:8000 (http://localhost:8000/demo/internships)
- **[navigation]** Now on http://localhost:8000
- **[action]** Gather more page context
- **[action]** Read page "ML Internships — Hyderabad" (4 interactive elements)
- **[result]** Task completed. Evidence: 2 verified actions, 1 pages read, origins=['http://localhost:8000'].
- **[status]** Browser session closed and cleaned up.

## Live `/api/health`
```json
{
  "status": "ok",
  "service": "nebula-backend",
  "version": "1.0.0",
  "llm_provider": "heuristic",
  "build": {
    "commit": "d45f88f",
    "dirty": false,
    "started_at": "2026-09-13T09:06:59+00:00",
    "uptime_seconds": 227,
    "diagnostics_revision": 2,
    "features": [
      "browser_diagnostics_v1",
      "actionable_launch_errors",
      "build_identification"
    ],
    "source": "git"
  },
  "browser_connected": true,
  "browser": {
    "driver_running": true,
    "environment_ok": true,
    "installed": true,
    "problem": null,
    "remedy": null
  }
}
```
