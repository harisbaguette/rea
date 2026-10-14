# Windows에서 이어서 작업하기

다음 지시를 이 프로젝트 폴더를 연 코딩 에이전트에 전달한다.

> `WINDOWS_PLAN.md`와 `API_CONTRACT.md`, `studio/api/openapi.json`, `LOCAL_MODELS.md`를 읽고 Windows RTX 5080의 W0부터 순서대로 진행하라. 기존 `studio/` 프런트엔드와 REA 자료를 보존하라. 실제 GPU 환경을 먼저 확인하고 별도 가상환경에서 FASHN 사진 착의를 실행한 뒤 `engine/`에 추론 서버를 구현하라. 테스트 스텁을 실제 생성 결과로 취급하지 말고, UI에서 실제 입력→생성→비교→저장까지 직접 시험하라. GPU 시간·VRAM·오류 복구를 측정하고 기본 Human Parser의 비상용 제한을 유지하라. 라이브 영상은 사진 착의가 통과한 뒤 별도 단계로 진행하라. 모델과 공통 화면을 처음부터 다시 만들지 말라.

옮길 것은 `studio/`, 계획·규격 문서, `tools/windows_probe.py`, 모델 조사 문서다. `node_modules/`, 개인 사진, API 키, Mac 가상환경은 옮기지 않는다. Windows에서 `studio/`의 `npm ci`로 의존성을 다시 설치한다.

AI 추론 엔진과 GPU 통합은 아직 구현되지 않았다. 다음 단계의 첫 완료 조건은 실제 RTX 5080의 CUDA 텐서 연산 성공이다.
