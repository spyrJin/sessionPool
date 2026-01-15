# No Validation in setActiveSheetId()

## Metadata
- **Status:** complete
- **Priority:** P2 (Important)
- **Issue ID:** 009
- **Tags:** security, code-review, validation
- **Dependencies:** None

## Problem Statement

`setActiveSheetId()` accepts any string without validation. If called with an invalid or malicious ID, all subsequent operations will fail or potentially target an attacker-controlled spreadsheet.

**Why it matters:**
- Typos in sheet IDs cause silent failures
- Potential for social engineering attacks (tricking admin to set malicious ID)
- No format validation

## Findings

**Location:** `gas/Config.gs:193-196`
```javascript
function setActiveSheetId(sheetId) {
  PropertiesService.getScriptProperties().setProperty(ACTIVE_SHEET_ID_KEY, sheetId);
  systemLog('CONFIG', '활성 시트 ID 변경', { sheetId: sheetId });
}
```

No validation that:
1. sheetId is a valid format (alphanumeric, ~44 chars)
2. The sheet exists and is accessible
3. The caller has ownership/access rights

## Proposed Solutions

### Option A: Validate on Set (Recommended)

```javascript
function setActiveSheetId(sheetId) {
  // Format validation
  if (!sheetId || typeof sheetId !== 'string' || sheetId.length < 10) {
    throw new Error('Invalid sheet ID format');
  }

  // Accessibility validation
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    // Optionally verify it's a SessionPool sheet
    if (!ss.getSheetByName(CONFIG.SHEET_NAME)) {
      throw new Error('Sheet does not contain SessionPool tab');
    }
  } catch (e) {
    throw new Error('Cannot access sheet: ' + sheetId);
  }

  PropertiesService.getScriptProperties().setProperty(ACTIVE_SHEET_ID_KEY, sheetId);
  systemLog('CONFIG', '활성 시트 ID 변경', { sheetId });
}
```

- **Pros:** Prevents invalid/inaccessible IDs from being stored
- **Cons:** Additional API call on set
- **Effort:** Small
- **Risk:** Low

### Option B: Only Allow Internal Calls
Make setActiveSheetId() only callable from createTomorrowSheetAndNotify().

- **Pros:** Restricts attack surface
- **Cons:** Less flexible, harder to enforce in GAS
- **Effort:** Medium
- **Risk:** Low

## Recommended Action
Implement Option A (Validate on Set)

## Technical Details

**Affected Files:**
- `gas/Config.gs` - `setActiveSheetId()` function

## Acceptance Criteria

- [ ] Format validation added (length, type)
- [ ] Accessibility validation added (try openById)
- [ ] SessionPool sheet tab verification added
- [ ] Clear error message on validation failure
- [ ] Test with invalid ID

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-15 | Issue identified in code review | Validate inputs before storing in state |

## Resources

- Google Spreadsheet IDs: ~44 alphanumeric characters
