# KTX 브라우저 화면 기반 잔여석 모니터링 알림판

이 프로젝트는 **KORAIL API나 내부 HTML 조회 URL을 직접 호출하지 않는** 로컬 보조 도구입니다. 사용자가 직접 열어둔 코레일 예매 브라우저 화면을 일정 간격으로 조회/새로고침하고, 그 화면 DOM에 표시된 열차 목록과 좌석 상태 텍스트를 읽어 잔여석 가능 상태가 발견될 때만 소리와 화면으로 알립니다.

> KORAIL 서버에 직접 조회 요청을 보내는 것 ❌<br>
> 사용자가 직접 열어둔 브라우저 화면을 갱신하고, 화면에 표시된 잔여석 상태만 읽는 것 ✅

## 핵심 동작

1. 사용자가 브라우저에서 KORAIL 예매 페이지에 직접 접속합니다.
2. 사용자가 직접 로그인하고 날짜·구간·승객 조건을 입력합니다.
3. 사용자가 직접 최초 조회를 눌러 열차 목록 화면까지 이동합니다.
4. 프로그램이 현재 브라우저 화면에 연결합니다.
5. 프로그램은 보수적인 간격으로 현재 화면의 `조회`, `다시조회`, `새로고침` 버튼만 누르거나 현재 페이지를 새로고침합니다.
6. 프로그램은 새로 표시된 화면 DOM에서 KTX 열차 목록과 좌석 상태 텍스트를 읽습니다.
7. 전부 매진, 예약대기만 있음, 로딩 중, 열차 목록을 읽지 못한 경우에는 알림을 울리지 않습니다.
8. 일반실·특실·입석·자유석 예매 가능 상태가 화면에 표시되면 반복 알림음과 화면 강조로 알립니다.
9. 실제 예매, 좌석 선택, 결제는 사용자가 직접 KORAIL 화면 또는 코레일톡에서 진행합니다.

## 절대 하지 않는 일

- KORAIL 조회 API 직접 호출
- KORAIL 내부 HTML 엔드포인트 직접 호출
- `fetch`, `axios`, `http`, `https`, `request` 등으로 KORAIL 서버에 직접 요청
- hidden form 값, 세션 쿠키, station code 조합을 이용한 서버 직접 조회
- 자동 로그인
- 자동 예매
- 예약/예매 버튼 자동 클릭
- 자동 결제
- 좌석 자동 선택
- CAPTCHA, 보안 확인, 매크로 탐지, CODE -8003 우회
- 비정상적으로 빠른 반복 요청
- 여러 브라우저/세션/탭을 동시에 반복 조회

프론트엔드의 `fetch`는 `localhost` 로컬 서버 API 호출에만 사용됩니다. KORAIL 서버 직접 호출 코드는 포함하지 않습니다.

## 현재 확인 대상 조건

조건 입력은 프로그램이 KORAIL API로 보내지 않습니다. 아래 조건은 사용자가 KORAIL 브라우저 화면에서 직접 입력해야 하는 목표 조건입니다.

| 구분 | 날짜 | 구간 | 시간 범위 | 승객 수 |
| --- | --- | --- | --- | --- |
| 조건 1 | 2026-05-23 | 광명 → 부산 | 09:00 이상 13:00 이하 | 사용자가 직접 입력 |
| 조건 2 | 2026-05-24 | 부산 → 광명 | 사용자가 직접 입력 | 사용자가 직접 입력 |

## 조회/갱신 간격 정책

- 기본 갱신 간격은 30초입니다.
- 최소 갱신 간격은 20초입니다.
- 20초 미만은 화면과 서버에서 모두 거부합니다.
- 실패 시 즉시 무한 재시도하지 않고 다음 주기까지 기다립니다.
- 여러 탭을 동시에 반복 조회하지 않습니다.
- 화면 로딩이 끝난 뒤 DOM을 읽습니다.

## 파일 구조

```text
korail-ktx-seat-helper/
├─ package.json
├─ server.js
├─ src/
│  ├─ browserController.js
│  ├─ monitor.js
│  ├─ notifier.js
│  └─ pageScanner.js
├─ tests/
│  └─ pageScanner.test.js
└─ public/
   ├─ index.html
   ├─ app.js
   └─ styles.css
```

- `server.js`: 로컬 제어 화면 서버와 로컬 API 라우팅. KORAIL 서버 직접 호출 없음.
- `src/browserController.js`: Chrome DevTools Protocol 기반 브라우저 열기/탭 연결, 조회/다시조회 버튼 클릭 또는 현재 페이지 새로고침, DOM 검사 호출.
- `src/pageScanner.js`: 현재 브라우저 화면 DOM에서 열차 목록과 좌석 상태 텍스트 읽기.
- `src/monitor.js`: 보수적인 주기 화면 갱신 및 검사 루프.
- `src/notifier.js`: 잔여석 발견 알림 상태 관리.
- `public/index.html`: 제어 화면 구조.
- `public/app.js`: 버튼 제어, 상태 표시, 반복 알림음, 브라우저 알림.
- `public/styles.css`: 화면 디자인.

## 설치 및 실행

외부 npm 의존성이 없으므로 `npm install` 없이 실행할 수 있습니다. Chrome 연결은 Node.js의 Chrome DevTools Protocol 연결만 사용합니다.

로컬 서버를 실행합니다.

```bash
npm run dev
```

브라우저에서 다음 주소를 엽니다.

```text
http://localhost:3001
```

종료하려면 실행 중인 터미널에서 `Ctrl + C`를 누릅니다.

## 화면 사용 방법

1. 로컬 화면에서 `브라우저 열기`를 누릅니다.
2. 열린 브라우저 주소창에서 사용자가 직접 KORAIL 예매 사이트에 접속합니다.
3. 사용자가 직접 로그인합니다.
4. 사용자가 직접 광명→부산 또는 부산→광명 조건을 입력하고 열차 목록 화면까지 이동합니다.
5. 로컬 화면에서 `현재 코레일 화면 연결`을 누릅니다.
6. `즉시 1회 화면 갱신 및 검사`를 눌러 현재 화면을 읽을 수 있는지 확인합니다.
7. `모니터링 시작`을 누르면 설정 간격으로 현재 화면 갱신 및 DOM 검사를 반복합니다.
8. 잔여석 발견 알림이 울리면 `알림음 중지`를 누르고 KORAIL 화면에서 직접 예매합니다.

## 로컬 API

### `POST /api/browser/open`

원격 디버깅 포트가 열린 Chrome을 실행하거나 이미 열린 Chrome에 연결할 준비를 합니다. KORAIL 사이트 이동, 로그인, 조건 입력은 사용자가 직접 합니다.

### `POST /api/browser/attach`

현재 열려 있는 브라우저 탭 중 KORAIL 페이지 또는 마지막 탭에 연결합니다.

### `POST /api/check-screen-once`

현재 연결된 브라우저 화면을 한 번 갱신하고 DOM을 읽어 잔여석을 검사합니다.

```json
{
  "refresh": true
}
```

응답에는 `trains`, `availableTrains`, `hasAvailableSeat`, `summary`, `error`가 포함됩니다.

### `POST /api/monitor/start`

현재 연결된 브라우저 화면을 대상으로 모니터링을 시작합니다.

```json
{
  "intervalSeconds": 30
}
```

### `POST /api/monitor/stop`

모니터링을 중지합니다.

### `POST /api/alarm/stop`

알림 상태를 중지합니다. 브라우저에서 재생 중인 소리는 화면의 `알림음 중지` 버튼이 함께 멈춥니다.

### `GET /api/monitor/status`

현재 모니터링 실행 여부, 연결된 브라우저 상태, 마지막 화면 갱신 시각, 다음 갱신까지 남은 시간, 마지막 열차 수, 잔여석 발견 여부, 오류 메시지를 반환합니다.

## 점검 명령

```bash
npm run check
npm run test:scanner
```

## 주의사항

- Chrome DevTools Protocol은 브라우저 화면 조작과 DOM 읽기 용도로만 사용합니다.
- 프로그램은 KORAIL 서버에 직접 POST/GET 요청을 보내지 않습니다.
- 조회/다시조회 버튼을 찾지 못하면 현재 페이지 새로고침으로 대체합니다.
- KORAIL 화면 구조가 바뀌면 `src/pageScanner.js`의 DOM 읽기 로직 수정이 필요할 수 있습니다.
- 잔여석 판정은 화면 텍스트 기반 보조 판단입니다. 최종 예약 가능 여부는 사용자가 KORAIL 화면에서 직접 확인해야 합니다.

## Chrome 연결 참고

`브라우저 열기` 버튼은 Chrome을 `--remote-debugging-port=9222` 옵션으로 실행하려고 시도합니다. 환경에 따라 Chrome 실행 파일을 찾지 못하면 아래처럼 사용자가 직접 Chrome을 실행한 뒤 `현재 코레일 화면 연결`을 누를 수 있습니다.

```bash
google-chrome --remote-debugging-port=9222 --user-data-dir="$PWD/.chrome-monitor-profile"
```

macOS에서는 Chrome 실행 파일 경로가 다를 수 있습니다. 이 기능은 로컬 Chrome DevTools 포트에만 연결하며 KORAIL 서버에 직접 요청하지 않습니다.
