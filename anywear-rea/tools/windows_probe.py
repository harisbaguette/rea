#!/usr/bin/env python3
"""Mac/Windows/WSL에서 환경을 읽고 선택적으로 실제 CUDA 연산을 확인한다."""
import argparse
import importlib.util
import json
import platform
import shutil
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--require-cuda", action="store_true")
    args = parser.parse_args()
    result = {"os": platform.platform(), "python": platform.python_version(),
              "nvidia_smi": None, "torch": None, "cuda_test": False}
    command = shutil.which("nvidia-smi")
    if command:
        try:
            process = subprocess.run([command, "--query-gpu=name,memory.total,driver_version",
                                      "--format=csv,noheader"], capture_output=True,
                                     text=True, timeout=10)
            result["nvidia_smi"] = {"exit_code": process.returncode, "output": process.stdout.strip()}
        except (OSError, subprocess.TimeoutExpired) as exc:
            result["nvidia_smi"] = {"error": str(exc)}
    if importlib.util.find_spec("torch") is not None:
        try:
            import torch
            available = torch.cuda.is_available()
            result["torch"] = {"version": torch.__version__, "cuda_runtime": torch.version.cuda,
                               "cuda_available": available}
            if available:
                result["torch"]["gpu"] = torch.cuda.get_device_name(0)
                result["torch"]["capability"] = list(torch.cuda.get_device_capability(0))
                result["torch"]["vram_bytes"] = torch.cuda.get_device_properties(0).total_memory
                tensor = torch.ones(1, device="cuda") + 1
                torch.cuda.synchronize()
                result["cuda_test"] = tensor.item() == 2
                del tensor
        except Exception as exc:
            result["torch"] = {"error": str(exc)}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.require_cuda and not result["cuda_test"]:
        print("CUDA 텐서 연산이 확인되지 않았습니다.", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
