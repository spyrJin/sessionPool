# Dead Code: collectAllUsersData() Function

## Metadata
- **Status:** complete
- **Priority:** P3 (Nice-to-have)
- **Issue ID:** 012
- **Tags:** cleanup, code-review
- **Dependencies:** None

## Problem Statement

The `collectAllUsersData()` function is defined but never called. Additionally, it references an undefined function `detectCohortFromFileName()`. The function's loop collects data that is then discarded.

**Why it matters:**
- Confusing code for future maintainers
- If called, would throw ReferenceError
- ~20 lines of dead code

## Findings

**Location:** `gas/DailyManager.gs:130-150`
```javascript
function collectAllUsersData() {
  const folderId = CONFIG.USER_DATA_FOLDER_ID;
  if (!folderId) return {};

  const usersMap = {};  // Declared but never populated
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);

  while (files.hasNext()) {
    const file = files.next();
    const result = processSheetData(file.getId(), detectCohortFromFileName(file.getName()));  // Undefined!
    // ... comments about limitations
  }

  return getAllUsers();  // Just returns this anyway
}
```

**Call sites:** None found - function is never used.

## Proposed Solutions

### Option A: Delete Function (Recommended)
Remove the dead code entirely.

- **Pros:** Cleaner codebase, removes confusion
- **Cons:** None
- **Effort:** Small
- **Risk:** None

### Option B: Fix and Use
If the function was intended for a purpose, fix it and integrate.

- **Pros:** May have been a planned feature
- **Cons:** Requires understanding original intent, more work
- **Effort:** Large
- **Risk:** Medium

## Recommended Action
Implement Option A (Delete Function)

## Technical Details

**Affected Files:**
- `gas/DailyManager.gs` - Lines 130-150

**Lines to delete:** ~20

## Acceptance Criteria

- [ ] `collectAllUsersData()` function removed
- [ ] No regressions (function was never called)
- [ ] Tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-15 | Issue identified in code review | Remove dead code to reduce maintenance burden |

## Resources

- Also references undefined: `detectCohortFromFileName()`
