---
title: "Race Condition Prevention with LockService in Google Apps Script"
problem_type: concurrency
severity: medium
date_solved: 2026-01-15
component: gas/DailyManager.gs
affected_files:
  - gas/DailyManager.gs
  - gas/GateManager.gs
symptoms:
  - Multiple admins clicking 'Create Tomorrow Sheet' simultaneously
  - Duplicate sheets created for same date
  - Duplicate email notifications sent
root_cause: No mutual exclusion on critical sections that create sheets and send emails
solution_summary: Wrapped critical sections with LockService.getScriptLock() and tryLock() with try/finally for guaranteed release
tags:
  - race-condition
  - concurrency
  - LockService
  - mutex
  - google-apps-script
---

# Race Condition Prevention with LockService

## Problem

Admin operations like `createTomorrowSheetAndNotify()` could be triggered simultaneously by multiple admins, causing:
- Duplicate spreadsheets created for the same date
- Multiple email notifications sent to all users
- Corrupted state in Script Properties

## Solution

### Pattern: tryLock with try/finally

**File**: `gas/DailyManager.gs` (lines 191-289)

```javascript
function createTomorrowSheetAndNotify() {
  // 1. Acquire script-level lock (blocks ALL concurrent executions)
  const lock = LockService.getScriptLock();

  // 2. Try to get lock with 30-second timeout
  if (!lock.tryLock(30000)) {
    SpreadsheetApp.getUi().alert('다른 관리자가 작업 중입니다. 잠시 후 다시 시도하세요.');
    return;
  }

  try {
    // 3. Critical section - your business logic
    requireAdmin();
    const ui = SpreadsheetApp.getUi();
    // ... create sheet, send emails, etc.

  } catch (error) {
    // 4. Error handling
    systemLog('ERROR', '내일 시트 생성 실패', { error: error.toString() });

  } finally {
    // 5. ALWAYS release lock, even if error occurred
    lock.releaseLock();
  }
}
```

## Lock Type Selection Guide

| Lock Type | Method | Use Case |
|-----------|--------|----------|
| **Script Lock** | `getScriptLock()` | Global operations (gate processing, daily sheet creation) |
| **Document Lock** | `getDocumentLock()` | Per-spreadsheet operations |
| **User Lock** | `getUserLock()` | Per-user operations (session selection) |

## Timeout Recommendations

| Operation | Timeout | Reason |
|-----------|---------|--------|
| Gate close (matching) | 30-60s | Multiple sheet operations |
| Session selection | 5-10s | Single cell update |
| Daily sheet creation | 60-120s | Copy + email sending |
| User registration | 10s | Properties update |

## Key Gotchas

1. **Always use try/finally**: Without `finally`, lock may not release until GAS timeout (6 minutes)

2. **Lock scope**: Only works within the same script project, not across different projects

3. **Avoid nested locks**: Can cause deadlocks

4. **Choose appropriate lock type**: Don't use Script Lock for user operations (blocks everyone)

5. **User feedback**: Always show a message when lock acquisition fails

## Alternative Pattern: waitLock

For background operations where blocking is acceptable:

```javascript
function onGateClose(column) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);  // Blocks until acquired or timeout
    // Process gate close
  } catch (e) {
    if (e.message.includes('Lock timeout')) {
      systemLog('ERROR', 'Gate close lock timeout', { column });
      return;
    }
    throw e;
  } finally {
    lock.releaseLock();
  }
}
```

## Testing Concurrent Execution

```javascript
describe('Race Condition Tests', () => {
  test('Lock prevents double processing', async () => {
    const results = await Promise.all([
      gas.createTomorrowSheetAndNotify(),
      gas.createTomorrowSheetAndNotify()
    ]);

    // Only one should succeed
    const successes = results.filter(r => r.success);
    expect(successes.length).toBe(1);
  });
});
```

## Related

- GAS LockService Reference: https://developers.google.com/apps-script/reference/lock/lock-service
