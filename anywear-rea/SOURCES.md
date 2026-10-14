# 출처와 분석 근거

## 대상과 동일성

- 조사 대상: Decart.AI의 Anywear, Chrome extension ID `hijnklblgecbdlhjiofhlhjpndpifejh`.
- [공식 Chrome Web Store](https://chromewebstore.google.com/detail/anywear-live-virtual-try/hijnklblgecbdlhjiofhlhjpndpifejh).
- Google 공식 업데이트 서버에서 받은 [CRX 원본](artifacts/anywear.crx)의 manifest 버전: **2.18**. 웹스토어가 표시한 2.16과 달라, 코드 판단은 확보한 2.18을 기준으로 했다.
- SHA-256: `a32e1285b40694e589642e8a38efbfadf835fa94fd400fe78733cc9e817a394d`.
- 확보일: 2026-10-14, 사용자 시간대 Asia/Seoul 기준.
- [다운로드 URL·파일 크기·해시](evidence/anywear.crx.metadata.json), [원본 manifest](artifacts/extension/manifest.json).
- 비슷한 이름의 다른 앱·서비스·GitHub 프로젝트는 이 대상의 구현 근거로 쓰지 않았다.

## 문서의 주장과 근거

| 설명 | 공식 자료 또는 배포 코드 |
| --- | --- |
| Anywear의 운영 주체, 베타 무료 안내 | [Anywear 공식 페이지](https://anywear.decart.ai/), [확보한 페이지](artifacts/anywear.html) |
| 대기열 → 접속 토큰 → SDK 연결 | `widget.bundle.js`: `DF`, `dU`, `/api/queue/join`, `/api/queue/status` |
| 기본 모델과 서버의 모델 변경 | `widget.bundle.js`: `LU`, `sU`, `XN || LU` |
| 원격 영상 수신·재생 | `widget.bundle.js`: `realtime.connect`, `onRemoteStream`, `fF.srcObject` |
| 이미지 전달·프록시 | `widget.bundle.js`: `MF`, `BF`, `zF`, `HU.setImage`; `config.js` |
| WebSocket·LiveKit·WebRTC | `widget.bundle.js`의 SDK: `livekit_join`, `publishLocalTracks`, `RTCPeerConnection` |
| 동시 접속 제한의 두 계층 | [배포물에 포함된 개발 메모](artifacts/extension/docs/decart-session-limit.md). 과거 기록이며 현재 전 세계 한도가 아님 |
| 무료 체험과 결제 경로 존재 | `billing.js`: `/api/consumer-billing/status`, `free_pass_available`; `widget.bundle.js`: `subscription_required` |
| 일반·빠른 모드 단가와 생성 시간 과금 | [공식 Pricing](https://docs.platform.decart.ai/getting-started/pricing) |
| 의류 전용 모델과 최신 별칭 | [공식 Virtual Try-On](https://docs.platform.decart.ai/models/realtime/virtual-try-on) |
| 인물·헤어·배경·물체 편집 | [공식 Lucy 2.5](https://docs.platform.decart.ai/models/realtime/lucy-2.5), [공식 Prompting Guide](https://docs.platform.decart.ai/models/realtime/lucy-2.5-prompting) |
| 단기 토큰과 세션 시간 제약의 차이 | [공식 Client Tokens](https://docs.platform.decart.ai/getting-started/client-tokens) |
| 로컬 얼굴 추적·표정·효과 배치 | [Google MediaPipe Web Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js) |
| 입력·출력의 학습 이용 조항 | [API Terms §2.3](https://docs.platform.decart.ai/resources/api-terms). 이 조항으로 특정 세션의 실제 학습 이용 여부를 확정할 수 없음 |
| 인물 사진의 이용권·동의, 사칭 합성 제한 | [API Terms §4.3](https://docs.platform.decart.ai/resources/api-terms), [Acceptable Use Policy](https://docs.platform.decart.ai/resources/aup) |
| 영상·개인정보의 처리와 보관 설명 | [공식 Privacy Policy](https://docs.platform.decart.ai/resources/privacy-policy). Anywear 세션별 보관·학습 제외 조건은 미확인 |

## REA 분석 범위

[REA 원본 결과](evidence/rea-extension.json.gz)의 Evidence ID는 `ev_e268b4283984190620cb9ce4e2c2a96a3eead589b161f3b5f6c9d3e92ee23cde`다. JSON은 gzip으로 무손실 압축했으며 [압축 전후 해시](evidence/rea-extension.metadata.json)를 보존했다.

`manifest.json`, `config.js`, `widget-init.js`, `background.js`, `widget-core.js`, `stream-quality.js`, `connection-indicator.js`, `billing.js`, `widget.bundle.js`의 9개 파일을 선택했다. JavaScript 8개 파일의 파싱 실패는 0이다. 선택 밖의 관련 파일 19개와 의미 그래프의 노드 한도 때문에 **분석 범위는 부분적**이다. REA가 전체 프로그램의 모든 호출 관계를 복원했다고 해석하지 않는다.

선택한 파일을 직접 읽어 카메라 입력, 모델 선택, 큐, 토큰, SDK 연결과 원격 출력의 인접 코드를 대조했다. 코드가 있다는 관찰과 실제 사용자 세션에서 실행됐다는 관찰을 구분한다. 대상 확장 프로그램을 설치하거나 원본 JavaScript를 실행하지 않았다. 실시간 모델의 품질·지연과 실제 청구도 시험하지 않았다.

- [코드 관찰별 정확한 바이트 위치·해시·분석 한계](evidence/findings.json)
- [공식 문서 스냅샷 목록과 해시](evidence/official-sources.json)
- [비용 계산 시나리오](evidence/cost-scenarios.json)
- [오프라인 검사 결과](evidence/verification.json)

비용 계산 도구는 다음처럼 실행한다. `--seconds`에는 대기 시간을 제외한 실제 생성 시간을 넣는다.

```bash
python3 tools/cost.py --seconds 60 --sessions 1000
python3 tools/cost.py --seconds 30 --mode fast
python3 tools/verify.py
```

원본 코드는 분석 자료다. 상용 복제나 재배포 라이선스를 확보했다는 뜻은 아니며, 재구현 설계는 공개 SDK/API를 사용하는 별도 구현을 전제로 한다.
