---
license: apache-2.0
---

## Overview
StreamDiffusionV2 is an open-source interactive diffusion pipeline for real-time streaming applications. It scales across diverse GPU setups, supports flexible denoising steps, and delivers high FPS for creators and platforms. Further details are available on our project [homepage](https://streamdiffusionv2.github.io/).

## Prerequisites
- OS: Linux with NVIDIA GPU
- CUDA-compatible GPU and drivers

## Installation
```shell
conda create -n stream python=3.10.0
conda activate stream
# Require CUDA 12.4 or above, please check via `nvcc -V`
pip install torch==2.6.0 torchvision==0.21.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu124
pip install -r requirements.txt 
python setup.py develop
```

## Download Checkpoints
```shell
huggingface-cli download --resume-download Wan-AI/Wan2.1-T2V-1.3B --local-dir wan_models/Wan2.1-T2V-1.3B
huggingface-cli download --resume-download jerryfeng/StreamDiffusionV2 --local-dir ./ckpts/wan_causal_dmd_v2v
```

## Offline Inference

### Single GPU

```shell
python streamv2v/inference.py \
--config_path configs/wan_causal_dmd_v2v.yaml \
--checkpoint_folder ckpts/wan_causal_dmd_v2v \
--output_folder outputs/ \
--prompt_file_path prompt.txt \
--video_path original.mp4 \
--height 480 \
--width 832 \
--fps 16 \
--step 2
```
Note: `--step` sets how many denoising steps are used during inference.

### Multi-GPU

```shell
torchrun --nproc_per_node=2 --master_port=29501 streamv2v/inference_pipe.py \
--config_path configs/wan_causal_dmd_v2v.yaml \
--checkpoint_folder ckpts/wan_causal_dmd_v2v \
--output_folder outputs/ \
--prompt_file_path prompt.txt \
--video_path original.mp4 \
--height 480 \
--width 832 \
--fps 16 \
--step 2
# --schedule_block  # optional: enable block scheduling
```
Note: `--step` sets how many denoising steps are used during inference. Enabling `--schedule_block` can provide optimal throughput.
Adjust `--nproc_per_node` to your GPU count. For different resolutions or FPS, change `--height`, `--width`, and `--fps` accordingly.

## Online Inference (Web UI)
A minimal web demo is available under `demo/`. For setup and startup, please refer to [demo](demo/README.md).
- Access in a browser after startup: `http://0.0.0.0:7860` or `http://localhost:7860`


## Acknowledgements
StreamDiffusionV2 is inspired by the prior works [StreamDiffusion](https://github.com/cumulo-autumn/StreamDiffusion) and [StreamV2V](https://github.com/Jeff-LiangF/streamv2v). Our Causal DiT builds upon [CausVid](https://github.com/tianweiy/CausVid), and the rolling KV cache design is inspired by [Self-Forcing](https://github.com/guandeh17/Self-Forcing).

We are grateful to the team members of [StreamDiffusion](https://github.com/cumulo-autumn/StreamDiffusion) for their support. We also thank [First Intelligence](https://first-intelligence.com) and [Daydream](https://docs.daydream.live/) team for their great feedback.

We also especially thank DayDream team for the great collaboration and incorporating our StreamDiffusionV2 pipeline into their cool [Demo UI](https://github.com/daydreamlive/scope). 

## Citation
If you find this repository useful in your research, please consider giving a star ⭐ or a citation.
```BibTeX
@article{streamdiffusionv2,
  title={StreamDiffusionV2: An Open-Sourced Interactive Diffusion Pipeline for Streaming Applications},
  author={Tianrui Feng and Zhi Li and Haocheng Xi and Muyang Li and Shuo Yang and Xiuyu Li and Lvmin Zhang and Kelly Peng and Song Han and Maneesh Agrawala and Kurt Keutzer and Akio Kodaira and Chenfeng Xu},
  journal={Project Page},
  year={2025},
  url={https://streamdiffusionv2.github.io/}
}
```
