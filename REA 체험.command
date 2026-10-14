#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
exec python3 '실행관리(Ops-Run)/run_demo.py'
