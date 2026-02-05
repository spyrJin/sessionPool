---
module: SessionPool
date: 2026-01-15
problem_type: developer_experience
component: tooling
symptoms:
  - "clasp push succeeds but code changes not taking effect in spreadsheet"
  - "Old bugs persist despite deploying fixes"
  - "Error messages reference variable names not in current code"
root_cause: config_error
resolution_type: config_change
severity: high
tags: [clasp, deployment, google-apps-script, bound-script, configuration]
---

# Troubleshooting: Clasp Script ID Mismatch - Deploying to Wrong Project

## Problem
After fixing a bug (`newSs.setSharing is not a function`) and deploying with `clasp push`, the error persisted. The deployed code was correct but the spreadsheet kept running old buggy code — because `.clasp.json` pointed to a standalone script, not the bound script attached to the spreadsheet.

## Environment
- Module: SessionPool
- Affected Component: `.clasp.json` / clasp CLI tooling
- Date: 2026-01-15

## Symptoms
- `clasp push` reported success
- `clasp pull` showed the correct fixed code
- But the spreadsheet still threw the old error (`newSs.setSharing is not a function`)
- Error messages referenced variable names that no longer existed in the code

## What Didn't Work

**Attempted Solution 1:** Fix the `setSharing` API call and redeploy
- **Why it failed:** The code fix was correct (`DriveApp.getFileById(id).setSharing()` instead of `newSs.setSharing()`), but it deployed to the wrong script project. The spreadsheet was still running old code from its bound script.

## Solution

Google Sheets can have **two types** of Apps Script projects:

1. **Bound scripts**: Created via Extensions > Apps Script, attached to the spreadsheet
2. **Standalone scripts**: Independent projects that can access spreadsheets via ID

The `.clasp.json` was configured with a standalone script ID, but the spreadsheet was running a bound script with a different ID.

**Diagnosis steps:**

1. Open the spreadsheet → Extensions → Apps Script
2. Check the URL — it contains the bound script ID:
   ```
   https://script.google.com/u/0/home/projects/[SCRIPT_ID]/edit
   ```
3. Compare with `.clasp.json` — if they don't match, you're deploying to the wrong project.

**Config change:**

```json
// Before (wrong — standalone script ID):
{
  "scriptId": "1BBNfUU37Bqvel_UaWPD-snKzAU6Oc2b4U-mKVn9ul0Qlv9KnHp1mijEQ",
  "rootDir": "./gas"
}

// After (correct — bound script ID):
{
  "scriptId": "1tK5JFe49h0JBkspunM3V0DM5_JsJtWbtfw6t9Pn4Hj1Pd4dEcmHjBY5I",
  "rootDir": "./gas"
}
```

**Commands run:**

```bash
# Remove any pulled .js files that conflict with .gs
rm gas/*.js

# Force push to the correct project
clasp push --force
```

## Why This Works

1. **Root cause:** `.clasp.json` `scriptId` pointed to a standalone Apps Script project, not the bound script attached to the spreadsheet. Every `clasp push` deployed code to the wrong project.
2. **The fix:** Updating `scriptId` to match the bound script ensures deployments reach the code the spreadsheet actually executes.
3. **Underlying issue:** When initially setting up clasp, `clasp clone` was used with the wrong project ID. Google's dual script model (bound vs standalone) makes this easy to mix up.

## Key Gotchas

1. **Manifest conflict**: When switching script IDs, use `--force` flag to override "Manifest file has been updated" prompts.
2. **File name conflicts**: The target project may have `.js` versions while you have `.gs`. Delete local `.js` files before pushing.
3. **Custom menus require reload**: After deploying, reload the spreadsheet for `onOpen` menus to pick up new code.
4. **Bound vs Standalone behavior**:
   - Bound scripts: `getActiveSpreadsheet()` returns the parent sheet
   - Standalone scripts: `getActiveSpreadsheet()` returns `null` unless called from a trigger

## Prevention

- **Always use bound script**: When setting up clasp for an existing spreadsheet, run `clasp clone [BOUND_SCRIPT_ID]` (get the ID from Extensions > Apps Script URL)
- **Document the script ID**: Add a `_comment` field in `.clasp.json` noting which spreadsheet it's bound to
- **Verify after setup**: Always compare the `.clasp.json` scriptId with the URL in Extensions > Apps Script

## Related Issues

- [clasp documentation](https://github.com/google/clasp)
- [Bound vs Standalone Scripts](https://developers.google.com/apps-script/guides/bound)
