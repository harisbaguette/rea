#!/usr/bin/env python3
"""소스·정적 빌드·Windows 계획을 설치 환경과 분리해 ZIP으로 묶고 검사한다."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {"node_modules", ".git", "test-results", "playwright-report", ".DS_Store", "__pycache__"}
DOCUMENTS = ["WINDOWS_PLAN.md", "API_CONTRACT.md", "CONTINUE_WINDOWS.md", "LOCAL_MODELS.md", "LOCAL_MODEL_SOURCES.md", "ASSETS.md"]


def main():
    output = ROOT / "deliverables/ibeobom-frontend-windows-plan.zip"
    output.parent.mkdir(exist_ok=True)
    if not (ROOT / "studio/dist/index.html").is_file():
        raise RuntimeError("studio에서 npm run build를 먼저 실행해야 합니다.")
    files = []
    for folder in [ROOT / "studio", ROOT / "evidence/local-model-research"]:
        for path in folder.rglob("*"):
            relative = path.relative_to(ROOT)
            if path.is_file() and not any(part in EXCLUDED for part in relative.parts):
                if path.name.startswith(".env") and path.name != ".env.example":
                    continue
                if path.is_symlink():
                    raise RuntimeError(f"배포 경로에 심볼릭 링크가 있습니다: {relative}")
                files.append(path)
    files.extend(ROOT / name for name in DOCUMENTS)
    files.append(ROOT / "tools/windows_probe.py")
    unique = sorted(set(files))
    manifest = {path.relative_to(ROOT).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in unique}
    start = """# 입어봄 시작하기

공통 화면은 studio/README.md를 따라 실행한다. Mac은 studio/start-macos.command, Windows는 studio/start-windows.cmd도 사용할 수 있다. Node.js 22.12 이상이 필요하다.

AI 추론 서버·GPU 모델은 포함되지 않는다. Windows에서 CONTINUE_WINDOWS.md의 지시로 이어서 진행한다. 작업 순서는 WINDOWS_PLAN.md, 서버 규격은 API_CONTRACT.md에 있다.

node_modules는 포함하지 않는다. Windows와 Mac에서 각각 studio/의 npm ci로 설치한다. 개인 사진이나 토큰은 포함하지 않는다.
"""
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in unique:
            archive.write(path, path.relative_to(ROOT).as_posix())
        archive.writestr("START_HERE.md", start)
        archive.writestr("MANIFEST.json", json.dumps(manifest, ensure_ascii=False, indent=2))
    with zipfile.ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("ZIP 무결성 검사 실패")
        for name in archive.namelist():
            parsed = PurePosixPath(name)
            if parsed.is_absolute() or ".." in parsed.parts or any(part in EXCLUDED for part in parsed.parts):
                raise RuntimeError(f"잘못된 배포 경로: {name}")
        for name, digest in manifest.items():
            if hashlib.sha256(archive.read(name)).hexdigest() != digest:
                raise RuntimeError(f"배포 내용 불일치: {name}")
        for required in ["studio/dist/index.html", "studio/package-lock.json", "studio/api/openapi.json", "WINDOWS_PLAN.md", "CONTINUE_WINDOWS.md", "tools/windows_probe.py", "START_HERE.md"]:
            if required not in archive.namelist():
                raise RuntimeError(f"필수 배포 파일 없음: {required}")
        count = len(archive.namelist())
    result = {"result": "passed", "artifact": str(output.relative_to(ROOT)), "files": count,
              "bytes": output.stat().st_size, "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
              "scope": "공통 프런트엔드·정적 빌드·Windows 계획. 추론 서버·가중치 없음."}
    (ROOT / "evidence/frontend-package.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
