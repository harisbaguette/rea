# 이 프로젝트가 지키는 표준

산출물: 웹앱, 대시보드, 업무 도구.
국제 표준의 기준 규칙을 바탕으로 이 프로젝트에 맞게 고쳐 쓰는 규칙이다. 작업을 시작할 때마다 읽고 지켜서 만든다.

- '기준 규칙'은 project start(`readiness.py start`)를 다시 돌리면 갱신된다. 손으로 고치지 않는다.
- '이 프로젝트 맞춤'은 AI가 프로젝트 성격에 맞게 쓴다. 더한 규칙, 바꾼 규칙(원래 → 바꾼 것, 까닭), 이 표준을 지킬 계획을 적는다. 맞춤이 기준 규칙보다 앞선다.
- 법이 정한 의무(개인정보, 결제, 등급과 확률 표시, 아동 보호)는 맞춤으로 빼지 않는다.
- 규칙을 어기는 코드나 파일을 만들지 않고, 자동 검사는 시험 명령에 넣어 바뀔 때마다 돌린다.

<!-- standard:iso-25010 -->
## ISO/IEC 25010:2023 제품 품질 모델

소프트웨어 품질을 9가지 특성으로 나눈 국제 표준.

### 기준 규칙

- 기능 적합성, 성능 효율, 호환성, 상호작용 능력, 신뢰성, 보안, 유지보수성, 유연성, 안전 가운데 이 제품에 해당하는 특성의 목표를 요구사항에 적는다.
- 목표마다 확인 방법(시험, 측정, 실제 사용)을 정한다.

원문: `python3 ~/.agents/work-methods/readiness.py source iso-25010`

### 이 프로젝트 맞춤

<!-- custom:iso-25010 -->
대상은 연차를 계획하는 한국 직장인이다. 연휴마다 실제 최저가와 가장 긴 여행을 먼저 비교하고, 같은 목적지의 싸게·길게 대안과 필요한 연차를 보고 선택한다. 공식 도착 시각이 없으면 출근 가능을 확정하지 않는다. 현재 비공개 검증 환경의 동작과 일반 이용자용 출시 완료를 구분한다.
<!-- /custom:iso-25010 -->
<!-- /standard:iso-25010 -->

<!-- standard:wcag -->
## WCAG 2.2 AA 접근성 (ISO/IEC 40500)

장애가 있는 사람도 쓸 수 있게 하는 국제 표준. 웹이 아닌 앱과 문서에는 WCAG2ICT로 적용한다.

### 기준 규칙

- 본문 대비 4.5:1, 큰 글자와 의미 있는 UI 요소의 대비 3:1 등 채택한 WCAG 기준과 예외를 적용한다. 비활성·장식·로고를 본문과 같은 조건으로 판정하지 않는다.
- 모든 기능을 키보드만으로 쓸 수 있게 하고, 포커스가 어디 있는지 보이게 한다.
- 의미 있는 이미지에는 대체 텍스트를, 입력 칸에는 보이는 이름표를 단다.
- 색만으로 정보를 전하지 않는다. 오류는 글로도 알린다.
- 포인터 대상은 WCAG 2.2의 24×24 CSS px 또는 간격 등 명시된 예외 조건을 대조한다. 200% 확대·320 CSS px 리플로에서 정보를 잃지 않아야 하며 지도·표 등 허용 예외는 별도 확인한다.
- 1초에 3번 넘게 번쩍이는 화면을 만들지 않는다.
- 설치형 앱(데스크톱, 모바일)은 운영체제 접근성 API로 화면 요소의 이름, 역할, 상태를 알려 주고, 사용자가 운영체제에서 정한 글자 크기와 대비 설정을 따른다(EN 301 549 11장).
- 대상 국가·업종의 접근성 의무와 채택 표준을 구분한다. EU는 EAA·웹 접근성 지침의 적용 범위와 회원국법, 해당 조화표준의 관보 인용 여부를 확인한다. WCAG 2.2 AA 목표를 모든 법의 동일한 합격선으로 단정하지 않는다.

자동 검사: axe-core(@axe-core/playwright)로 주요 화면 검사; Lighthouse 접근성 점수의 실패 항목 확인

원문: `python3 ~/.agents/work-methods/readiness.py source wcag wcag2ict wcag-em apg en-301-549 accessibleeu-en301549`

### 이 프로젝트 맞춤

<!-- custom:wcag -->
일정·가격·여행기간·대안을 비교하고 상세·저장·공유·복귀까지 진행하는 핵심 과업을 WCAG 2.2 AA로 확인한다. 키보드·모달 포커스·뒤로 이동·320px·확대·대기/빈 결과/부분 실패 상태를 실제 화면과 자동 검사로 대조한다.
<!-- /custom:wcag -->
<!-- /standard:wcag -->

<!-- standard:html -->
## HTML Living Standard

웹 문서를 바르게 쓰는 표준.

### 기준 규칙

- 문서에 lang 속성과 고유한 title을 둔다.
- 버튼은 button, 링크는 a, 영역은 header, nav, main, footer처럼 뜻에 맞는 요소를 쓴다.
- 제목(h1~h6)은 건너뛰지 않고 순서대로 쓴다.

자동 검사: Nu Html Checker(vnu)로 배포 빌드 검사

원문: `python3 ~/.agents/work-methods/readiness.py source whatwg-html`

### 이 프로젝트 맞춤

<!-- custom:html -->
기존 의미 있는 HTML·vanilla JavaScript 구조와 디자인 토큰을 이어 쓴다. 연휴와 실제 요금의 읽는 순서를 DOM 순서에도 반영하고, 버튼은 행동·링크는 이동에 쓴다. 점진 조회의 상태 변화는 보조 기술에서도 이해할 수 있어야 한다.
<!-- /custom:html -->
<!-- /standard:html -->

<!-- standard:https -->
## HTTPS와 HTTP 의미 (RFC 9110, TLS)

웹과 API의 전송 보안과 상태 코드 표준.

### 기준 규칙

- 공개 HTTP 주소는 HTTPS로 제공한다. 로컬 개발·기기 내부 통신은 위협 모델과 플랫폼 조건에 맞게 구분한다.
- 인증서는 자동 갱신한다. 유효기간이 짧아지므로 손으로 갱신하지 않는다.
- 상태 코드를 원인에 맞게 쓴다. 요청 한도 초과는 429, 서비스 전체의 일시 과부하는 503으로 구분하고 재시도 가능 시점은 Retry-After 등 계약으로 알린다.
- 보안 신고 창구를 /.well-known/security.txt에 둔다.

자동 검사: curl -I로 리디렉션과 헤더 확인; Mozilla HTTP Observatory로 보안 헤더 확인

원문: `python3 ~/.agents/work-methods/readiness.py source http-concurrency https-default tls-lifetime security-txt http-429 http-503`

### 이 프로젝트 맞춤

<!-- custom:https -->
정적 화면과 운임 API를 같은 HTTPS 사이트에서 제공한다. 날짜·기간·목적지·옵션을 서버에서 검증하고 입력 오류·요청 제한·원본 장애·부분 실패를 구별한다. Worker 런타임에서 직접 실행해 외부 리디렉션·시간 제한·판매처 HTTPS 연결을 검증한다.
<!-- /custom:https -->
<!-- /standard:https -->

<!-- standard:asvs -->
## OWASP ASVS 5.0 레벨 1과 Top 10:2025

웹과 서버 보안의 국제 검증 기준.

### 기준 규칙

- 권한은 화면이 아니라 서버에서 요청마다 확인한다.
- 외부 입력은 서버에서 검증하고, 화면과 쿼리에 넣을 때 인코딩하거나 매개변수로 넘긴다.
- 채택한 비밀번호 기준을 명시한다. 기본 정책은 NIST SP 800-63B-4를 참고해 단독 인증 최소 15자, 항상 MFA와 함께 쓰면 최소 8자로 두며, 유출 비밀번호를 차단하고 Argon2id 등 적절한 해시·비용으로 저장한다. bcrypt는 기존 시스템의 제한과 이전 계획을 확인한다.
- 비밀 키와 토큰은 코드와 저장소에 넣지 않고 환경 변수나 비밀 저장소에 둔다.
- 세션은 로그아웃과 만료 때 서버에서 끊는다.
- 의존성은 잠금 파일로 고정하고 알려진 취약점을 검사한다.
- 파일 올리기를 받으면 크기 상한을 두고, 확장자와 실제 내용(매직 바이트)이 맞는지 확인하며, 저장 파일 이름은 서버가 새로 만든다.
- 올린 파일은 서버 코드로 실행되지 않는 곳에 두고, 이미지는 다시 인코딩해 위치(GPS), 기기 정보 같은 Exif 메타데이터를 지운다.

자동 검사: gitleaks로 비밀 노출 검사; osv-scanner나 npm audit, pip-audit로 의존성 취약점 검사; OWASP ZAP baseline 검사(공개 서비스)

원문: `python3 ~/.agents/work-methods/readiness.py source asvs owasp-top10-2025 nist-800-63b owasp-auth-tests cipa-exif owasp-password-storage`

### 이 프로젝트 맞춤

<!-- custom:asvs -->
브라우저 입력 → 자체 Worker → 공개 운임 원본 → 외부 판매처의 경계를 유지한다. 연휴 요약과 대안 비교의 추가 호출에도 입력 검증·호출/동시성/응답크기/캐시 상한을 적용한다. 원본에 사용자 IP·쿠키·기기ID·개인토큰을 전달하지 않고 공개 접근·남용·로그 최소화를 실제 설정과 대조한다.
<!-- /custom:asvs -->
<!-- /standard:asvs -->

<!-- standard:data-formats -->
## 데이터 형식 표준 (UTF-8, JSON, ISO 8601/RFC 3339)

문자, 날짜, 데이터 교환의 기본 표준.

### 기준 규칙

- 글자는 UTF-8로 저장하고 주고받는다.
- 시점을 나타내는 값은 UTC 기반 저장과 시간대 있는 RFC 3339 교환 형식 등 일관된 계약을 쓴다. 생일·영업일처럼 날짜 자체인 값과 지역 시각은 구분하며 임의로 시간대를 붙이지 않는다.
- JSON 등 교환 형식을 정하고 금액에는 통화·정밀도·반올림 규칙을 둔다. 정수 최소 단위나 정확한 decimal을 사용하며 부동소수점 오차를 확인한다.
- 미래·반복 일정에는 IANA 시간대와 지역 시각을 보존하고 서머타임의 중복·없는 시각을 처리한다. 교환 형식은 소비자 지원에 맞추며 RFC 9557 등 채택한 형식으로 왕복 시험한다.
- 나라 식별에는 ISO 3166-1 등 계약한 코드를 쓰고, 전화번호는 서비스 대상의 국제 번호·내선·국내 전용 번호를 구분해 검증한다.
- 사용자 텍스트의 검색·동등성 비교에는 필요한 유니코드 정규화 정책을 정한다. 서명된 원문·암호학적 바이트·파일 경로 등 원형이 중요한 값은 임의로 정규화하지 않는다.

원문: `python3 ~/.agents/work-methods/readiness.py source rfc3339 rfc8259 rfc9557 iana-tz iso-3166 itu-e164 w3c-charmod-norm`

### 이 프로젝트 맞춤

<!-- custom:data-formats -->
휴가는 Asia/Seoul 날짜로 계산하고 2026→2027 해 경계를 처리한다. 원본 왕복 운임·조회된 최저가·가장 긴 여행·노선 평균·관측 이력을 구분한다. 귀국편 출발일·한국 도착일·휴가 마지막 날을 섞지 않으며, 운항 시각이 있는 경우에만 출처와 시간대가 확인된 시각을 사용한다.
<!-- /custom:data-formats -->
<!-- /standard:data-formats -->

<!-- standard:web-vitals -->
## Core Web Vitals (LCP 2.5초, INP 200ms, CLS 0.1) — 공개 웹 페이지일 때

웹 화면 속도와 안정성의 업계 기준.

### 기준 규칙

- 이미지는 크기를 지정하고 적절한 형식과 크기로 내보낸다.
- 첫 화면에 필요 없는 스크립트는 늦게 불러온다.
- 광고나 늦게 뜨는 요소가 내용을 밀어내지 않게 자리를 잡아 둔다.
- 사진은 AVIF나 WebP로 내보내고, srcset과 sizes로 화면 크기에 맞는 파일을 받게 하며, 첫 화면 밖 이미지는 loading="lazy"로 늦게 받는다.
- 파일 이름에 내용 해시가 붙은 정적 파일은 Cache-Control: max-age=31536000, immutable로 오래 캐시하고, HTML은 매번 새로 확인하게 한다.

자동 검사: Lighthouse 성능 측정; web-vitals 라이브러리나 PageSpeed Insights로 실제 사용자 값 확인

원문: `python3 ~/.agents/work-methods/readiness.py source web-vitals page-experience aom-avif rfc9649 rfc8246 whatwg-html`

### 이 프로젝트 맞춤

<!-- custom:web-vitals -->
최종 배포물의 연휴 요약·상세 전환을 PC·휴대전화·대표 네트워크 조건에서 측정한다. 점진 조회는 즉시 피드백과 이미 받은 결과를 보존하고 늦은 응답이 새 선택을 덮지 않도록 한다. 실험실 측정과 출시 뒤 실제 사용자 75백분위 자료를 구분하고 없는 현장 값을 통과했다고 쓰지 않는다.
<!-- /custom:web-vitals -->
<!-- /standard:web-vitals -->

<!-- standard:supply-chain -->
## 공급망 보안 (NIST SSDF, SLSA, SBOM) — 배포물을 다른 사람에게 줄 때

배포물이 무엇으로 만들어졌는지 밝히고 안전하게 빌드하는 기준.

### 기준 규칙

- 빌드 입력·의존성·명령·배포물을 추적하고 깨끗한 환경에서 재현한다. 채택한 SLSA 수준·계약이 요구하면 격리된 hosted build와 provenance 검증을 적용한다.
- 의존성 목록과 라이선스를 실제 배포물과 맞춘다. 계약·규제·유통 요구와 위험에 따라 CycloneDX나 SPDX SBOM을 생성하고 누락·오래된 목록을 검사한다.
- 배포 계정은 2단계 인증을 켜고, 배포 토큰은 범위와 기한을 좁힌다.
- 취약점 신고를 받는 곳과 처리 절차(접수 확인, 수정, 공개)를 SECURITY.md에 적고, 고친 취약점은 보안 공지로 알린다(ISO/IEC 29147, 30111).

자동 검사: syft나 cdxgen으로 SBOM 생성; OpenSSF Scorecard(공개 저장소)

원문: `python3 ~/.agents/work-methods/readiness.py source ssdf slsa cyclonedx spdx scorecard iso-29147 cra`

### 이 프로젝트 맞춤

<!-- custom:supply-chain -->
현재 잠금 의존성과 기존 에셋을 재사용한다. 추가한 외부 API·SDK·패키지가 있으면 라이선스·지원 상태·취약점·배포 포함물을 다시 확인한다. Worker·화면·입력 계약을 같은 버전으로 빌드하고 개발 폴더 밖과 실제 원격 런타임에서 검증한다.
<!-- /custom:supply-chain -->
<!-- /standard:supply-chain -->

<!-- standard:licensing -->
## 라이선스 표기 (SPDX, REUSE)

코드, 글꼴, 그림, 소리를 쓸 권리를 밝히는 표준.

### 기준 규칙

- 가져다 쓴 코드와 에셋의 라이선스를 확인하고 출처를 ASSETS.md나 고지 파일에 남긴다.
- 배포할 코드의 이용 조건을 LICENSE 등으로 명확히 한다. 표준 라이선스는 SPDX 식별자를 사용하고 사유·내부 코드에 임의의 오픈소스 라이선스를 붙이지 않는다.
- 상업 이용, 변형, 재배포 조건이 맞지 않는 에셋은 쓰지 않는다.

자동 검사: reuse lint; license-checker나 pip-licenses로 의존성 라이선스 목록 만들기

원문: `python3 ~/.agents/work-methods/readiness.py source spdx-licenses reuse cc`

### 이 프로젝트 맞춤

<!-- custom:licensing -->
사진·글꼴·아이콘의 기존 출처와 이용 조건은 ASSETS.md와 라이선스 파일로 유지한다. 운임 및 공식 운항 시각의 일반 재표시·제휴·데이터 이용조건은 원문으로 확인한다. 익명 조회 성공이나 사실 데이터라는 이유만으로 일반 제공 권한을 확정하지 않는다. 현재 제한된 접근 배포와 일반 출시를 구분하며 실제 외부 계약·권한이 필요한 경우 미해결 조건으로 남긴다.
<!-- /custom:licensing -->
<!-- /standard:licensing -->

<!-- standard:graphics -->
## 그래픽 형식과 색 (SVG, PNG, sRGB, 인쇄는 PDF/X)

로고, 아이콘, 그림 파일을 어디서나 같게 보이게 하는 표준.

### 기준 규칙

- 로고와 아이콘은 SVG 원본을 두고, 필요한 크기의 PNG를 함께 내보낸다.
- 화면용 색과 이미지는 sRGB로 만든다. 인쇄물은 인쇄소가 요구하는 PDF/X 형식과 CMYK 사양으로 낸다.
- 브랜드 색은 HEX와 RGB 값으로 적어 디자인과 코드가 같은 값을 쓰게 한다.
- 공개하는 사진에서는 위치(GPS), 기기 일련번호 같은 Exif 정보를 지운다. C2PA 내용 증명은 남긴다.

자동 검사: SVGO로 SVG 정리; ImageMagick identify로 색 공간과 크기 확인

원문: `python3 ~/.agents/work-methods/readiness.py source svg2 png3 srgb cipa-exif`

### 이 프로젝트 맞춤

<!-- custom:graphics -->
기존 자체 제공 WebP 여행 사진과 SVG 아이콘을 토큰과 함께 사용한다. 연휴별 가격·기간과 실제 대안의 읽는 순서를 이미지보다 우선한다. 좁은 화면·긴 한국어·가격 자리수·상태별 렌더를 확인하고 에셋 출처를 유지한다.
<!-- /custom:graphics -->
<!-- /standard:graphics -->

<!-- standard:privacy -->
## 개인정보 보호 (한국 개인정보보호법, GDPR) — 개인정보를 모을 때(문의 폼, 회원, 분석 도구, 광고, 댓글 포함)

개인정보를 모을 때 지키는 법.

### 기준 규칙

- 꼭 필요한 정보만 모은다. 문의 폼도 답장에 필요한 칸만 둔다.
- 무엇을 왜 얼마나 보관하는지 처리방침에 적고, 모든 페이지에서 처리방침으로 갈 수 있게 한다.
- 분석 도구, 광고, 필수가 아닌 쿠키는 대상 지역 규칙에 맞게 미리 알리고, 동의가 필요한 곳에서는 동의 전에 켜지 않는다.
- 한국에서 동의가 필요한 만 14세 미만 개인정보 처리는 법정대리인의 동의와 확인을 거친다. 미국 COPPA와 EU 회원국의 아동 기준은 적용 범위를 따로 확인한다.
- 사용자가 자기 정보를 보고 지우고 탈퇴할 수 있게 한다.
- 적용되는 다른 법은 regulations.md의 판별 질문으로 가린다.
- EEA, 영국, 스위스 사용자에게 Google AdSense, Ad Manager, AdMob 맞춤 광고를 띄우면 Google 인증을 받은 CMP(IAB TCF 연동)로 동의를 받는다.

원문: `python3 ~/.agents/work-methods/readiness.py source kr-privacy gdpr-scope cookies google-cmp kr-child-consent gdpr-official us-coppa`

### 이 프로젝트 맞춤

<!-- custom:privacy -->
저장한 여행은 해당 브라우저에서만 보관하고 삭제할 수 있게 한다. 자체 회원·메일·업로드·추적 광고를 추가하지 않는다. 일반 이용자 제공 전 요청제한용 IP 메모리·호스팅 로그·외부 운임 전송의 목적과 보존 범위를 실제 코드와 플랫폼 설정에서 확인하고 필요한 안내를 제공한다. 사용자 식별정보는 운임 원본이나 판매처 연결 생성 API로 보내지 않는다.
<!-- /custom:privacy -->
<!-- /standard:privacy -->

<!-- standard:fonts -->
## 글꼴 형식 (Open Font Format ISO/IEC 14496-22:2026 = OpenType, WOFF2) — 글꼴 파일을 직접 넣거나 브랜드 글꼴을 정할 때

글꼴 원본과 웹 글꼴을 어디서나 같게 쓰는 표준 형식.

### 기준 규칙

- 글꼴 원본은 OpenType(.otf, .ttf)으로 두고 라이선스 파일을 함께 보관한다.
- 글꼴 라이선스가 웹 임베딩, 앱 포함, PDF 포함을 허용하는지 쓰기 전에 확인한다.
- 웹에 싣는 글꼴은 WOFF2로 내보낸다.
- 한글처럼 글자 수가 많은 글꼴은 쓰는 글자만 남기거나 unicode-range로 나눠 받게 해 첫 화면 용량을 줄인다.

자동 검사: fonttools(pyftsubset --flavor=woff2)로 서브셋과 WOFF2 변환

원문: `python3 ~/.agents/work-methods/readiness.py source off-iso14496-22 w3c-woff2 ms-opentype`

### 이 프로젝트 맞춤

<!-- custom:fonts -->
PretendardVariable.woff2를 자체 제공하고 SIL Open Font License 1.1 고지를 유지한다. 한국어 긴 문장·숫자·320px·확대와 글꼴 로딩 실패에서도 주 행동을 사용할 수 있어야 한다.
<!-- /custom:fonts -->
<!-- /standard:fonts -->

<!-- standard:web-security-headers -->
## 웹 보안 헤더와 쿠키 (HSTS RFC 6797, CSP, CORS, SRI, 쿠키 속성)

브라우저가 내 사이트를 안전하게 다루도록 응답에 붙이는 헤더와 쿠키 설정.

### 기준 규칙

- 공개 HTTPS 서비스에는 배포·하위 도메인 영향을 확인한 HSTS 정책을 적용한다. max-age·includeSubDomains·preload는 운영 범위에 맞게 정한다.
- CORS가 필요 없으면 열지 않고, 필요하면 origin·메서드·헤더·credentials를 제한한다. 비인증 공개 API의 wildcard 예외는 이유와 범위를 남긴다. CORS는 서버 인증·권한을 대신하지 않는다.
- 민감 쿠키는 HTTPS에서 Secure를 쓰고 세션에는 HttpOnly·용도에 맞는 SameSite를 적용한다. 호환되는 범위에서 __Host- 또는 __Secure- 접두어를 사용하며 외부 로그인·결제 복귀를 시험한다.
- Content-Security-Policy로 스크립트를 불러올 출처를 제한하고, frame-ancestors로 다른 사이트에 끼워 넣기를 막고, X-Content-Type-Options: nosniff를 보낸다.
- 외부 CDN에서 불러오는 스크립트와 스타일에는 SRI(integrity 속성)를 단다.

자동 검사: Mozilla HTTP Observatory; curl -I로 응답 헤더 확인

원문: `python3 ~/.agents/work-methods/readiness.py source asvs owasp-headers rfc6797 w3c-csp3 w3c-sri owasp-rest-security`

### 이 프로젝트 맞춤

<!-- custom:web-security-headers -->
같은 출처 스크립트·스타일·글꼴·이미지·API 범위로 CSP·CORS를 제한하고 nosniff·Referrer·frame-ancestors를 유지한다. 상세 공유 URL은 검증한 입력만 복원하며 판매처 링크는 허용 HTTPS 주소로만 이동한다. 비공개 검증용 인증 정보는 다른 호스트에 전파하거나 파일에 기록하지 않는다.
<!-- /custom:web-security-headers -->
<!-- /standard:web-security-headers -->

<!-- standard:observability -->
## 로그와 요청 추적 (W3C Trace Context, OpenTelemetry, OWASP Logging) — 서버나 늘 도는 봇을 운영할 때

운영 중인 서버에서 문제를 찾아낼 수 있게 남기는 로그와 추적 기준.

### 기준 규칙

- 로그는 한 줄에 한 사건씩 JSON 같은 구조화 형식으로 남기고, 시각(UTC나 시간대 포함), 수준, 요청 ID를 넣는다.
- 서비스 사이를 오가는 요청은 W3C traceparent 헤더로 이어서 한 요청을 끝까지 따라갈 수 있게 한다.
- 비밀번호, 액세스 토큰, 세션 ID, 카드 정보, 민감한 개인정보는 로그에 그대로 남기지 않고 지우거나 가린다.
- 로그인 성공과 실패, 권한 거부를 기록한다.

자동 검사: OpenTelemetry SDK 자동 계측; gitleaks로 로그 샘플 속 비밀 검사

원문: `python3 ~/.agents/work-methods/readiness.py source w3c-trace-context otel-logs owasp-logging asvs`

### 이 프로젝트 맞춤

<!-- custom:observability -->
연휴 요약·대안·원본·판매처 요청의 실패와 부분 성공을 구별할 수 있게 한다. 로그에는 요청 ID·경로·상태·시간 등 필요한 정보만 남기고 IP·쿠키·개인토큰을 남기지 않는다. 공개 제공 전 관측·복구·요청 제한의 실제 운영 경계를 확인한다.
<!-- /custom:observability -->
<!-- /standard:observability -->

<!-- standard:plain-language -->
## 쉬운 글 (ISO 24495-1:2023)

읽는 사람이 필요한 내용을 찾고 이해하고 쓸 수 있게 글을 쓰는 국제 표준.

### 기준 규칙

- 쓰기 전에 읽는 사람, 읽는 목적, 읽는 상황을 정하고 거기에 필요한 내용만 넣는다.
- 제목, 목차, 목록으로 필요한 내용을 쉽게 찾게 짠다.
- 읽는 사람이 아는 낱말과 짧고 분명한 문장을 쓰고, 전문 용어는 처음 나올 때 풀어 쓴다.
- 대상 독자 몇 명에게 읽혀 보고 찾고 이해하고 쓸 수 있는지 확인한 뒤 고친다.

원문: `python3 ~/.agents/work-methods/readiness.py source iso-24495-1 iplf-iso-standard google-writing`

### 이 프로젝트 맞춤

<!-- custom:plain-language -->
연휴마다 얼마에 얼마나 여행할 수 있는지 먼저 보여 주고, 선택한 목적지의 싸게·길게 대안을 같은 단위로 비교한다. 귀국편 출발일과 실제 한국 도착 가능 여부·미확인 조건은 관련 행동 가까이에 쓴다. 사용자가 내부 API·검사 기록을 읽게 하지 않는다. AI가 최종본의 PC·모바일 핵심 과업을 직접 수행하며 사람 대상 연구라고 표현하지 않는다.
<!-- /custom:plain-language -->
<!-- /standard:plain-language -->

<!-- standard:risk-prevention -->
## 법적·보안 위험 예방 (한국 기본, 해외 조건별)

가입·수집·추적·발송·결제·업로드에서 처음부터 예방할 위험.

### 기준 규칙

- 한국을 기본 검토 지역으로 삼고 사업 거점·제공 대상·데이터 흐름에 따라 해외 법을 추가한다. 한국 법만 적용된다는 뜻이 아니다. 적용 범위가 미정이면 확인 필요로 둔다.
- 구현 전에 코드·외부 서비스 설정의 법적·보안 위험을 확인한다. 무료, 매출 0, 개인 개발, 혼자 쓰는 도구라는 이유로 일괄 면제하지 않는다.
- 아동의 연령·동의 요건, 개인정보 수집·국외 이전·삭제, 외부 폰트·SDK 호출과 세션 재생을 설계에서 점검한다. 세션 재생은 기본 끔, 폰트는 라이선스가 허용하면 자체 호스팅을 우선한다.
- 광고성 메시지의 동의·발신자·수신 거부와 구독의 요금·주기·갱신 동의·취소를 실제 동작으로 연결한다.
- 업로드 저작권 신고·게시 중단·이의 처리, 판매자 표시·환불과 개인정보 사고 대응을 적용 관할에 맞게 준비한다.
- 인증·권한·입력·파일·비밀키·의존성·결제 위조·남용을 해당 경로에서 시험하고 정상 동작도 확인한다.
- 주소·가격·사업자번호를 만들지 않는다. 모르는 사실, 외부 등록과 대시보드 미확인을 남기고 관련 작업은 확인 전 완료하지 않는다.
- 미성년자 계약, 개인정보 처리업체 계약·감독, 정보주체 권리와 광고 공유 거부, 접근성, AI·규제 제품·세금·정산 의무도 실제 기능·대상국에 맞게 확인한다.
- 공식 원문과 시행 상태는 착수·출시·범위 변경 때 확인한다. 검사 무검출이나 체크리스트 완료를 소송 방지·법적 준수·보안의 보장으로 쓰지 않는다.

원문: `python3 ~/.agents/work-methods/readiness.py source kr-child-consent kr-overseas-transfer kr-ecommerce-guidance kr-spam gdpr-official us-coppa us-can-spam us-ca-renewal us-dmca asvs`

### 이 프로젝트 맞춤

<!-- custom:risk-prevention -->
일반 한국 직장인이 사용할 제품이 목표다. 현재 Sites의 본인1명 비공개 접근은 검증 환경이며 목표 축소나 서비스 전체 완료 근거가 아니다. 일반 제공 전 운임/운항 시각 데이터 이용조건·표시 정확성·접근/로그/운영과 적용 법적 의무를 실제 원문·코드·설정으로 확인한다. 조사 결과 외부 권한·계약이 필요하면 구체적인 막힘을 기록하고 독립적으로 할 수 있는 개선을 계속한다.
<!-- /custom:risk-prevention -->
<!-- /standard:risk-prevention -->

## 이 프로젝트만의 규칙과 계획

<!-- custom:project -->
연휴별 실제 가격·가장 긴 여행을 먼저 비교하고 같은 목적지의 실제 싸게·길게 대안을 선택하는 흐름을 만든다. 연휴 요약은 점진 조회와 제한된 동시성·캐시를 사용한다. 2026→2027 휴가, 모바일 과업 순서, 상세 뒤로·재진입·URL 공유, 저장·캘린더를 같은 날짜/상태 계약으로 연결한다. 공식 운항 시각이나 일반 데이터 제공 권한을 확보하지 못하면 추정으로 채우거나 전체 완료로 선언하지 않는다. 기존 Sites에 실제 Worker와 화면을 재배포하며 사용자 전면 화면을 활성화하지 않는다.
<!-- /custom:project -->

## 해당 없음으로 뺀 표준

<!-- custom:skipped -->
- 표 데이터 교환 (CSV RFC 4180, CSV 수식 주입 방지): CSV 가져오기·내보내기가 없다.
- 개인 데이터 비식별 (NIST SP 800-188, ISO/IEC 20889, 한국 가명정보 처리 가이드라인 2026.3): 사용자 원시 데이터셋·가명정보 처리·공유가 없다.
- QR 코드 (ISO/IEC 18004:2024): QR 생성·인식을 제공하지 않는다.
- 아동 대상 설계 (UK Age Appropriate Design Code, IEEE 2089-2021): 성인 직장인의 연차 일정 조회 도구이며 아동 대상 기능·계정·프로파일링이 없다.
- Web App Manifest: 앱 설치·오프라인 서비스워커 기능을 제공하지 않는다.
- OAuth 2.0 보안 모범 사례와 OpenID Connect (RFC 9700, RFC 7636 PKCE, OIDC Core = ISO/IEC 26131:2024): 자체 소셜 로그인·OAuth·OpenID Connect 권한 위임 기능이 없다.
<!-- /custom:skipped -->

## 다 됐는지 확인

계획 지도의 '완성 기준' 작업이 이 표준을 포함한 점검 목록이다. 모두 증거와 함께 끝나야 완성이다.
