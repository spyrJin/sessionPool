---
title: "Clasp Script ID Mismatch - Deploying to Wrong Project"
problem_type: deployment
severity: high
date_solved: 2026-01-15
component: .clasp.json
affected_files:
  - .clasp.json
  - gas/DailyManager.gs
symptoms:
  - Code changes not taking effect after `clasp push`
  - Old bugs persist despite deploying fixes
  - Error messages reference old variable names not in current code
root_cause: ".clasp.json scriptId pointed to standalone script, not bound script attached to spreadsheet"
solution_summary: Updated .clasp.json to use the correct script ID from the spreadsheet's bound script
tags:
  - clasp
  - deployment
  - google-apps-script
  - configuration
  - bound-script
---

# Clasp Script ID Mismatch

## Problem

After fixing a bug (`newSs.setSharing is not a function`) and deploying with `clasp push`, the error persisted. The deployed code showed the fix was correct, but the spreadsheet kept running the old buggy code.

### Symptoms
- `clasp push` reported success
- `clasp pull` showed the correct fixed code
- But the spreadsheet still threw the old error
- Error messages referenced variable names that no longer existed in the code

## Root Cause

Google Sheets can have **two types** of Apps Script projects:

1. **Bound scripts**: Created via Extensions > Apps Script, attached to the spreadsheet
2. **Standalone scripts**: Independent projects that can access spreadsheets via ID

The `.clasp.json` was configured with a **standalone script ID**, but the spreadsheet was using a **bound script** with a different ID.

```json
// .clasp.json was pointing to WRONG project
{
  "scriptId": "1BBNfUU37Bqvel_UaWPD-snKzAU6Oc2b4U-mKVn9ul0Qlv9KnHp1mijEQ",
  "rootDir": "./gas"
}
```

## Diagnosis

### Step 1: Find the Bound Script ID

1. Open the spreadsheet in Google Sheets
2. Go to **Extensions > Apps Script**
3. Check the URL - it contains the script ID:
   ```
   https://script.google.com/u/0/home/projects/[SCRIPT_ID]/edit
   ```

### Step 2: Compare with .clasp.json

```bash
cat .clasp.json
```

If the IDs don't match, you're deploying to the wrong project.

## Solution

Update `.clasp.json` with the correct bound script ID:

```json
{
  "scriptId": "1tK5JFe49h0JBkspunM3V0DM5_JsJtWbtfw6t9Pn4Hj1Pd4dEcmHjBY5I",
  "rootDir": "./gas"
}
```

Then redeploy:

```bash
# Remove any pulled .js files that conflict
rm gas/*.js

# Force push to new project
clasp push --force
```

## Key Gotchas

1. **Manifest conflict**: When switching script IDs, you may get "Manifest file has been updated" prompt. Use `--force` flag.

2. **File name conflicts**: The target project may have `.js` versions while you have `.gs`. Delete local `.js` files before pushing.

3. **Custom menus require reload**: After deploying, reload the spreadsheet for custom menus (`onOpen`) to pick up the new code.

4. **Bound vs Standalone behavior**:
   - Bound scripts: `getActiveSpreadsheet()` returns the parent sheet
   - Standalone scripts: `getActiveSpreadsheet()` returns `null` unless called from a trigger

## Prevention

### Option A: Always use bound script
When setting up clasp for an existing spreadsheet:

```bash
# Clone the bound script, not a standalone
clasp clone [BOUND_SCRIPT_ID]
```

### Option B: Document the script ID
Add a comment in `.clasp.json`:

```json
{
  "scriptId": "1tK5JFe49h0JBkspunM3V0DM5_JsJtWbtfw6t9Pn4Hj1Pd4dEcmHjBY5I",
  "rootDir": "./gas",
  "_comment": "Bound to [2026-01-15] SessionPool master sheet"
}
```

### Option C: Verify after setup
Always verify the script ID matches:

```bash
# Open the spreadsheet's script editor
# Compare URL's project ID with .clasp.json scriptId
```

## Related

- [clasp documentation](https://github.com/google/clasp)
- [Bound vs Standalone Scripts](https://developers.google.com/apps-script/guides/bound)
