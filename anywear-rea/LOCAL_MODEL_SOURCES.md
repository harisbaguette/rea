# 로컬 모델 판단의 근거

조사 기준일: 2026-10-14. 비교 대상은 8개이며 8개 모두 공개 코드·모델 카드·논문 중 해당 자료를 직접 대조했다. 성능 수치는 저자의 보고이며 RTX 5080 실측은 없다. 개발 범위는 공통 프런트엔드와 Windows 후속 계획으로 제한했다.

## 계보와 공개 API

| 근거 | 주소 | 대조 내용 | 보존 파일 |
|---|---|---|---|
| Lucy Edit Dev 모델 카드 | https://huggingface.co/decart-ai/Lucy-Edit-Dev | Wan2.2 5B 기반, 텍스트 지시 영상 편집, 비상용 라이선스 | `lucy-card.md` |
| Lucy Edit 1.1 Dev 모델 카드 | https://huggingface.co/decart-ai/Lucy-Edit-1.1-Dev | Wan2.2 5B, LucyEditPipeline, 832×480/81프레임 예제 | `lucy11-card.md` |
| Lucy 라이선스 원문 | https://d2drjpuinn46lb.cloudfront.net/LUCY_EDIT-Non_Commercial_License_17_Sep_2025.pdf | 비상용·비운영 환경 제한. 출력물 이용과 모델 운영 권한 구별 | `lucy-license.pdf`, `lucy-license.txt` |
| Lucy 2.5 문서 | https://docs.platform.decart.ai/models/realtime/lucy-2.5 | 실시간 영상 편집 API의 기능·연결 방식. Wan 기반이라는 공개 설명은 찾지 못함 | `lucy25.md` |
| Lucy VTON 문서 | https://docs.platform.decart.ai/models/realtime/virtual-try-on | 영상+의상 참조, VTON latest=3.6, 3.5 제공 | `vton.md` |
| Lucy VTON 3.5 API 명세 | https://docs.platform.decart.ai/api-reference/lucy-vton-35 | 명명된 API 모델. 공개 Lucy Edit와 같은 가중치라는 근거는 없음 | `vton35.md` |

Anywear의 `lucy-vton-3.5` 기본값과 서버 override는 기존 REA의 `REPORT.md` 및 그 연결 근거를 재사용했다. 그 배포 코드가 서버 내부 아키텍처를 증명하지는 않는다.

## 사진 착의

| 근거 | 주소 | 대조 내용 | 보존 파일 |
|---|---|---|---|
| FASHN VTON 코드 | https://github.com/fashn-AI/fashn-vton-1.5 | Apache-2.0, 인물+의상 입력, 공식 설치·가중치 명령 | `fashn-readme.md`, `fashn-pyproject.toml` |
| FASHN 모델 카드 | https://huggingface.co/fashn-ai/fashn-vton-1.5 | 약 8GB VRAM, H100 약 5초, 576×864, 한계 | `fashn-card.md` |
| FASHN 실제 파이프라인 | https://github.com/fashn-AI/fashn-vton-1.5/blob/main/src/fashn_vton/pipeline.py | 실제 함수 인자, 항상 로드되는 human parser, bf16 선택 조건 | `fashn-pipeline.py` |
| FASHN 추론 예제 | https://github.com/fashn-AI/fashn-vton-1.5/blob/main/examples/basic_inference.py | category·garment_photo_type·steps·seed·device | `fashn-example.py` |
| FASHN 다운로드 코드 | https://github.com/fashn-AI/fashn-vton-1.5/blob/main/scripts/download_weights.py | 모델·DWPose 경로와 parser 다운로드 | `fashn-weights.py` |
| FASHN Human Parser | https://github.com/fashn-AI/fashn-human-parser | SegFormer 라이선스 상속 | `parser-readme.md`, `parser-license.txt` |
| SegFormer LICENSE | https://github.com/NVlabs/SegFormer/blob/master/LICENSE | §3.3 연구·평가 비상업 제한 | `segformer-license.txt` |
| CatVTON | https://github.com/Zheng-Chong/CatVTON | 약 8GB/1024×768/bf16, SD1.5 inpainting 기반, 마스크 전처리, CC BY-NC-SA4.0 | `catvton-readme.md`, `catvton-pipeline.py` |

FASHN 전체 파이프라인의 상용 가능성을 반증하려고 의존성을 따라갔으며 parser의 비상용 제한을 확인했다. 주 모델의 Apache-2.0 표기만으로 전체 구성을 상용 가능으로 분류하지 않았다.

## 스트리밍

| 근거 | 주소 | 대조 내용 | 보존 파일 |
|---|---|---|---|
| StreamDiffusion | https://github.com/cumulo-autumn/StreamDiffusion | 브라우저 웹캠·화면 img2img. 4090/i9-13900K/Ubuntu22.04.3, SD-Turbo 1-step 93.897FPS. 오래된 설치 예제 | `stream-readme.md`, `stream-license.txt` |
| StreamDiffusionV2 코드 | https://github.com/chenfengxu714/StreamDiffusionV2 | Linux, 1.3B/14B 공개 다운로드, Blackwell용 torch2.11/vision0.26, 단일GPU 경로 | `streamv2-readme.md`, `streamv2-license.txt` |
| StreamDiffusionV2 웹 데모 | https://github.com/chenfengxu714/StreamDiffusionV2/blob/master/demo/README.md | 실제 webcam/screen V2V, Python3.10+Node18, 기본 호스트0.0.0.0 | `streamv2-demo.md` |
| StreamDiffusionV2 논문 | https://arxiv.org/abs/2511.07399 | 4×H100·4×4090 환경. 4090 배칭 메모리 제약. 58.28/64.52FPS를 5080 수치로 쓰지 않음 | `streamv2-paper.html`, `streamv2-paper.html.txt` |
| StreamDiffusionV2 가중치 | https://huggingface.co/jerryfeng/StreamDiffusionV2/tree/main | 1.3B·14B 실제 파일 존재. 1.3B model.pt 5,676,282,858bytes. 파일 크기를 VRAM으로 해석하지 않음 | `streamv2-card.md`, `streamv2-modeltree.json` |
| SANA-Streaming 공식 안내 | https://github.com/NVlabs/Sana/blob/main/docs/sana_streaming.md | 2B, short/long V2V 코드, 공개 BF16 실행과 논문 MPQ 측정 구별. 5090 1280×704 24FPS/DiT58FPS | `sana-streaming.md` |
| SANA-Streaming 가중치 | https://huggingface.co/Efficient-Large-Model/SANA-Streaming/tree/main | `dit/sana_streaming_ar.pth` 등 실제 공개 파일 존재 | `sana-tree.json`, `sana-card.md` |
| LiveVVT 논문 | https://arxiv.org/abs/2608.26714 | 실시간 VVT 설계·논문 결과. 논문 존재와 실행물 공개를 구별 | `livevvt-paper.html`, `livevvt-paper.html.txt` |
| LiveVVT 공식 저장소 | https://github.com/caoyushe/LiveVVT | 2개 파일(README·LICENSE). README는 코드 준비 중. 실행 코드·체크포인트 링크 없음 | `livevvt-readme.md`, `livevvt-tree.json` |

StreamDiffusionV2가 T2V 전용이거나 가중치가 없다는 가설은 현재 공식 데모와 실제 HF 파일 목록으로 반박된다. 다만 공개 V2V가 의상 참조 착의를 지원한다는 뜻은 아니다. SANA는 소비자 GPU 실시간 편집의 반증 후보로 추가했지만 5090→5080의 속도·VRAM 외삽은 하지 않았다.

## RTX 5080 설치 근거

| 근거 | 주소 | 대조 내용 | 보존 파일 |
|---|---|---|---|
| NVIDIA GPU 표 | https://developer.nvidia.com/cuda/gpus | RTX5080 compute capability12.0 | `cuda-gpus.html`, `cuda-gpus.html.txt` |
| PyTorch2.7 발표 | https://pytorch.org/blog/pytorch-2-7/ | Blackwell 및 CUDA12.8 휠 지원 시작 | `pytorch27.html`, `pytorch27.html.txt` |
| PyTorch 설치 버전표 | https://pytorch.org/get-started/previous-versions/ | torch2.11.0/vision0.26.0/cu128 설치 조합 | `pytorch-versions.html` |
| NVIDIA Blackwell 호환 안내 | https://docs.nvidia.com/cuda/blackwell-compatibility-guide/index.html | 바이너리·PTX·아키텍처 호환 경계 | `blackwell-guide.html`, `blackwell-guide.html.txt` |

## 검증 결과와 불확실성

원문 다운로드 목록과 실패는 `evidence/local-model-research/download-index.json`에 있다. 원문 파일, 변환 텍스트, HF/GitHub 파일 목록은 같은 폴더에 보존했다. 모델 가중치·패키지는 설치하거나 실행하지 않았다.

`claim-check`의 18개 주장 중 **17개 supported, 1개 unsure, unsupported 0개**였다. 애매 판정은 LiveVVT의 코드 준비 중 문구다. 짧은 README 원문과 Git tree를 직접 대조해 확인했으며 `manual-review.json`에 남겼다. 잘못된 주장으로 교정하거나 제거한 항목은 0개다. 파일명 `lucy-license.md`의 최초 URL은404였고, 이후 공식 PDF를 확보했다.

자료는 전부 공식 저장소·공식 모델 카드·원 논문·공식 기술 문서다. 다만 같은 저자의 코드·모델 카드·논문은 독립 출처 3개로 세지 않는다. 엄격한 조사 분류에서 모델별 자체 성능·라이선스·공개 상태는 원문 확인을 마친 **LIKELY**, 5080의 예상 적합성과 WSL2 우선 선택은 **ASSUMPTION/설계 판단**으로 남긴다. 이 조사에서는 독립3개 출처 요건을 채운 모델 성능 FACT를 선언하지 않는다.

남은 불확실성은 5080 실제 VRAM·처리시간·커스텀 확장 호환, 사용자 입력에서의 얼굴·의상 보존 품질, 실시간 프레임 간 안정성, 비공개 Lucy API의 내부 계보다. 이 항목은 Windows GPU 후속 계획의 측정 대상으로 넘긴다.
