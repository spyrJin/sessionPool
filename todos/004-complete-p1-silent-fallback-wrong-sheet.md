# Silent Fallback to Wrong Sheet on Error

## Metadata
- **Status:** complete
- **Priority:** P1 (Critical)
- **Issue ID:** 004
- **Tags:** architecture, code-review, data-integrity
- **Dependencies:** None

## Problem Statement

When `getMainSheet()` fails to open a remote sheet (deleted, inaccessible, invalid ID), it silently falls back to the master sheet. This can cause triggers to operate on the master template instead of the daily sheet, corrupting the template.

**Why it matters:**
- Gate operations modify the master template instead of daily sheet
- User selections written to wrong location
- Template corrupted for future copies
- No admin notification of the failure

## Findings

**Location:** `gas/Utils.gs:295-301`

```javascript
if (activeSheetId) {
  try {
    ss = SpreadsheetApp.openById(activeSheetId);
  } catch (e) {
    // 원격 시트 열기 실패 시 현재 시트 사용
    systemLog('ERROR', '원격 시트 열기 실패, 현재 시트 사용', { activeSheetId: activeSheetId, error: e.toString() });
    ss = SpreadsheetApp.getActiveSpreadsheet();  // DANGEROUS: silent fallback
  }
}
```

**Scenario:** If daily sheet `[2026-01-16] SessionPool` is deleted while `activeSheetId` points to it:
1. All `getMainSheet()` calls fail
2. System falls back to master
3. User session selections write to master template
4. GateManager triggers corrupt the master

## Proposed Solutions

### Option A: Fail Fast with Admin Alert (Recommended)

```javascript
function getMainSheet() {
  const activeSheetId = getActiveSheetId();

  let ss;
  if (activeSheetId) {
    try {
      ss = SpreadsheetApp.openById(activeSheetId);
    } catch (e) {
      systemLog('ERROR', '원격 시트 열기 실패', { activeSheetId, error: e.toString() });

      // Send admin alert
      GmailApp.sendEmail(
        CONFIG.ADMIN_EMAILS[0],
        '[긴급] 활성 시트 접근 실패',
        `activeSheetId가 유효하지 않습니다.\nID: ${activeSheetId}\n\n마스터 시트에서 '마스터로 복귀'를 실행하세요.`
      );

      // Throw instead of silent fallback
      throw new Error('Remote sheet inaccessible: ' + activeSheetId);
    }
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  // ...
}
```

- **Pros:** Prevents data corruption, alerts admins immediately
- **Cons:** Triggers will fail until admin intervenes
- **Effort:** Small
- **Risk:** Low

### Option B: Auto-Clear Invalid activeSheetId
Automatically clear the invalid ID and fall back safely.

```javascript
catch (e) {
  systemLog('ERROR', '원격 시트 열기 실패, ID 자동 초기화', { activeSheetId, error: e.toString() });
  clearActiveSheetId();  // Auto-clear invalid ID
  ss = SpreadsheetApp.getActiveSpreadsheet();
}
```

- **Pros:** Self-healing, operations continue on master
- **Cons:** May mask underlying issues, operations on master may not be intended
- **Effort:** Small
- **Risk:** Medium

## Recommended Action
Implement Option A (Fail Fast with Admin Alert)

## Technical Details

**Affected Files:**
- `gas/Utils.gs` - Lines 295-301

**Current behavior:** Operations silently target master sheet, potentially corrupting template.

## Acceptance Criteria

- [ ] `getMainSheet()` throws error when remote sheet inaccessible
- [ ] Admin notification sent on failure
- [ ] Trigger operations halt cleanly rather than corrupting master
- [ ] Documentation added for recovery procedure

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-15 | Issue identified in code review | Silent fallbacks mask errors and cause data corruption |
| 2026-01-15 | Approved during triage | Status: pending → ready. Fail-fast approach to protect master template. |

## Resources

- Related: `gas/DailyManager.gs:340-348` - `showActiveSheetInfo()` also has incomplete error handling
