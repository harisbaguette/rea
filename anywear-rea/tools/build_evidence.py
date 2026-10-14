#!/usr/bin/env python3
"""로컬 배포물의 코드 위치와 분석 범위를 기록한다. 대상 코드는 실행하지 않는다."""
import hashlib
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT = ROOT / "artifacts" / "extension"

ANCHORS = [
    ("token-endpoint", "config.js", 'TOKEN_ENDPOINT_URL:"https://anywear.decart.ai/api/tokens"', "접속 토큰 발급 엔드포인트"),
    ("queue-join", "widget.bundle.js", 'n+"/api/queue/join"', "앱 대기열 참가 요청"),
    ("queue-poll", "widget.bundle.js", 'n+"/api/queue/status?ticket="', "대기열 상태 조회"),
    ("queue-heartbeat", "widget.bundle.js", 't+"/api/queue/heartbeat"', "접속 티켓 유지 요청"),
    ("model-default", "widget.bundle.js", 'var LU="lucy-vton-3.5"', "기본 모델 문자열"),
    ("model-override", "widget.bundle.js", '"string"==typeof e.modelName&&e.modelName&&(XN=e.modelName)', "서버 응답의 모델 이름 반영"),
    ("model-selection", "widget.bundle.js", 'name:XN||LU,fps:{ideal:30,max:30},width:1088,height:624', "서버 선택 우선 및 입력 영상 설정"),
    ("camera-input", "widget.bundle.js", 'a=WU??ZU', "전처리 또는 원본 카메라 스트림 선택"),
    ("sdk-connect", "widget.bundle.js", 'g=r.realtime.connect(a,{model:o,onRemoteStream:e=>', "영상 입력과 원격 결과 콜백을 SDK에 전달"),
    ("remote-output", "widget.bundle.js", 'fF.srcObject=e,KU=!0', "원격 결과 스트림을 영상 요소에 연결"),
    ("reference-image", "widget.bundle.js", 'await HU.setImage(n,{prompt:jU(),timeout:3e4})', "동일 세션에서 의상 참조 이미지 전달"),
    ("image-proxy", "widget.bundle.js", 'AF+"?url="+encodeURIComponent(e)', "직접 이미지 요청 실패 후 프록시 경로"),
    ("sdk-realtime-host", "widget.bundle.js", 'realtimeBaseUrl||"wss://api3.decart.ai"', "SDK의 기본 실시간 제어 호스트"),
    ("livekit-join", "widget.bundle.js", 'type:"livekit_join"', "WebSocket 제어 메시지의 LiveKit 참가 요청"),
    ("publish-media", "widget.bundle.js", 'await this.media.publishLocalTracks()', "로컬 미디어 트랙 게시"),
    ("image-message", "widget.bundle.js", '{type:"set_image",image_data:e.image??null}', "참조 이미지 제어 메시지"),
    ("client-session-limit", "widget.bundle.js", 'e?.constraints?.realtime?.maxSessionDuration', "서버 응답의 세션 시간 한도 처리"),
    ("consumer-billing", "billing.js", 'c+"/api/consumer-billing/status"', "소비자 요금 상태 경로 존재"),
    ("free-pass", "billing.js", 'e.free_pass_available', "무료 체험 잔여 정보 처리"),
    ("subscription-refusal", "widget.bundle.js", '"subscription_required"', "구독 요구 응답을 처리하는 코드 존재"),
    ("recording", "recording.js", 'MediaRecorder.isTypeSupported', "로컬 녹화 관련 기능 존재"),
]


def main():
    files = []
    for path in sorted(ARTIFACT.rglob("*")):
        if path.is_file():
            data = path.read_bytes()
            files.append({"path": path.relative_to(ARTIFACT).as_posix(),
                          "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    observations = []
    for key, name, anchor, claim in ANCHORS:
        data = (ARTIFACT / name).read_bytes()
        needle = anchor.encode("utf-8")
        offset = data.find(needle)
        if offset < 0:
            raise ValueError(f"코드 근거를 찾지 못함: {key}")
        observations.append({
            "id": key, "type": "static", "claim": claim,
            "file": f"artifacts/extension/{name}",
            "sha256": hashlib.sha256(data).hexdigest(),
            "byte_start": offset, "byte_end": offset + len(needle),
            "anchor": anchor,
            "limit": "정적 코드의 존재와 연결을 관찰함. 실제 사용자 세션 실행의 증거가 아님.",
        })
    rea = json.loads(gzip.decompress((ROOT / "evidence/rea-extension.json.gz").read_bytes()))
    normalized = rea["normalized_result"]
    result = {
        "observations": observations,
        "inventory": files,
        "rea": {
            "evidence_id": rea["evidence_id"],
            "provider": rea["provider"],
            "subject": rea["subject"],
            "source_selection": normalized["source_selection"],
            "statistics": normalized["statistics"],
            "semantic_coverage": normalized["semantic_graph"]["coverage"],
            "limitations": rea["limitations"],
        },
        "inferences": [
            {"claim": "연산은 원격 영상 AI가 담당하고 브라우저는 캡처·전송·재생을 담당하는 구조다.",
             "based_on": ["sdk-connect", "remote-output", "sdk-realtime-host", "publish-media"],
             "limit": "서버 내부 GPU·신경망·원가를 관찰한 것은 아니다."},
            {"claim": "대기열은 동시 처리량 관리에 사용된다.",
             "based_on": ["queue-join", "queue-poll", "queue-heartbeat"],
             "supplement": "artifacts/extension/docs/decart-session-limit.md",
             "limit": "포함된 개발 메모의 과거 좌석 수는 현재 전체 서비스의 수용량을 확정하지 않는다."},
        ],
        "unknowns": ["실제 세션별 선택 모델", "현재 계정의 무료·유료 한도", "실제 품질과 종단 지연",
                     "모델 가중치와 신경망 세부 구조", "GPU 배치와 내부 원가", "서비스별 보관·학습 제외 조건"],
    }
    output = ROOT / "evidence/findings.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"코드_관찰": len(observations), "배포_파일": len(files),
                      "REA": rea["evidence_id"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
