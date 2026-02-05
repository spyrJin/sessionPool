# feat: SlothTime Email Automation

관리자 메뉴 클릭 한 번으로 내일 읽기/쓰기 세션을 자동 준비 (Doc 복사 + Meet 생성 + 이메일 발송).

## 파일 변경

| 파일 | 변경 | 내용 |
|------|------|------|
| `gas/Config.gs` | 수정 | `CONFIG.SLOTHTIME` 설정 블록 추가 |
| `gas/Utils.gs` | 수정 | `_isValidEmail`, `_dedup`, `_grantEditorsSmart`, `_createCalendarMeetStrict`, `_notifyOwnerError` 추가 |
| `gas/SlothTimeEmailer.gs` | **신규** | 메인 로직 (`runSlothTimeTomorrow` 외 내부 함수들) |
| `gas/slothtime-email.html` | **신규** | HTML 이메일 템플릿 (`<?= ?>` 스크립틀릿) |
| `gas/Admin.gs` | 수정 | `addAdminMenu()`에 SlothTime 항목 3개 추가 |
| `test/gas-mocks.js` | 수정 | `GmailApp`, `DriveApp`, `Calendar` mock 추가 |
| `test/slothtime.test.js` | **신규** | 유닛 테스트 |

## 스펙 vs 기존 코드 — 주요 결정

| 항목 | 스펙 | 결정 | 이유 |
|------|------|------|------|
| 접근 권한 | 미명시 | **Admin-only** | `createTomorrowSheetAndNotify()` 패턴, 대량 이메일 보안 |
| 네이밍 | `suffix_` | **`_prefix`** | 기존 15개 파일 전체가 `_prefix` |
| 동시 실행 | 미명시 | **LockService** | DailyManager.gs:192 패턴 |
| 중복 실행 | 미명시 | **Script Properties 체크 + 경고** | 같은 날짜 재실행 방지 |
| 확인 다이얼로그 | "원클릭" | **확인 포함** | 실수 방지. DailyManager.gs:208 패턴 |
| 설정 위치 | 별도 `SLOTHTIME_CONFIG` | **`CONFIG.SLOTHTIME`** | 기존 Config.gs 패턴 유지 |
| 메뉴 위치 | 별도 최상위 메뉴 | **관리자 메뉴 하위** | Admin-only이므로 |
| Doc 공유 | 미명시 | **ANYONE_WITH_LINK + addEditors** | DailyManager.gs:241 패턴 |
| 템플릿 문법 | 미명시 | **`<?= var ?>`** (HtmlService 네이티브) | GAS 내장, XSS 자동 이스케이핑 |
| 헤더 매칭 | "이메일" | **퍼지** ("이메일", "email", "e-mail") | UserLoader.gs 패턴 |

## 실행 흐름

```
runSlothTimeTomorrow()
  1. requireAdmin()
  2. LockService 획득
  3. 내일 날짜 계산 → SKIP_DAYS 체크 (일요일 → 중단)
  4. 중복 실행 체크 (Script Properties)
  5. 확인 다이얼로그 (날짜, 시간, 수신자 수)
  6. 외부 시트에서 이메일 추출 → 검증/중복제거
  7. Doc 템플릿 복사 + ANYONE_WITH_LINK EDIT + addEditors
  8. Calendar.Events.insert (conferenceDataVersion:1, sendUpdates:'none') → Meet 링크
  9. GmailApp.sendEmail (HtmlService 템플릿) → 개별 발송
 10. Script Properties에 날짜 저장 + systemLog + 완료 알림
```

## Acceptance Criteria

- [ ] 관리자 메뉴에 "SlothTime 내일 발송" 항목 표시
- [ ] 비관리자 실행 시 권한 오류
- [ ] 내일이 일요일이면 안내 후 중단
- [ ] 같은 날짜 재실행 시 경고 다이얼로그
- [ ] 확인 다이얼로그에 날짜/시간/수신자 수 표시
- [ ] 외부 시트에서 이메일 추출 + 검증 + 중복제거
- [ ] Doc 복사 + 제목 설정 + 편집 권한 부여
- [ ] Calendar API로 Meet 링크 생성
- [ ] HTML 이메일 개별 발송
- [ ] 완료 알림에 발송 수/Doc/Meet 표시
- [ ] 실패 시 관리자에게 에러 이메일
- [ ] "설정 확인" / "설정 검증" 메뉴 동작
- [ ] `bun test` 통과 (기존 + 신규)

## Prerequisites

- Calendar Advanced Service 활성화 (GAS 프로젝트 설정에서 수동)
- `CONFIG.SLOTHTIME.TEMPLATE.DOC_ID` / `OUTPUT_FOLDER_ID` / `SHEET.ID` 설정

## Implementation Checklist

```
Phase 1 — Config & Utils
  [x] 1. gas/Config.gs: CONFIG.SLOTHTIME 추가
  [x] 2. gas/Utils.gs: _isValidEmail, _dedup, _grantEditorsSmart, _createCalendarMeetStrict, _notifyOwnerError 추가

Phase 2 — Core Logic
  [x] 3. gas/SlothTimeEmailer.gs 생성
       - runSlothTimeTomorrow (메인)
       - _getSlothTimeEmails, _getSheetByGid
       - _copySlothTimeTemplate
       - _createSlothTimeMeet
       - _sendSlothTimeEmails, _parseSessionTime
       - _notifySlothTimeError
       - showSlothTimeConfig, validateSlothTimeSetup

Phase 3 — Email Template
  [x] 4. gas/slothtime-email.html (반응형, 인라인 CSS, Meet/Doc 버튼)

Phase 4 — Menu Integration
  [x] 5. gas/Admin.gs: addAdminMenu()에 SlothTime 섹션 추가

Phase 5 — Testing
  [x] 6. test/gas-mocks.js: GmailApp, DriveApp, Calendar mock 추가
  [x] 7. test/slothtime.test.js 작성
  [x] 8. bun test 전체 통과
```
