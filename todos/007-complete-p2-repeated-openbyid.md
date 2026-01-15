# Performance: Repeated SpreadsheetApp.openById() Calls

## Metadata
- **Status:** complete
- **Priority:** P2 (Important)
- **Issue ID:** 007
- **Tags:** performance, code-review
- **Dependencies:** None

## Problem Statement

`getMainSheet()` is called 27+ times across the codebase, and each call reads from Script Properties and potentially opens a remote spreadsheet via `SpreadsheetApp.openById()`. This is expensive (100-500ms per call) and risks hitting the 6-minute GAS trigger timeout.

**Why it matters:**
- Gate close cycles call `getMainSheet()` 8+ times
- Single gate operation could take 4-8 seconds just on sheet opens
- Leaves less time for actual business logic
- Risk of trigger timeout on slow networks

## Findings

**Location:** `gas/Utils.gs:290-296`
```javascript
function getMainSheet() {
  const activeSheetId = getActiveSheetId();  // Properties read

  let ss;
  if (activeSheetId) {
    ss = SpreadsheetApp.openById(activeSheetId);  // Expensive call on every invocation
  }
  // ...
}
```

**Call frequency in GateManager.gs:**
- Line 28, 81, 320, 348, 371, 394, 422 - Multiple calls in single trigger

## Proposed Solutions

### Option A: Add Caching (Recommended)

```javascript
let _cachedMainSheet = null;
let _cachedSheetId = null;

function getMainSheet() {
  const activeSheetId = getActiveSheetId();

  // Return cached if same sheet
  if (_cachedMainSheet && _cachedSheetId === activeSheetId) {
    return _cachedMainSheet;
  }

  // ... existing logic ...
  _cachedMainSheet = sheet;
  _cachedSheetId = activeSheetId;
  return sheet;
}

function invalidateMainSheetCache() {
  _cachedMainSheet = null;
  _cachedSheetId = null;
}
```

- **Pros:** Dramatic performance improvement (50-80% reduction in gate cycle time)
- **Cons:** Cache must be invalidated on sheet changes
- **Effort:** Small
- **Risk:** Low

### Option B: Cache Script Properties
Also cache the Properties read.

```javascript
let _scriptProperties = null;
function getCachedProperties() {
  if (!_scriptProperties) {
    _scriptProperties = PropertiesService.getScriptProperties().getProperties();
  }
  return _scriptProperties;
}
```

- **Pros:** Further performance gain
- **Cons:** Properties changes during execution won't be seen
- **Effort:** Small
- **Risk:** Low

## Recommended Action
Implement Option A (Sheet caching) + Option B (Properties caching)

## Technical Details

**Affected Files:**
- `gas/Utils.gs` - `getMainSheet()` function
- `gas/Config.gs` - `getActiveSheetId()` function

**Performance impact:**
- Current: ~4-8 seconds per gate cycle on remote sheets
- After fix: ~0.5-1 second per gate cycle

## Acceptance Criteria

- [ ] Sheet object cached after first load
- [ ] Cache invalidated when `setActiveSheetId()` called
- [ ] Properties also cached
- [ ] Gate cycle time reduced by >50%
- [ ] No regressions in trigger operations

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-15 | Issue identified in code review | GAS SpreadsheetApp calls are expensive - cache when possible |
| 2026-01-15 | Approved during triage | Status: pending → ready. High-impact performance fix. |

## Resources

- GAS best practices: https://developers.google.com/apps-script/guides/support/best-practices
