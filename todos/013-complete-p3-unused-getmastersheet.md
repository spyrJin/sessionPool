# Unused getMasterSheet() Function

## Metadata
- **Status:** complete
- **Priority:** P3 (Nice-to-have)
- **Issue ID:** 013
- **Tags:** code-review, architecture
- **Dependencies:** None

## Problem Statement

`getMasterSheet()` was introduced for "마스터 전용 작업" (master-only operations) but is never used anywhere in the codebase. This suggests incomplete integration or a design that wasn't fully implemented.

**Why it matters:**
- Confusion about when to use getMasterSheet() vs getMainSheet()
- May indicate places that should use getMasterSheet() but don't
- Dead code if truly unused

## Findings

**Location:** `gas/Utils.gs:319-326`
```javascript
/**
 * 마스터 시트 객체 반환 (항상 현재 스프레드시트)
 * - 마스터 전용 작업 시 사용 (트리거 설정, 관리자 메뉴 등)
 */
function getMasterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }
  return sheet;
}
```

**Grep for usage:** No calls found outside of definition.

**Potential call sites that might need it:**
- Admin menu operations that should always target master
- Trigger installation (should be on master)
- User registration (depends on design intent)

## Proposed Solutions

### Option A: Document and Integrate
Identify functions that should use getMasterSheet() and update them.

- **Pros:** Complete the design intent
- **Cons:** Requires analysis of each call site
- **Effort:** Medium
- **Risk:** Medium

### Option B: Remove if Unneeded
If analysis shows getMainSheet() is always correct, remove getMasterSheet().

- **Pros:** Simplifies codebase
- **Cons:** May need it later
- **Effort:** Small
- **Risk:** Low

### Option C: Merge into getMainSheet() with Parameter
```javascript
function getMainSheet(forceMaster = false) {
  if (forceMaster) return getMasterSheetInternal();
  // ... existing logic
}
```

- **Pros:** Single entry point, clearer API
- **Cons:** Requires updating all call sites
- **Effort:** Medium
- **Risk:** Low

## Recommended Action
First analyze call sites, then decide between Option A or B

## Technical Details

**Affected Files:**
- `gas/Utils.gs` - Lines 319-326

## Acceptance Criteria

- [ ] Analysis of all getMainSheet() call sites completed
- [ ] Decision documented (integrate or remove)
- [ ] If integrate: functions updated to use getMasterSheet() where appropriate
- [ ] If remove: function deleted

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-15 | Issue identified in code review | New functions should be integrated, not just defined |

## Resources

- `getMainSheet()`: gas/Utils.gs:289-313
