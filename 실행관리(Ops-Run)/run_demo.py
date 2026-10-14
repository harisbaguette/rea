#!/usr/bin/env python3
"""로컬 실행 파일을 조작하고 실제 REA 역컴파일 결과를 확인한다."""

import hashlib
import json
import os
from pathlib import Path
import shlex
import signal
import subprocess
import sys
import time


OPS = Path(__file__).resolve().parent
TARGET = OPS / "분석 대상" / "shipping-demo"
EVIDENCE = OPS / "분석 근거"
REA = Path.home() / ".local" / "bin" / "rea"
MANIFEST = EVIDENCE / "샘플 정보.json"


def ask(prompt, default=""):
    try:
        answer = input(prompt).strip()
    except EOFError:
        answer = ""
    return answer or default


def ask_amount():
    while True:
        raw = ask("주문금액 [기본 32000원]: ", "32000").replace(",", "")
        if raw.isascii() and raw.isdecimal() and len(raw) <= 9:
            value = int(raw)
            if 0 <= value <= 100000000:
                return value
        print("0~100000000 사이의 정수를 입력하세요.")


def ask_member():
    while True:
        raw = ask("회원인가요? [Y/n]: ", "y").lower()
        if raw in ("y", "yes", "1", "예"):
            return 1
        if raw in ("n", "no", "0", "아니오"):
            return 0
        print("y 또는 n을 입력하세요.")


def quote(amount, member):
    command = [str(TARGET), str(amount), str(member)]
    result = subprocess.run(command, capture_output=True, text=True, check=True, timeout=5)
    return json.loads(result.stdout)


def analyze():
    command = [str(REA), "decompile", str(TARGET), "_shipping_fee", "--provider", "ghidra", "--json"]
    print("\n실제로 실행하는 REA 명령:")
    print(shlex.join(command))
    pending = EVIDENCE / "최근 분석.pending.json"
    errors = EVIDENCE / "최근 분석.stderr.txt"
    with pending.open("w", encoding="utf-8") as out, errors.open("w", encoding="utf-8") as err:
        process = subprocess.Popen(command, stdout=out, stderr=err, start_new_session=True)
        started = time.monotonic()
        try:
            while process.poll() is None:
                elapsed = int(time.monotonic() - started)
                print(f"\rGhidra가 실행 파일을 분석하는 중… {elapsed}초", end="", flush=True)
                if elapsed >= 180:
                    raise TimeoutError("REA 분석이 180초 안에 끝나지 않았습니다.")
                time.sleep(1)
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
            print()
    if process.returncode != 0:
        raise RuntimeError(f"REA가 종료 코드 {process.returncode}를 반환했습니다.\n{errors.read_text(encoding='utf-8')[-2000:]}")
    evidence = json.loads(pending.read_text(encoding="utf-8"))
    if "error" in evidence:
        raise RuntimeError(json.dumps(evidence["error"], ensure_ascii=False))
    digest = hashlib.sha256(TARGET.read_bytes()).hexdigest()
    if evidence.get("subject", {}).get("digest", {}).get("sha256") != digest:
        raise RuntimeError("분석 결과와 실행 파일의 SHA-256이 일치하지 않습니다.")
    if evidence.get("provider", {}).get("id") != "ghidra":
        raise RuntimeError("결과의 분석 엔진이 Ghidra가 아닙니다.")
    code = evidence.get("normalized_result")
    if not isinstance(code, str) or "_shipping_fee" not in code:
        raise RuntimeError("REA가 배송비 함수의 의사 코드를 반환하지 않았습니다.")
    pending.replace(EVIDENCE / "최근 분석.json")
    return evidence, code


def main():
    print("\nREA 체험 · 실행 파일 속 배송비 규칙 찾기\n")
    print("자체 제작한 연습용 프로그램입니다. 실행 파일만 REA에 전달합니다.")
    if not REA.is_file():
        raise RuntimeError(f"REA 실행 파일을 찾을 수 없습니다: {REA}")
    metadata = json.loads(MANIFEST.read_text(encoding="utf-8"))
    digest = hashlib.sha256(TARGET.read_bytes()).hexdigest()
    if digest != metadata["sample_sha256"]:
        raise RuntimeError("연습용 실행 파일이 바뀌었습니다. 현재 파일에는 이 체험의 해설을 적용할 수 없습니다.")

    print("\n1. 계산기를 먼저 실행해 보세요.")
    amount = ask_amount()
    member = ask_member()
    result = quote(amount, member)
    print(f"\n주문 {amount:,}원 / {'회원' if member else '비회원'}")
    print(f"배송비 {result['shipping_fee']:,}원 → 결제금액 {result['total']:,}원")

    ask("\n2. Enter를 누르면 REA로 숨겨진 조건을 분석합니다. ")
    evidence, code = analyze()
    print("\nREA가 실행 파일에서 복원한 의사 코드:")
    print(code)
    print("param_1은 주문금액, param_2는 회원 여부(0 또는 1)입니다.")
    print("16진수 0xdac는 10진수로 3500입니다.")
    guess = ask("\n3. 회원의 최소 무료 배송 주문금액은 얼마일까요? [Enter: 해설 보기]: ")
    if guess:
        compact = guess.replace(",", "").replace("원", "").strip()
        print("맞았습니다." if compact == "30000" else "회원 여부와 30000 비교 조건을 함께 읽어 보세요.")
    print("\n코드를 해석하면 다음과 같습니다.")
    print("• 50000원 이상이면 무료 배송")
    print("• 회원은 30000원 이상이면 무료 배송")
    print("• 그 외 배송비는 3500원")

    print("\n4. 실제 실행 파일로 조건의 바로 아래와 위를 확인합니다.")
    print("고객       주문금액      실제 배송비")
    for member, amount in [(1, 29999), (1, 30000), (0, 49999), (0, 50000)]:
        result = quote(amount, member)
        print(f"{'회원' if member else '비회원':<6} {amount:>9,}원 {result['shipping_fee']:>11,}원")
    print(f"\n분석 엔진: {evidence['provider']['name']} {evidence['provider']['version']}")
    print("이 코드는 원본 소스가 아니라 Ghidra가 복원한 의사 코드입니다.")
    print(f"실제 분석 원문: {EVIDENCE / '최근 분석.json'}")
    ask("\nEnter를 누르면 닫힙니다. ")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n체험을 종료했습니다.")
        sys.exit(130)
    except (OSError, ValueError, RuntimeError, TimeoutError, subprocess.SubprocessError) as exc:
        print(f"\n체험을 진행할 수 없습니다: {exc}", file=sys.stderr)
        ask("\nEnter를 누르면 닫힙니다. ")
        sys.exit(1)
