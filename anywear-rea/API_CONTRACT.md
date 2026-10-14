# 로컬 추론 엔진 API

현재 프런트엔드가 사용할 규격이다. 실제 서버는 Windows 단계에서 구현한다. 경로는 같은 출처의 `/api` 아래에 두고 API 버전은 `1`로 한다. 기계 판독용 규격은 `studio/api/openapi.json`이다.

## 연결과 입력

| 요청 | 응답과 용도 |
| --- | --- |
| `GET /api/health` | 준비 상태, 장치·모델 상태, 현재 작업, 로컬 토큰 |
| `POST /api/jobs` | multipart 작업 생성, `202`와 작업 객체 |
| `GET /api/jobs/{id}` | 현재 작업 객체 |
| `DELETE /api/jobs/{id}` | 취소 요청과 최신 작업 객체 |
| `GET /api/jobs/{id}/image` | 성공한 작업의 PNG 바이트 |

`POST`와 `DELETE`는 health 응답의 `csrf_token`을 `X-Local-Token` 헤더로 전달한다. 서버 프로세스가 바뀌어 토큰이 만료되면 다시 연결한다. 토큰은 브라우저 메모리에만 둔다.

health 응답 예시:

```json
{
  "status": "ok",
  "api_version": "1",
  "csrf_token": "프로세스별_임의_로컬_토큰",
  "runtime": {"device": "cuda", "gpu_name": "NVIDIA GeForce RTX 5080", "vram_gb": 16},
  "models": [
    {"id": "fashn", "name": "FASHN VTON 1.5", "ready": true, "reason": null, "capability": "snapshot"},
    {"id": "turbo", "name": "라이브 스타일", "ready": false, "reason": "라이브 모델을 준비하지 않았습니다.", "capability": "live"}
  ],
  "active_job_id": null
}
```

`turbo`는 프런트엔드의 라이브 스타일 어댑터 식별자다. 실제 모델 후보는 Windows 단계에서 연결하고, SD-Turbo나 StreamDiffusion 계열을 사용하더라도 같은 식별자 아래 구현을 분리한다. 상태 응답의 `name`에 실제 모델을 표시한다.

multipart 필드:

| 필드 | 값 |
| --- | --- |
| `engine` | `fashn` 또는 `turbo` |
| `person` | JPEG·PNG·WebP 파일. 최대 8MiB, 디코딩 후 최대 16MP |
| `garment` | 같은 제한의 의상 파일. `fashn`에서 필수 |
| `category` | `tops`, `bottoms`, `one-pieces` |
| `garment_photo_type` | `flat-lay`, `model` |
| `prompt` | 라이브 모드의 변경 지시. `turbo`에서 필수, 최대 500자 |
| `seed` | 정수, 기본 42, 범위 0~4,294,967,295 |
| `steps` | 사진 모드 기본 30, 라이브 어댑터 기본 2. 모델별 실제 처리 의미는 어댑터에서 검증 |
| `strength` | 라이브 어댑터 기본 0.5. 해당 모델이 지원하지 않으면 서버에서 무시하고 임의 의미를 부여하지 않음 |

## 작업 상태

```text
queued → loading → running → succeeded
   │        │          ├──→ failed
   └────────┴──────────→ cancelling → cancelled
```

모델이 준비되어 있으면 `loading`을 생략할 수 있다. 최종 상태는 `succeeded`, `failed`, `cancelled`다. 취소 요청 뒤 `succeeded`가 되지 않도록 서버가 경합을 처리한다. 이미 성공한 작업의 취소 요청은 성공 상태를 그대로 반환한다.

작업 객체:

```json
{
  "id": "작업_ID",
  "status": "running",
  "stage": "옷을 입히고 있습니다.",
  "elapsed_ms": 8200,
  "inference_ms": null,
  "result_url": null,
  "error": null
}
```

성공했을 때만 `result_url`은 `/api/jobs/{id}/image`이고 `inference_ms`는 실제 추론 시간이다. 전체 경과 시간에 모델 로딩과 대기가 포함되더라도 추론 시간으로 가장하지 않는다. 클라이언트는 외부 출처·임의 경로·다른 작업의 결과 URL을 거부한다.

실패는 `{ "code": "out_of_memory", "message": "GPU 메모리가 부족합니다. 입력 크기를 줄여 다시 시도하세요." }` 같은 오류 객체를 `error`에 넣는다. 응답의 `stage`와 `message`는 텍스트로만 표시한다.

## 오류와 수명

HTTP 오류는 `{ "error": { "code": "...", "message": "..." } }` 형태다.

| 상태 | 대표 코드 | 의미 |
| --- | --- | --- |
| `400` | `invalid_request` | 잘못된 요청 |
| `403` | `invalid_local_token`, `invalid_origin` | 로컬 토큰·출처 검증 실패 |
| `404` | `job_not_found` | 없는 작업 또는 TTL 만료 |
| `413` | `image_too_large` | 파일·픽셀·전체 요청 제한 초과 |
| `415` | `unsupported_image` | 지원하지 않는 실제 이미지 형식 |
| `422` | `invalid_input` | 필수 입력·설정 불일치 |
| `429` | `engine_busy` | GPU 작업 실행 중. `Retry-After` 제공 |
| `503` | `model_not_ready`, `device_unavailable` | 모델·장치 준비 필요 |

제안 초기 수명은 결과 TTL 10분·보관 결과 최대 10개·활성 GPU 작업 1개다. 만료 뒤 이미지는 `404`다. 서버 중단 시 메모리 입력·결과를 폐기한다. 결과 이미지는 `Cache-Control: no-store`로 제공한다.

프런트엔드의 초기 시간 제한은 연결 5초, 작업 생성 15초, 상태 조회 10초, 모델 로딩 120초, 추론 300초다. 로딩·추론 제한을 넘으면 취소를 요청하고 입력을 보존한다. 한 번에 한 프레임만 요청하고 오래된 응답은 표시하지 않는다.
