#!/usr/bin/env python3
"""분석 자료 무결성, 주장 위치, 비용과 문서 연결을 네트워크 없이 검사한다."""
import hashlib
import gzip
import io
import json
import re
import struct
import subprocess
import sys
import zipfile
from decimal import Decimal
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    checks = []
    metadata = json.loads((ROOT / "evidence/anywear.crx.metadata.json").read_text())
    data = (ROOT / metadata["file"]).read_bytes()
    require(hashlib.sha256(data).hexdigest() == metadata["sha256"], "CRX 해시 불일치")
    require(data[:4] == b"Cr24" and struct.unpack("<I", data[4:8])[0] == 3, "CRX3 형식 불일치")
    archive = zipfile.ZipFile(io.BytesIO(data[12 + struct.unpack("<I", data[8:12])[0]:]))
    require(archive.testzip() is None, "ZIP CRC 검사 실패")
    members = [item for item in archive.infolist() if not item.is_dir()]
    for member in members:
        extracted = ROOT / "artifacts/extension" / member.filename
        require(extracted.resolve().is_relative_to((ROOT / "artifacts/extension").resolve()), "잘못된 압축 경로")
        require(archive.read(member) == extracted.read_bytes(), f"추출 원본 불일치: {member.filename}")
    manifest = json.loads(archive.read("manifest.json"))
    require(manifest["name"] == "Anywear: Live Virtual Try-On" and manifest["version"] == "2.18", "대상 버전 불일치")
    checks.append({"검사": "CRX3·SHA-256·ZIP CRC·원본과 추출 파일 일치", "파일": len(members)})

    findings = json.loads((ROOT / "evidence/findings.json").read_text())
    for row in findings["observations"]:
        code = (ROOT / row["file"]).read_bytes()
        require(hashlib.sha256(code).hexdigest() == row["sha256"], f"관찰 대상 변경: {row['id']}")
        require(code[row["byte_start"]:row["byte_end"]] == row["anchor"].encode(), f"근거 위치 불일치: {row['id']}")
    for row in findings["inventory"]:
        content = (ROOT / "artifacts/extension" / row["path"]).read_bytes()
        require(hashlib.sha256(content).hexdigest() == row["sha256"], f"배포 파일 변경: {row['path']}")
    rea_metadata = json.loads((ROOT / "evidence/rea-extension.metadata.json").read_text())
    compressed = (ROOT / rea_metadata["file"]).read_bytes()
    require(hashlib.sha256(compressed).hexdigest() == rea_metadata["sha256"], "REA 압축 파일 해시 불일치")
    rea_data = gzip.decompress(compressed)
    require(hashlib.sha256(rea_data).hexdigest() == rea_metadata["uncompressed_sha256"], "REA 원본 해시 불일치")
    rea = json.loads(rea_data)
    require(rea["evidence_id"] == findings["rea"]["evidence_id"], "REA 근거 ID 불일치")
    require(rea["operation"] == "analyze_javascript_application", "REA 작업 종류 불일치")
    require(rea["normalized_result"]["statistics"]["parse_failures"] == 0, "REA 파싱 실패 발견")
    require(findings["rea"]["semantic_coverage"]["status"] == "partial", "REA 부분 범위 기록 불일치")
    checks.append({"검사": "코드 근거의 바이트 위치·해시와 REA 범위 일치", "코드_관찰": len(findings["observations"])})

    sources = json.loads((ROOT / "evidence/official-sources.json").read_text())
    for row in sources:
        require("error" not in row, f"공식 문서 확보 실패: {row['url']}")
        require(hashlib.sha256((ROOT / row["path"]).read_bytes()).hexdigest() == row["sha256"], f"공식 문서 변경: {row['path']}")
    pricing = (ROOT / "evidence/official/getting-started--pricing.md").read_text()
    require(re.search(r"lucy-vton-3\.5`.*0\.02/sec.*0\.04/sec", pricing), "기본 단가와 저장 요금표 불일치")
    require(re.search(r"lucy-2\.5`.*0\.02/sec.*0\.04/sec", pricing), "범용 모델 단가와 저장 요금표 불일치")
    checks.append({"검사": "공식 문서 스냅샷 무결성과 단가", "문서": len(sources)})

    scenarios = [("30", 1, "standard", "0.60"), ("30", 1, "fast", "1.20"),
                 ("60", 1, "standard", "1.20"), ("60", 1, "fast", "2.40"),
                 ("480", 1, "standard", "9.60"), ("480", 1, "fast", "19.20"),
                 ("60", 1000, "standard", "1200.00"), ("60", 1000, "fast", "2400.00"),
                 ("0.5", 1, "standard", "0.010"), ("0", 1, "standard", "0.00")]
    results = []
    for seconds, sessions, mode, expected in scenarios:
        process = subprocess.run([sys.executable, str(ROOT / "tools/cost.py"), "--seconds", seconds,
                                  "--sessions", str(sessions), "--mode", mode],
                                 text=True, capture_output=True, timeout=10)
        require(process.returncode == 0, process.stderr)
        result = json.loads(process.stdout)
        require(Decimal(result["계산액_USD"]) == Decimal(expected), "비용 예시 계산 불일치")
        results.append(result)
    invalid = [["--seconds", "-1"], ["--seconds", "NaN"], ["--seconds", "Infinity"],
               ["--seconds", "abc"], ["--seconds", "60", "--sessions", "0"],
               ["--seconds", "60", "--sessions", "1.5"]]
    for args in invalid:
        process = subprocess.run([sys.executable, str(ROOT / "tools/cost.py"), *args],
                                 text=True, capture_output=True, timeout=10)
        require(process.returncode == 2, f"잘못된 입력이 거부되지 않음: {args}")
    report = (ROOT / "REPORT.md").read_text()
    for number in ["$0.60", "$1.20", "$2.40", "$9.60", "$19.20", "$1,200.00", "$2,400.00"]:
        require(number in report, f"비용표 누락: {number}")
    (ROOT / "evidence/cost-scenarios.json").write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")
    checks.append({"검사": "공개 요금 계산과 잘못된 입력 거부", "정상": len(scenarios), "거부": len(invalid)})

    links = 0
    for name in ["README.md", "REPORT.md", "REBUILD.md", "SOURCES.md"]:
        text = (ROOT / name).read_text()
        for target in re.findall(r"\]\(([^)]+)\)", text):
            parsed = urlsplit(target)
            if parsed.scheme or not parsed.path:
                continue
            if parsed.path != "evidence/verification.json":
                require((ROOT / unquote(parsed.path)).exists(), f"문서 링크 없음: {name} → {target}")
            links += 1
    checks.append({"검사": "사용자 문서의 로컬 파일 연결", "링크": links})
    result = {"결과": "통과", "범위": "오프라인 무결성·근거·계산·문서 검사. 실제 카메라·유료 API·모델 품질 시험은 아님.", "검사": checks}
    output = ROOT / "evidence/verification.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    require(output.is_file(), "검사 결과 파일 생성 실패")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
