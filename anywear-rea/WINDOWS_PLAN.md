# 입어봄 — Windows RTX 5080 개발 계획

## 목표와 이번 단계

RTX 5080 16GB에서 인물 사진과 의상 사진을 입력받아 착의 이미지를 만드는 로컬 앱을 만든다. 공통 화면은 `studio/`를 사용하고, Windows 단계에서 Python 추론 서버를 연결한다. Mac에서도 화면과 이미지·카메라 입력을 개발할 수 있다.

첫 기능은 **사진·카메라 스냅샷 착의**다. 라이브 영상 편집은 별도 단계다. 카메라 미리보기나 사진 한 장 생성 성공을 실시간 착의 완료로 표시하지 않는다.

이번 인계물에는 추론 서버와 모델 가중치가 없다. `API_CONTRACT.md`와 `studio/api/openapi.json`이 Windows에서 구현할 서버 규격이다.

## 구성

```text
Windows Chrome / Edge
        │ 사진·의상·설정 / 작업 상태 / 결과 이미지
        ▼
공통 프런트엔드: studio/       개발 포트 5178
        │ 같은 출처의 /api 프록시
        ▼
Python FastAPI 서버            로컬 포트 7861
        │ 한 번에 GPU 작업 하나, 모델 재사용
        ▼
FASHN VTON 1.5 + 전처리         RTX 5080 16GB
```

기본 실행 환경은 **Windows 11 + WSL2 Ubuntu + Python 3.11**로 한다. 프런트엔드는 Windows 네이티브나 WSL에서 모두 실행할 수 있다. 모델과 Python 가상환경은 WSL의 Linux 파일시스템에 둔다.

## 순서와 합격 기준

| 단계 | 구현할 것 | 완료 조건 |
| --- | --- | --- |
| W0. 환경 | Windows 드라이버, WSL2, 별도 Python 환경, CUDA PyTorch | WSL과 PyTorch에서 RTX 5080을 인식하고 실제 CUDA 텐서 연산이 성공한다. |
| W1. 사진 추론 | FASHN 코드·가중치·전처리, 고정 입력의 CLI 실행 | 허가된 인물·의상 사진으로 출력 PNG를 만들고 시간·최대 VRAM·입력 조건을 기록한다. |
| W2. 추론 API | 상태 조회, 작업 생성·조회·취소, 결과 이미지 | OpenAPI 계약과 프런트엔드 계약 시험을 통과한다. 중복 요청·모델 누락·OOM·취소·종료를 처리한다. |
| W3. 화면 연결 | 기존 `studio/`를 실제 서버에 연결 | 사진 선택→생성→원본 비교→저장, 카메라 촬영→생성이 실제 GPU 결과로 끝까지 된다. |
| W4. 안정성 | 메모리 수명, 입력 검증, 재시작, 사용 범위 | 반복 작업에 VRAM이 계속 증가하지 않고, 취소·페이지 이탈·서버 중단 뒤 복구한다. 외부 영상 전송이 없다. |
| W5. 라이브 실험 | 별도 환경의 StreamDiffusionV2 1.3B, 필요하면 SANA-Streaming 비교 | 실제 5080의 종단 지연·FPS·최대 VRAM을 측정한다. 의상 참조 조건과 시간적 일관성의 미지원·실패를 표시한다. |

W1이 실패하면 W2의 UI 연결을 실제 생성 성공으로 처리하지 않는다. W5가 실패해도 사진 착의 기능과 검사 결과는 보존한다.

## W0 — 실행 환경

Windows PowerShell에서 현재 환경을 먼저 확인한다.

```powershell
nvidia-smi
wsl --status
wsl --list --verbose
```

WSL이 없을 때만 관리자 PowerShell에서 설치하고 재시작한다.

```powershell
wsl --install -d Ubuntu-24.04
```

NVIDIA 디스플레이 드라이버는 Windows에 설치한다. WSL 안에 Linux용 NVIDIA 디스플레이 드라이버를 중복 설치하지 않는다. WSL에서 `nvidia-smi`가 성공한 다음 Python 환경을 준비한다.

프로젝트용 Python 3.11 가상환경에 다음 조합부터 연결한다.

```bash
python -m pip install torch==2.11.0 torchvision==0.26.0 --index-url https://download.pytorch.org/whl/cu128
python -c "import torch; print(torch.__version__, torch.version.cuda); print(torch.cuda.get_device_name()); print(torch.cuda.get_device_capability()); print(torch.ones(1, device='cuda') + 1)"
```

RTX 5080의 compute capability는 `12.0`이다. CUDA 11.x를 쓰는 오래된 저장소 설치 예제를 그대로 적용하지 않는다. PyTorch가 성공한 뒤에도 ONNX Runtime, xformers, FlashAttention, TensorRT와 커스텀 CUDA 확장은 각각 호환을 확인한다. 다른 모델 환경과 한 가상환경에 섞지 않는다.

공통 진단 도구는 프로젝트 루트에서 실행한다.

```bash
python tools/windows_probe.py
python tools/windows_probe.py --require-cuda
```

두 번째 명령은 실제 CUDA 연산이 안 되면 실패한다. 첫 명령은 GPU 없는 개발 PC에서도 환경 정보를 보여 준다.

## W1 — 사진 착의

공식 `fashn-AI/fashn-vton-1.5` 저장소의 사용할 커밋을 고정하고 의존성 목록을 검토한다. 해당 저장소 안에서 다음 준비 명령을 실행한다.

```bash
python -m pip install -e .
python scripts/download_weights.py --weights-dir ./weights
```

주 가중치와 DWPose 파일뿐 아니라 첫 실행 때 필요한 Human Parser 캐시까지 확보한다. 그다음 네트워크를 끊은 조건에서 재실행하여 추가 다운로드가 없는지 확인한다. 의존성 설치 후 PyTorch 버전과 GPU 텐서 연산을 다시 확인한다.

최초 추론 설정은 아래와 같이 고정한다. 공식 호출 예제는 `LOCAL_MODELS.md`에 있다.

| 항목 | 값 |
| --- | --- |
| 모델 | FASHN VTON 1.5 |
| 입력 | 인물 RGB 이미지 + 의상 RGB 이미지 |
| 종류 | `tops`, `bottoms`, `one-pieces` |
| 상품 사진 | `flat-lay`, `model` |
| 생성 수 | 1 |
| 스텝 | 30 |
| guidance | 1.5 |
| seed | 42 |
| segmentation_free | `True` |

인물·의상 조합은 상의, 하의, 원피스, 팔로 가린 옷, 패턴·로고, 넓은 옷→좁은 옷을 포함한다. 입력과 출력의 이용 허가를 확보한다. 결과를 정답으로 만들거나 실패 사례를 빼지 않는다.

모델을 한 번 올린 뒤 같은 설정으로 반복 실행한다. 초기 로딩 시간, 준비된 모델의 처리시간 중앙값·95백분위, 최대 VRAM, 오류·OOM 횟수를 구분한다. H100의 저자 수치를 5080의 측정값으로 쓰지 않는다.

## W2 — 서버 구현

`engine/` 아래에 Python 서버를 새로 만들고 프런트엔드와 모델 구현을 분리한다. 파일 업로드부터 결과 반환까지의 계약은 `API_CONTRACT.md`를 따른다.

- 서버는 `127.0.0.1:7861`에만 바인딩한다. 외부 공개와 LAN 제공은 별도 범위다.
- 이미지의 실제 형식·크기·픽셀 수를 서버에서도 검사한다. 파일 이름과 MIME만 신뢰하지 않는다. EXIF 방향을 정규화하고 결과에 원본 메타데이터를 싣지 않는다.
- 모델 인스턴스는 재사용하고 GPU 요청은 직렬화한다. 실행 중 추가 요청은 `429`로 거절한다. 결과 보관은 제한된 메모리와 TTL로 관리한다.
- 화면은 한국어 프롬프트 원문을 보낸다. 모델이 영문 지시를 요구하면 서버 어댑터에서 정해진 예시를 매핑하거나 번역 경계를 구현한다. 몰래 외부 번역 API를 호출하지 않는다.
- 취소는 새 프레임·새 스텝 시작을 막고 이전 결과를 폐기한다. 현재 GPU 커널을 즉시 중단할 수 없다면 `cancelling`을 유지하고 실제 종료 후 `cancelled`로 바꾼다.
- 작업 생성·취소는 프로세스별 임의 로컬 토큰으로 보호한다. Host·Origin을 검증한다. 개인정보·사진·토큰을 로그에 남기지 않는다.
- 입력과 결과를 기본으로 디스크에 보관하지 않는다. 다운로드는 사용자가 요청할 때만 한다. 모델 준비를 제외한 추론 중 외부 AI API와 분석 도구를 호출하지 않는다.
- 모형 서버와 합성 응답은 테스트 디렉터리에만 둔다. 실제 앱에서 AI 결과처럼 반환하지 않는다.

## W3·W4 — 실제 연결과 전달

프런트엔드는 `studio/`에서 `npm ci`, `npm run dev`로 실행한다. 개발 서버는 `/api`를 `127.0.0.1:7861`로 전달한다. 엔진을 다른 주소에 둬야 하면 `.env.example`의 프록시 설정만 바꾼다.

검사 순서는 타입·빌드→계약 시험→실제 GPU 통합→브라우저 과업이다. 기존 브라우저 스텁 시험의 통과를 GPU 통합의 통과로 재사용하지 않는다.

최종 제공 형태에서는 Python 서버가 `studio/dist/`를 같은 출처로 제공하도록 연결한다. 개발 폴더 밖의 깨끗한 경로에서 설치·실행·종료·재실행을 확인하고 Windows 시작·종료 명령을 준비한다. 기존 ComfyUI나 다른 모델 환경은 변경하지 않는다.

## W5 — 라이브 영상 연구

사진 착의와 별도 가상환경에서 StreamDiffusionV2 1.3B부터 비교한다. SANA-Streaming은 두 번째 후보로 둔다. 어느 쪽도 현재 공통 화면의 라이브 버튼을 연결했다는 이유만으로 상품 사진 기반 착의 모델이 되지 않는다.

라이브 요청은 이전 프레임의 처리가 끝난 뒤 최신 프레임 하나만 보낸다. 프레임 대기열을 쌓지 않는다. 입력 시점부터 화면 표시까지의 지연, 실제 생성 FPS, 드롭한 프레임, VRAM, 얼굴·의상 세부의 흔들림을 함께 측정한다. 원본 카메라 FPS와 생성 FPS를 구분한다.

16GB를 넘으면 먼저 입력 해상도·클립 길이·배칭을 줄이고 모델이 지원하는 오프로딩·정밀도를 비교한다. 속도와 품질을 함께 기록한다. 공개 BF16 스크립트와 논문의 혼합 정밀도 가속 경로가 다르면 별도 구현으로 취급한다.

## 이용 범위

FASHN 주 모델은 Apache-2.0이지만 기본 Human Parser는 SegFormer의 비상용 조건을 상속한다. 현재 구성은 개인 연구·평가용으로 다룬다. 상용화 전에 해당 부품 교체 또는 별도 권리 확인이 필요하다.

얼굴을 바꾸는 기능은 본인 또는 이용 허가를 받은 자료로 제한하고 합성 결과임을 표시한다. 개인정보·보관·학습 이용·라이선스는 모델과 부품이 바뀔 때 다시 확인한다.
