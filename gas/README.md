# 세션풀 (Session Pool) MVP

30분 단위 집단 몰입 세션을 위한 구글시트 기반 SaaS

## 파일 구조

```
gas/
├── Config.gs         # 시스템 설정, 색상, 방 풀
├── Utils.gs          # 유틸리티 (시간 계산, 파싱)
├── UserManager.gs    # 사용자 등록/조회/권한
├── GateManager.gs    # 게이트 열림/닫힘 처리
├── MatchingEngine.gs # 정렬, 그룹화, Universal Pool
├── MeetAssigner.gs   # Meet 방 배정
├── Triggers.gs       # 5분/자정 트리거
├── Admin.gs          # 관리자 메뉴, Kill Switch
├── Security.gs       # 편집 검증, 보안
├── Setup.gs          # 초기 설정
├── UI.gs             # HUD, 사이드바 연동
└── Sidebar.html      # 개인화 사이드바
```

## 설치 방법

### 1. 구글 시트 생성
1. Google Sheets에서 새 스프레드시트 생성
2. `확장 프로그램` > `Apps Script` 클릭

### 2. 코드 복사
1. Apps Script 에디터에서 기존 `Code.gs` 삭제
2. 각 `.gs` 파일을 새 스크립트 파일로 추가
3. `Sidebar.html`은 `파일 추가` > `HTML`로 생성

### 3. 초기 설정 실행
1. Apps Script에서 `initialSetup` 함수 선택
2. `실행` 버튼 클릭
3. 권한 승인 (최초 1회)

### 4. Meet 방 링크 설정
`Config.gs`의 `CONFIG.COHORTS`에서 실제 Meet 링크로 교체:
```javascript
'@각자': {
  rooms: [
    'https://meet.google.com/실제링크1',
    'https://meet.google.com/실제링크2',
    'https://meet.google.com/실제링크3'
  ]
}
```

### 5. 관리자 이메일 설정
`Config.gs`의 `ADMIN_EMAILS`에 관리자 이메일 추가

## 사용 방법

### 사용자
1. 시트 열기 → 사이드바 자동 표시
2. 게이트 열림 시 (00-05분) 세션 선택
3. 게이트 닫힘 후 Meet 링크 클릭하여 입장

### 관리자
1. `🔧 관리자` 메뉴 사용
2. 사용자 등록/삭제
3. 코호트 권한 관리
4. 긴급 상황 시 Kill Switch 사용

## 핵심 로직

### 게이트 시스템
- 00-05분: 게이트 열림 (선택 가능)
- 05-30분: 확실성 창 (잠금)
- 30-35분: 게이트 열림
- 35-00분: 확실성 창

### 그룹화 규칙
- 최소 2명, 최대 3명
- 4명 → 2+2 (3+1 방지)
- 1명 낙오 → Universal Pool
- Universal Pool에서도 1명 → Lobby

### 정렬 순서
1. 세션명 (오름차순)
2. 연속일수 (내림차순)

## 테스트 실행 가이드

### 🧪 테스트 파일
`Tests.gs` 파일에 모든 테스트가 포함되어 있습니다.

### 실행 방법

#### 1. 전체 테스트 실행 (권장)
```
1. Apps Script 에디터 열기
2. 함수 선택 드롭다운에서 `runAllTests` 선택
3. ▶️ 실행 버튼 클릭
4. View > Execution log에서 결과 확인
```

#### 2. 개별 테스트 실행
| 함수명 | 테스트 내용 |
|--------|------------|
| `runAllTests` | 모든 테스트 (7개 스위트) |
| `runMatchingTest` | 매칭 엔진 통합 테스트 |
| `runTimeTest` | 시간/블록 계산 테스트 |
| `runEdgeCaseTest` | Edge Case 테스트 |
| `test_calculateGroupSizes` | 그룹 크기 계산 |
| `test_distributeToGroups` | 그룹 분배 로직 |
| `test_meetAssigner` | Meet 방 배정 |
| `test_parsingUtils` | 파싱 유틸리티 |

#### 3. 기존 테스트 함수
| 함수명 | 위치 | 설명 |
|--------|------|------|
| `testMatchingEngine` | MatchingEngine.gs | 매칭 엔진 샘플 실행 |
| `testMeetAssigner` | MeetAssigner.gs | Meet 배정 샘플 실행 |
| `simulateTrigger(hour, minute)` | Triggers.gs | 특정 시간 시뮬레이션 |

### 테스트 결과 해석

```
✅ PASS | 테스트명             → 성공
❌ FAIL | 테스트명 | 상세 정보  → 실패 (원인 확인)
```

### 핵심 테스트 케이스

#### 4명 분할 테스트 (가장 중요!)
```
입력: 4명 (같은 세션)
기대: 2+2 그룹 (3+1 아님!)
```

#### Universal Pool 테스트
```
입력: 각각 다른 세션 3명
기대: 모두 Universal Pool로 이동 → 3인 그룹 생성
```

#### Lobby 테스트
```
입력: 1명만 참여
기대: Lobby로 배정 (그룹 생성 안 함)
```

## 트러블슈팅

### 트리거 미작동
관리자 메뉴 > 강제 실행 > 현재 열 게이트 닫기

### 사용자 편집 불가
1. 게이트 열림 확인 (00-05분)
2. 본인 행 확인
3. 등록 여부 확인

### 권한 오류
관리자에게 코호트 권한 요청

## 라이선스

Session Pool Team
