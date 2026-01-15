# Sensitive Information in Error Messages

## Metadata
- **Status:** complete
- **Priority:** P2 (Important)
- **Issue ID:** 010
- **Tags:** security, code-review
- **Dependencies:** None

## Problem Statement

Error messages shown to users expose internal spreadsheet IDs and raw error stack traces. This information disclosure could aid attackers in understanding system architecture.

**Why it matters:**
- Internal IDs reveal system structure
- Error stack traces may expose file paths, function names
- Useful information for targeted attacks

## Findings

**Location 1:** `gas/DailyManager.gs:341-348`
```javascript
} catch (e) {
  ui.alert(
    '⚠️ 경고',
    `활성 시트 ID가 설정되어 있지만 접근할 수 없습니다.\n\n` +
    `ID: ${activeSheetId}\n오류: ${e.toString()}\n\n` +  // Exposes ID and error
    `마스터로 복귀하시겠습니까?`,
    ui.ButtonSet.OK
  );
}
```

**Location 2:** `gas/DailyManager.gs:278-282`
```javascript
ui.alert(
  '❌ 오류 발생',
  `시트 생성 중 오류가 발생했습니다.\n\n${error.toString()}`,  // Raw error
  ui.ButtonSet.OK
);
```

**Location 3:** `gas/Utils.gs:299`
```javascript
systemLog('ERROR', '원격 시트 열기 실패, 현재 시트 사용', { activeSheetId: activeSheetId, error: e.toString() });
```

## Proposed Solutions

### Option A: Generic User Messages (Recommended)

```javascript
// For users
ui.alert(
  '⚠️ 오류',
  '시트 접근에 문제가 발생했습니다. 관리자에게 문의하세요.',
  ui.ButtonSet.OK
);

// Log detailed error separately
systemLog('ERROR', '상세 오류', { activeSheetId, error: e.toString(), stack: e.stack });
```

- **Pros:** No information disclosure to users
- **Cons:** Less helpful for debugging at user level
- **Effort:** Small
- **Risk:** Low

### Option B: Error Codes
Use error codes that map to internal details.

- **Pros:** Allows user to report specific error
- **Cons:** More complex implementation
- **Effort:** Medium
- **Risk:** Low

## Recommended Action
Implement Option A (Generic User Messages)

## Technical Details

**Affected Files:**
- `gas/DailyManager.gs` - Lines 278-282, 341-348
- `gas/Utils.gs` - Line 299

## Acceptance Criteria

- [ ] Error messages to users are generic
- [ ] Detailed errors logged server-side only
- [ ] Internal IDs not exposed in UI
- [ ] Stack traces not shown to users

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-15 | Issue identified in code review | Don't expose internal details in error messages |

## Resources

- OWASP Error Handling: https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html
