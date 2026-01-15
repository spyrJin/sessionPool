# Overly Permissive File Sharing (ANYONE_WITH_LINK + EDIT)

## Metadata
- **Status:** complete
- **Priority:** P2 (Important)
- **Issue ID:** 006
- **Tags:** security, code-review
- **Dependencies:** None

## Problem Statement

Newly created daily sheets are shared with **EDIT** permissions to **anyone with the link**. Combined with the URL being distributed via email, this creates significant security and data integrity risks.

**Why it matters:**
- Anyone who obtains the link can modify any user's data
- Vandalism/disruption possible
- Users can modify other users' session selections
- Potential for script injection if sheet data is processed elsewhere

## Findings

**Location 1:** `gas/DailyManager.gs:44`
```javascript
newSs.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
```

**Location 2:** `gas/DailyManager.gs:248`
```javascript
newSs.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
```

## Proposed Solutions

### Option A: VIEW + Row Protection (Recommended)
Change default sharing to VIEW, then use onEdit to protect rows.

```javascript
// Change sharing to VIEW
newSs.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

// Add specific users as editors
users.forEach(u => {
  if (u.email) newSs.addEditor(u.email);
});
```

- **Pros:** Only registered users can edit
- **Cons:** Requires valid user emails, more API calls
- **Effort:** Medium
- **Risk:** Medium (may break if users don't have Google accounts)

### Option B: Keep EDIT but Add Sheet Protection
Keep link sharing but protect cells/ranges programmatically.

- **Pros:** Simpler, doesn't require user emails
- **Cons:** Protection can be circumvented, doesn't prevent all abuse
- **Effort:** Medium
- **Risk:** Medium

### Option C: Accept Current Design (Document Risk)
If the system is intentionally open, document this as an accepted risk.

- **Pros:** No code changes
- **Cons:** Security risk remains
- **Effort:** Small
- **Risk:** High

## Recommended Action
Discuss with stakeholders - if registered users have Google accounts, implement Option A. Otherwise, document as accepted risk.

## Technical Details

**Affected Files:**
- `gas/DailyManager.gs` - Lines 44, 248

**Current behavior:** Anyone with the link can edit any cell.

## Acceptance Criteria

- [ ] Decision documented on sharing model
- [ ] If Option A: Sharing changed to VIEW + explicit editors
- [ ] If Option B: Sheet protection implemented
- [ ] If Option C: Risk documented in CLAUDE.md

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-15 | Issue identified in code review | Link sharing with EDIT is risky for collaborative sheets |
| 2026-01-15 | Approved during triage | Status: pending → ready. Needs stakeholder discussion on approach. |

## Resources

- Google Drive sharing docs: https://developers.google.com/apps-script/reference/drive/access
