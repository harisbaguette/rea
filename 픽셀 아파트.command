#!/bin/bash
set -eu
project_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
exec /Library/Frameworks/Python.framework/Versions/3.14/bin/python3 "$project_dir/실행관리(Ops-Run)/픽셀 아파트/main.py" --device
