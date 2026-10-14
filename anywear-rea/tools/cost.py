#!/usr/bin/env python3
"""공개 API 단가를 적용한 오프라인 비용 계산기. 내부 원가 추정이 아니다."""
import argparse
import json
from decimal import Decimal, InvalidOperation


def seconds_value(value):
    try:
        number = Decimal(value)
    except InvalidOperation as exc:
        raise argparse.ArgumentTypeError("생성 초는 숫자여야 합니다.") from exc
    if not number.is_finite() or number < 0 or number > Decimal("1000000000"):
        raise argparse.ArgumentTypeError("생성 초는 0 이상 10억 이하의 유한수여야 합니다.")
    return number


def sessions_value(value):
    try:
        number = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("횟수는 정수여야 합니다.") from exc
    if not 1 <= number <= 1000000000:
        raise argparse.ArgumentTypeError("횟수는 1 이상 10억 이하여야 합니다.")
    return number


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seconds", type=seconds_value, required=True,
                        help="세션당 실제 생성 초. 대기열 시간은 제외")
    parser.add_argument("--sessions", type=sessions_value, default=1)
    parser.add_argument("--mode", choices=["standard", "fast"], default="standard")
    args = parser.parse_args()
    rate = Decimal("0.04" if args.mode == "fast" else "0.02")
    total = args.seconds * args.sessions * rate
    print(json.dumps({
        "실제_생성_초_세션당": str(args.seconds),
        "횟수": args.sessions,
        "모드": args.mode,
        "공개_API_단가_USD_초당": str(rate),
        "계산액_USD": format(total, "f"),
        "가정": "저장한 공식 요금표 기준. 내부 원가·전송·저장·세금·추가 운영비는 포함하지 않음.",
        "출처": "https://docs.platform.decart.ai/getting-started/pricing",
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
