# Sheet Name Mismatch: System_Config vs DB_Users

## Metadata
- **Status:** complete
- **Priority:** P1 (Critical)
- **Issue ID:** 005
- **Tags:** bug, code-review, data-integrity
- **Dependencies:** None

## Problem Statement

`loadUsersToTargetSheet()` creates a hidden sheet named `System_Config` to store user data, but `loadInitialDataFromSheet()` looks for a sheet named `DB_Users`. This naming mismatch means user data injected into daily sheets will never be read.

**Why it matters:**
- User data is written but never read
- Daily sheets operate without proper user context
- Sidebar and other features that depend on user data fail

## Findings

**Write Location:** `gas/DailyManager.gs:115`
```javascript
const configSheet = ss.insertSheet('System_Config');  // Creates 'System_Config'
configSheet.hideSheet();
configSheet.getRange('A1').setValue(JSON.stringify(allUsersMap));
```

**Read Location:** `gas/Setup.gs:472`
```javascript
const dbSheet = ss.getSheetByName('DB_Users');  // Looks for 'DB_Users'
```

These names do not match!

## Proposed Solutions

### Option A: Standardize on System_Config (Recommended)
Change the read location to look for `System_Config`.

```javascript
// In Setup.gs:472
const dbSheet = ss.getSheetByName('System_Config');
```

- **Pros:** Minimal change, aligns with new code
- **Cons:** May need to update other references to DB_Users
- **Effort:** Small
- **Risk:** Low

### Option B: Standardize on DB_Users
Change the write location to create `DB_Users`.

```javascript
// In DailyManager.gs:115
const configSheet = ss.insertSheet('DB_Users');
```

- **Pros:** Keeps existing Setup.gs code unchanged
- **Cons:** Inconsistent naming (DB_Users for config data)
- **Effort:** Small
- **Risk:** Low

### Option C: Use CONFIG Constant
Define the sheet name in CONFIG to ensure consistency.

```javascript
// In Config.gs
CONFIG.USER_DATA_SHEET_NAME: 'System_UserData'

// Usage
const configSheet = ss.insertSheet(CONFIG.USER_DATA_SHEET_NAME);
const dbSheet = ss.getSheetByName(CONFIG.USER_DATA_SHEET_NAME);
```

- **Pros:** Single source of truth, prevents future mismatches
- **Cons:** Requires updating multiple files
- **Effort:** Medium
- **Risk:** Low

## Recommended Action
Implement Option C (Use CONFIG Constant) for maintainability

## Technical Details

**Affected Files:**
- `gas/DailyManager.gs` - Line 115
- `gas/Setup.gs` - Line 472
- `gas/Config.gs` - Add constant

## Acceptance Criteria

- [ ] Sheet name defined in CONFIG as constant
- [ ] `loadUsersToTargetSheet()` uses constant
- [ ] `loadInitialDataFromSheet()` uses same constant
- [ ] User data successfully read on daily sheet initialization
- [ ] Unit test added to verify read/write consistency

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-15 | Issue identified in code review | Magic strings cause subtle bugs - use constants |
| 2026-01-15 | Approved during triage | Status: pending → ready. Use CONFIG constant for consistency. |

## Resources

- `gas/DailyManager.gs:109-119` - Comment mentions Setup.gs integration
