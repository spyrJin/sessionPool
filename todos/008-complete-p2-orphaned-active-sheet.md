# No Cleanup for Orphaned activeSheetId State

## Metadata
- **Status:** complete
- **Priority:** P2 (Important)
- **Issue ID:** 008
- **Tags:** architecture, code-review
- **Dependencies:** None

## Problem Statement

There's no automatic cleanup mechanism for `activeSheetId`. If a daily sheet is deleted or the admin forgets to run `resetToMasterSheet()`, the property remains set indefinitely, causing continuous failures.

**Why it matters:**
- `activeSheetId` persists pointing to non-existent sheet
- All operations fail or fallback to master
- Manual intervention required
- No automatic expiry

## Findings

**activeSheetId management:**
- Set: `gas/Config.gs:193-196` - `setActiveSheetId()`
- Get: `gas/Config.gs:185-187` - `getActiveSheetId()`
- Clear: `gas/Config.gs:201-204` - `clearActiveSheetId()` (manual only)

**No automatic expiry or validation exists.**

## Proposed Solutions

### Option A: Add TTL/Timestamp (Recommended)
Store timestamp when setting activeSheetId, auto-expire after 36 hours.

```javascript
function setActiveSheetId(sheetId) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(ACTIVE_SHEET_ID_KEY, sheetId);
  props.setProperty('activeSheetSetAt', new Date().toISOString());
  systemLog('CONFIG', '활성 시트 ID 변경', { sheetId });
}

function getActiveSheetId() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(ACTIVE_SHEET_ID_KEY);
  const setAt = props.getProperty('activeSheetSetAt');

  if (id && setAt) {
    const age = Date.now() - new Date(setAt).getTime();
    const MAX_AGE = 36 * 60 * 60 * 1000;  // 36 hours
    if (age > MAX_AGE) {
      clearActiveSheetId();
      systemLog('CONFIG', '활성 시트 ID 만료로 자동 초기화');
      return null;
    }
  }
  return id;
}
```

- **Pros:** Self-healing, prevents stale state
- **Cons:** 36 hours may not fit all use cases
- **Effort:** Small
- **Risk:** Low

### Option B: Daily Validation Trigger
Add a midnight trigger that validates activeSheetId.

```javascript
function validateActiveSheet() {
  const id = getActiveSheetId();
  if (!id) return;

  try {
    SpreadsheetApp.openById(id);
  } catch (e) {
    clearActiveSheetId();
    GmailApp.sendEmail(CONFIG.ADMIN_EMAILS[0], '활성 시트 자동 초기화', '...');
  }
}
```

- **Pros:** Proactive validation
- **Cons:** Requires additional trigger setup
- **Effort:** Medium
- **Risk:** Low

## Recommended Action
Implement Option A (TTL/Timestamp) for simplicity

## Technical Details

**Affected Files:**
- `gas/Config.gs` - `setActiveSheetId()`, `getActiveSheetId()`

## Acceptance Criteria

- [ ] Timestamp stored when setting activeSheetId
- [ ] Auto-expire after 36 hours
- [ ] Clear expired ID on next read
- [ ] Log when auto-expiring
- [ ] Admin notification optional

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-15 | Issue identified in code review | State properties need expiry to prevent orphaned references |

## Resources

- Related issue: #004 (Silent Fallback)
