# showActiveSheetInfo() Incomplete Error Recovery

## Metadata
- **Status:** complete
- **Priority:** P2 (Important)
- **Issue ID:** 011
- **Tags:** bug, code-review, ux
- **Dependencies:** None

## Problem Statement

`showActiveSheetInfo()` shows a dialog asking "마스터로 복귀하시겠습니까?" (Do you want to return to master?) but only provides an OK button and doesn't actually perform the reset action.

**Why it matters:**
- Confusing UX - question asked but no choice given
- Admin must manually find and run resetToMasterSheet()
- Recovery workflow broken

## Findings

**Location:** `gas/DailyManager.gs:340-348`
```javascript
} catch (e) {
  ui.alert(
    '⚠️ 경고',
    `활성 시트 ID가 설정되어 있지만 접근할 수 없습니다.\n\n` +
    `ID: ${activeSheetId}\n오류: ${e.toString()}\n\n` +
    `마스터로 복귀하시겠습니까?`,  // Asks yes/no question
    ui.ButtonSet.OK  // Only provides OK button
  );
}
```

## Proposed Solutions

### Option A: Implement Recovery Action (Recommended)

```javascript
} catch (e) {
  const response = ui.alert(
    '⚠️ 경고',
    `활성 시트 ID가 설정되어 있지만 접근할 수 없습니다.\n\n` +
    `마스터로 복귀하시겠습니까?`,
    ui.ButtonSet.YES_NO  // Changed from OK
  );

  if (response === ui.Button.YES) {
    clearActiveSheetId();
    ui.alert('완료', '마스터 시트로 복귀했습니다.', ui.ButtonSet.OK);
  }
}
```

- **Pros:** Complete recovery workflow
- **Cons:** None
- **Effort:** Small
- **Risk:** Low

### Option B: Remove Question, Just Inform
Change message to statement, not question.

```javascript
ui.alert(
  '⚠️ 경고',
  `활성 시트에 접근할 수 없습니다.\n'마스터로 복귀' 메뉴를 사용하세요.`,
  ui.ButtonSet.OK
);
```

- **Pros:** Clear instructions
- **Cons:** Extra step for admin
- **Effort:** Small
- **Risk:** Low

## Recommended Action
Implement Option A (Implement Recovery Action)

## Technical Details

**Affected Files:**
- `gas/DailyManager.gs` - `showActiveSheetInfo()` function, lines 340-348

## Acceptance Criteria

- [ ] Dialog uses YES_NO buttons
- [ ] YES triggers clearActiveSheetId()
- [ ] Confirmation shown after reset
- [ ] Error details logged but not shown to user (see #010)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-15 | Issue identified in code review | UI dialogs should match their button sets |

## Resources

- Related: #010 (Error message cleanup)
