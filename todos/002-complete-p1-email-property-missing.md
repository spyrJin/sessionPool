# User Email Property Missing in loadUsersToTargetSheet

## Metadata
- **Status:** complete
- **Priority:** P1 (Critical)
- **Issue ID:** 002
- **Tags:** bug, code-review, data-integrity
- **Dependencies:** None

## Problem Statement

The `loadUsersToTargetSheet()` function uses `Object.values(allUsersMap)` but the user object does NOT contain an `email` property. The email is the KEY in the map, not a property of the value. This causes `emailUsers.filter(u => u.email)` to always return an empty array.

**Why it matters:** No emails will ever be sent to users because the filter always fails.

## Findings

**Location 1:** `gas/DailyManager.gs:95-96`
```javascript
const allUsersMap = getAllUsers();
const userList = Object.values(allUsersMap);
```

**Location 2:** `gas/DailyManager.gs:254`
```javascript
const emailUsers = users.filter(u => u.email);  // Always returns []
```

**Location 3:** `gas/UserManager.gs:166-173` - User object structure:
```javascript
users[email] = {
  instagram: normalizedInstagram,
  row: newRow,
  streak: 0,
  cohorts: cohorts || [CONFIG.DEFAULT_COHORT],
  lastParticipation: '',
  registeredAt: new Date().toISOString()
  // NOTE: 'email' is NOT included as a property
};
```

## Proposed Solutions

### Option A: Transform Map to Include Email (Recommended)
Modify `loadUsersToTargetSheet()` to include email in each user object.

```javascript
function loadUsersToTargetSheet(targetSsId) {
  const allUsersMap = getAllUsers();
  // Transform map entries to include email as property
  const userList = Object.entries(allUsersMap).map(([email, userData]) => ({
    ...userData,
    email: email
  }));
  // ...
}
```

- **Pros:** Minimal change, fixes the issue locally
- **Cons:** Transformation happens on every call
- **Effort:** Small
- **Risk:** Low

### Option B: Modify getAllUsers() to Include Email
Change the user storage structure to always include email as a property.

- **Pros:** Fixes globally for all consumers
- **Cons:** Requires migration of existing data, broader impact
- **Effort:** Medium
- **Risk:** Medium

## Recommended Action
Implement Option A (Transform Map to Include Email)

## Technical Details

**Affected Files:**
- `gas/DailyManager.gs` - Lines 92-96

**Current behavior:** `emailUsers.length` is always 0, no emails sent.

## Acceptance Criteria

- [ ] User objects in `loadUsersToTargetSheet()` include `email` property
- [ ] `emailUsers.filter(u => u.email)` returns users with valid emails
- [ ] Daily notification emails are successfully sent
- [ ] Add unit test to verify email filtering works

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-15 | Issue identified in code review | Object.values() loses map keys - must transform if key data is needed |
| 2026-01-15 | Approved during triage | Status: pending → ready. Critical bug - emails never sent. |

## Resources

- Related file: `gas/UserManager.gs:166-173`
