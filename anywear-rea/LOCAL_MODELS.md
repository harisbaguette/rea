# RTX 5080에서 만드는 가상착의 앱

첫 모델은 **FASHN VTON 1.5로 사진 한 장을 착의하는 방식**을 권한다. RTX 5080의 16GB VRAM에 맞을 가능성이 높고, 인물 사진과 상품 사진을 받는 공개 Python API가 있어 연결하기 쉽다. 다만 기본 파이프라인의 인체 분할 모델은 비상용 제한이 있으므로 개인 연구·평가용으로 시작해야 한다.

실시간 영상은 별도 단계로 둔다. 카메라 영상을 화면에 보여 주는 기능과 AI가 모든 프레임의 옷을 바꾸는 기능은 다르다. 공개 모델을 내려받아 실행할 수 있다는 사실만으로 **5080에서 상품의 무늬와 사람의 얼굴을 유지하며 30FPS로 착의할 수 있다**고 판단할 근거는 부족하다.

## Lucy는 다른 모델을 기반으로 만들었나

공개된 **Lucy Edit Dev와 Lucy Edit 1.1 Dev는 Wan2.2 5B 기반**이다. Wan의 영상 생성 구조에 지시 기반 영상 편집 능력을 더한 계보다. 옷 변경뿐 아니라 인물·사물·배경 편집을 지원한다.

그러나 이 공개 모델은 녹화 영상과 텍스트를 입력받는 모델이다. 상품 사진을 조건으로 실시간 착의하는 Anywear의 모델과 같은 것으로 취급하면 안 된다. Anywear의 분석된 배포 코드에는 `lucy-vton-3.5`가 기본값으로 있으며 서버 설정이 이를 바꿀 수 있다. Decart의 현재 실시간 API에는 Lucy 2.5와 Lucy VTON 3.5/3.6이 따로 있다.

**Lucy Edit가 Wan 기반이라는 사실은 확인되지만, Lucy 2.5나 VTON 3.5/3.6의 내부 모델도 Wan이라고 단정할 공개 근거는 없다.** 공개 체크포인트를 받아 Anywear와 같은 품질·지연을 얻을 수 있다고 기대해서도 안 된다.

Lucy Edit를 직접 실행하는 경우에는 모델의 비상용·비운영 환경 제한도 적용된다. 생성 결과물의 이용 권한과 모델을 서비스로 운영할 권한은 따로 판단해야 한다.

## 로컬 후보 비교

| 후보 | 실제 입력과 용도 | 공개 상태·메모리·속도 | RTX 5080에서의 판단 | 상용 이용 |
|---|---|---|---|---|
| FASHN VTON 1.5 | 인물 이미지 + 의상 이미지. 상의·하의·원피스 | 코드·가중치 공개. 모델 카드 기준 약 8GB VRAM, 출력 576×864. H100에서 약 5초 | 첫 사진 착의 후보. 5080 속도는 측정 필요. 30FPS용 아님 | 주 모델·코드는 Apache-2.0. 기본 인체 분할 의존성에 비상용 제한이 있어 전체 구성 그대로 상용화하면 안 됨 |
| CatVTON | 인물 + 의상 + 교체 영역 마스크. 자동 마스크는 별도 전처리 | 코드·가중치 공개. bf16 1024×768에서 약 8GB VRAM | 메모리 측면의 대안. DensePose 등 오래된 전처리 의존성 호환 확인 필요 | 코드·체크포인트·데모 CC BY-NC-SA 4.0 |
| Lucy Edit Dev | 녹화 영상 + 텍스트 편집 지시 | Wan2.2 5B. 코드·가중치 공개 | 범용 영상 편집 연구용. 16GB 전체 파이프라인의 무오프로딩 실행은 보장 못 함 | 별도 비상용 라이선스 |
| Lucy Edit 1.1 Dev | 녹화 영상 + 텍스트 편집 지시 | Wan2.2 5B. 코드·가중치 공개. 예제는 832×480, 81프레임 | 품질 비교 후보. 상품 참조 착의나 실시간 스트리밍의 직접 대체물이 아님 | 별도 비상용 라이선스 |
| StreamDiffusion | 텍스트 또는 연속 이미지. 브라우저 웹캠·화면 입력 데모 | 코드 공개, SD-Turbo 등 외부 가중치 사용. RTX 4090의 SD-Turbo 1스텝 img2img에서 93.897FPS 보고 | 낮은 지연의 스타일·외형 변화 연구 후보. 정확한 상품 재현·프레임 간 일관성은 별도 과제 | 파이프라인 Apache-2.0. 선택한 기반 가중치 라이선스 별도 |
| StreamDiffusionV2 | 연속 영상 + 텍스트. 웹캠·화면 V2V 데모 | 코드와 1.3B/14B 체크포인트 공개. Wan2.1 계보. 논문 고속 수치는 여러 H100/4090 환경 포함 | 1.3B를 다음 스트리밍 실험으로 검토. 16GB와 30FPS 미보장. 의상 참조 사진 조건은 기본 데모에 없음 | 코드 Apache-2.0. 체크포인트·기반 가중치·추가 부품 조건 별도 확인 |
| SANA-Streaming | 원본 영상 + 텍스트 편집 지시 | 코드·2B 체크포인트 공개. 논문은 RTX 5090에서 1280×704 24FPS, DiT만 58FPS. 공개 실행 경로는 BF16 | 최신 스트리밍 비교 후보. 5090 결과를 16GB 5080으로 옮겨 말할 수 없음 | 코드와 모든 가중치·Gemma·LTX-2 등 구성품의 조건을 함께 검토해야 함 |
| LiveVVT | 인물 영상 + 의상 + 정면 착의 참조. 스트리밍 착의 연구 | 논문은 존재. 공식 저장소에는 README·LICENSE만 있고 코드 준비 중. 실행용 코드·가중치 연결 없음 | 당장 설치할 후보에서 제외. 공개 구현이 나온 뒤 재평가 | 실행용 배포물과 조건이 확인된 뒤 판단 |

## 속도와 VRAM을 해석할 때

FASHN의 약 5초는 H100에서 얻은 수치다. 5080에서도 5초라는 뜻이 아니다. 의상 무늬, 로고, 팔의 가림, 넓은 옷에서 좁은 옷으로 바꾸는 경우의 잔상은 직접 비교해야 한다. 몸의 실제 치수나 착용감을 계산하는 모델도 아니다.

원본 StreamDiffusion의 93.897FPS는 RTX 4090, Core i9-13900K, Ubuntu 22.04.3 LTS의 SD-Turbo img2img 결과다. 착의 품질 점수가 아니며 카메라 캡처·전송·표시를 포함한 지연을 뜻하지 않는다. 저장소의 PyTorch 2.1/CUDA 11.8·12.1 설치 예제는 5080 설치 기준으로 쓰면 안 된다.

StreamDiffusionV2의 58.28FPS(14B), 64.52FPS(1.3B)는 **4개 H100** 환경의 논문 대표 수치다. 논문은 **4개 RTX 4090(각 24GB)**도 평가하며 4090에서는 메모리 제약 때문에 배칭을 제외했다고 설명한다. `--fps 16` 같은 실행 옵션은 목표 출력 프레임률이지 실제 처리속도 측정 결과가 아니다. 공개 1.3B 체크포인트 파일 크기도 전체 실행 VRAM과 다르다.

SANA-Streaming은 소비자 GPU의 실시간 편집이 가능하다는 긍정적 근거다. 다만 논문의 혼합 정밀도 최적화 수치와 공개 BF16 실행 스크립트를 구분해야 한다. DiT의 58FPS와 전체 파이프라인의 24FPS도 서로 다르다. 공개 코드·가중치가 있다는 점은 유용하지만 5080에서 같은 결과를 보장하지는 않는다.

Lucy 5B의 BF16 핵심 가중치만 단순 계산으로 약 10GB다. 여기에 텍스트 인코더, VAE, 영상 활성값과 작업 버퍼가 더해진다. 16GB에서의 실행 가능성은 CPU 오프로딩·해상도·프레임 수·정밀도에 달려 있으며, 오프로딩은 지연을 늘릴 수 있다.

## Windows RTX 5080에서 이어서 할 순서

1. Windows NVIDIA 드라이버를 준비하고, 개발 환경은 **WSL2 Ubuntu + Python 3.10/3.11**을 우선한다. 여러 영상 모델의 공식 실행 환경이 Linux이며 CUDA 확장 호환을 통일하기 쉽다. FASHN만 먼저 실행한다면 Windows 네이티브도 후보지만 동일한 통과를 가정하지 않는다.
2. 별도 가상환경에서 CUDA 지원 PyTorch를 설치하고 실제 GPU 텐서 연산부터 확인한다. 이후 FASHN 코드·가중치를 준비하고 동일한 입력·seed·스텝으로 반복 추론해 시간과 최대 VRAM을 측정한다.
3. 사진 착의가 통과하면 공통 프런트엔드에 연결한다. 실시간 연구는 별도 환경의 StreamDiffusionV2 1.3B부터 시작하고, SANA-Streaming을 비교 대상으로 둔다. 상품 이미지 조건과 시간적 일관성은 별도 개발 과제로 기록한다.

5080은 compute capability **12.0(`sm_120`)**다. PyTorch는 2.7/CUDA 12.8부터 Blackwell을 지원한다. 첫 환경의 고정 후보는 다음과 같다.

```bash
python -m pip install torch==2.11.0 torchvision==0.26.0 --index-url https://download.pytorch.org/whl/cu128
python -c "import torch; print(torch.__version__, torch.version.cuda); print(torch.cuda.get_device_name()); print(torch.cuda.get_device_capability()); print(torch.ones(1, device='cuda') + 1)"
```

PyTorch 본체가 정상이어도 FlashAttention·xformers·TensorRT·ONNX Runtime·커스텀 CUDA 확장이 자동으로 호환되는 것은 아니다. 최초 연결은 모델이 허용하는 기본 PyTorch 경로로 진행하고, 가속 부품은 각각 대조한다. PyTorch를 설치한 뒤 다른 패키지가 오래된 CUDA 휠로 바꿔 버리지 않도록 설치 후 버전과 GPU 연산을 다시 확인한다.

## FASHN 연결 계약

공통 프런트엔드는 인물 이미지, 의상 이미지, 의상 종류, 상품 사진 유형을 전달하면 된다. 카메라는 먼저 스냅샷 입력으로 사용한다. 모델은 한 번 로드하여 요청 간 재사용하고 GPU 작업은 직렬화한다.

아래는 Windows GPU 단계에서 연결할 공개 API의 형태다.

```python
from pathlib import Path
from PIL import Image
from fashn_vton import TryOnPipeline

weights_dir = Path("weights").resolve()
pipeline = TryOnPipeline(weights_dir=str(weights_dir), device="cuda")
result = pipeline(
    person_image=Image.open("person.png").convert("RGB"),
    garment_image=Image.open("garment.png").convert("RGB"),
    category="tops",                 # tops | bottoms | one-pieces
    garment_photo_type="flat-lay",   # flat-lay | model
    num_samples=1,
    num_timesteps=30,
    guidance_scale=1.5,
    seed=42,
    segmentation_free=True,
)
result.images[0].save("output.png")
```

공식 준비 명령은 저장소 안에서 `python -m pip install -e .`, 가중치는 `python scripts/download_weights.py --weights-dir ./weights`다. 준비되는 파일은 `model.safetensors`, `dwpose/yolox_l.onnx`, `dwpose/dw-ll_ucoco_384.onnx`이며 인체 분할 가중치는 Hugging Face 캐시에 저장된다.

이번 범위에서는 프런트엔드와 Windows 후속 계획만 만든다. 모델 설치·다운로드·추론은 Windows GPU 단계에서 수행한다. 그 단계의 합격 기준은 실제 인물·상품 입력 결과, 처리시간 분포, 최대 VRAM, 오류 복구, 외부 영상 전송 여부를 확인하는 것이다. 아직 5080에서 측정하지 않은 속도나 품질을 완료로 간주하지 않는다.
