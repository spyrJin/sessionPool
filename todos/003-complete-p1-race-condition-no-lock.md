# Race Condition: No Lock in createTomorrowSheetAndNotify

## Metadata
- **Status:** complete
- **Priority:** P1 (Critical)
- **Issue ID:** 003
- **Tags:** concurrency, code-review, data-integrity
- **Dependencies:** None

## Problem Statement

The `createTomorrowSheetAndNotify()` function has no locking mechanism. If two admins run it simultaneously, duplicate sheets will be created, and `activeSheetId` will be overwritten, causing data fragmentation.

**Why it matters:**
- Two sheets created for the same day
- Users receive links to different sheets
- Gate operations affect only one sheet while users are split across both
- Matching/grouping fails due to fragmented data

## Findings

**Location:** `gas/DailyManager.gs:207-291`

**Timeline of race condition:**
```
Admin A                           Admin B
─────────────────────────────────────────────
1. requireAdmin() ✓
2. ui.alert() confirmation
3.                                 1. requireAdmin() ✓
4. masterSs.copy() → Sheet A      2. ui.alert() confirmation
5.                                 3. masterSs.copy() → Sheet B
6. setActiveSheetId(Sheet A)
7.                                 4. setActiveSheetId(Sheet B) ← overwrites!
8. sendLinkToAllUsers(Sheet A)
9.                                 5. sendLinkToAllUsers(Sheet B)
```

**Comparison with existing safe pattern:**
`gas/UserManager.gs:662-680` - `deleteUserSafe()` correctly uses `LockService.getScriptLock()`.

## Proposed Solutions

### Option A: Add Script Lock (Recommended)

```javascript
function createTomorrowSheetAndNotify() {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(30000)) {
      SpreadsheetApp.getUi().alert('다른 관리자가 작업 중입니다. 잠시 후 다시 시도하세요.');
      return;
    }

    requireAdmin();
    // ... rest of function
  } finally {
    lock.releaseLock();
  }
}
```

- **Pros:** Prevents concurrent execution, follows existing pattern
- **Cons:** Admin may need to wait if lock is held
- **Effort:** Small
- **Risk:** Low

### Option B: Idempotency Check
Check if tomorrow's sheet already exists before creating.

```javascript
const existingSheet = findSheetByName(`[${dateStr}] SessionPool`);
if (existingSheet) {
  ui.alert('이미 생성되어 있습니다', '...');
  return;
}
```

- **Pros:** Prevents duplicate creation even across separate runs
- **Cons:** Requires Drive search, still has race window
- **Effort:** Medium
- **Risk:** Medium

## Recommended Action
Implement Option A (Add Script Lock) + Option B (Idempotency Check) together

## Technical Details

**Affected Files:**
- `gas/DailyManager.gs` - Function `createTomorrowSheetAndNotify()`

## Acceptance Criteria

- [ ] `LockService.getScriptLock()` added at function start
- [ ] Lock released in finally block
- [ ] User-friendly message shown if lock unavailable
- [ ] Optional: Check for existing sheet before creation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-15 | Issue identified in code review | Admin functions with side effects need locking |
| 2026-01-15 | Approved during triage | Status: pending → ready. Follow existing LockService pattern. |

## Resources

- GAS LockService docs: https://developers.google.com/apps-script/reference/lock/lock-service
- Pattern reference: `gas/UserManager.gs:662-680`
