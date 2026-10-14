---
license: apache-2.0
library_name: pytorch
pipeline_tag: image-to-image
tags:
  - virtual-try-on
  - diffusion
  - mmdit
  - fashion
  - image-generation
  - pixel-space
language:
  - en
---

# FASHN VTON v1.5

[![Project Page](https://img.shields.io/badge/Project-Page-1A1A1A?style=flat)](https://fashn.ai/research/vton-1-5) [![GitHub](https://img.shields.io/badge/GitHub-Repo-181717?style=flat&logo=github)](https://github.com/fashn-AI/fashn-vton-1.5) [![Hugging Face Spaces](https://img.shields.io/badge/Hugging%20Face-Spaces-FFD21E?style=flat&logo=HuggingFace)](https://huggingface.co/spaces/fashn-ai/fashn-vton-1.5) [![arXiv](https://img.shields.io/badge/arXiv-Coming%20Soon-b31b1b?style=flat&logo=arXiv)](https://arxiv.org)

A virtual try-on model that generates photorealistic images directly in pixel space without requiring segmentation masks.

<p align="center">
  <img src="https://static.fashn.ai/repositories/fashn-vton-v15/results/hero_collage.webp" alt="FASHN VTON v1.5 examples" width="800">
</p>

## Model Description

FASHN VTON v1.5 is a state-of-the-art virtual try-on model based on the MMDiT (Multimodal Diffusion Transformer) architecture. Given a person image and a garment image, the model generates a photorealistic image of the person wearing the garment. It supports both model-worn garments and flat-lay product shots.

**Key innovations:**

- **Pixel-space generation**: Operates directly on RGB pixels with a 12x12 patch embedding, eliminating information loss from VAE encoding and preserving fine details in textures and patterns.
- **Maskless inference**: Runs in segmentation-free mode by default, allowing garments to take their natural form without shape constraints from the original clothing.
- **Body identity preservation**: Maintains tattoos, body characteristics, and cultural garments (e.g., hijabs).

### Architecture

| Component | Specification |
|-----------|---------------|
| **Base** | MMDiT (Multimodal Diffusion Transformer) |
| **Parameters** | 972M |
| **Hidden Size** | 1280 |
| **Attention Heads** | 10 |
| **Double-Stream Blocks** | 8 (cross-modal attention) |
| **Single-Stream Blocks** | 16 (self-attention) |
| **Patch Mixer Blocks** | 4 (preprocessing) |
| **Patch Size** | 12x12 |
| **Output Resolution** | 576x864 |
| **Precision** | bfloat16 (Ampere+ GPUs) |

### Inputs

- **Person image**: RGB image of the person to dress
- **Garment image**: RGB image of the garment (model photo or flat-lay)
- **Category**: "tops", "bottoms", or "one-pieces"
- **Pose keypoints**: Extracted via DWPose (handled automatically by the pipeline)

### Outputs

- Photorealistic RGB image of the person wearing the specified garment

## Usage

### Installation

```bash
git clone https://github.com/fashn-AI/fashn-vton-1.5.git
cd fashn-vton-1.5
pip install -e .
```

### Download Weights

```bash
python scripts/download_weights.py --weights-dir ./weights
```

This downloads:
- `model.safetensors` — TryOnModel weights (~2 GB)
- `dwpose/` — DWPose ONNX models for pose detection

The human parser weights (~244 MB) are automatically downloaded on first use.

### Quick Start

```python
from fashn_vton import TryOnPipeline
from PIL import Image

# Initialize pipeline (auto-detects GPU)
pipeline = TryOnPipeline(weights_dir="./weights")

# Load images
person = Image.open("person.jpg").convert("RGB")
garment = Image.open("garment.jpg").convert("RGB")

# Run inference
result = pipeline(
    person_image=person,
    garment_image=garment,
    category="tops",  # "tops" | "bottoms" | "one-pieces"
)

# Save output
result.images[0].save("output.png")
```

### CLI

```bash
python examples/basic_inference.py \
    --weights-dir ./weights \
    --person-image person.jpg \
    --garment-image garment.jpg \
    --category tops
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `category` | str | required | "tops", "bottoms", or "one-pieces" |
| `garment_photo_type` | str | "model" | "model" for worn garments, "flat-lay" for product shots |
| `num_samples` | int | 1 | Number of output images (1-4) |
| `num_timesteps` | int | 30 | Sampling steps (20=fast, 30=balanced, 50=quality) |
| `guidance_scale` | float | 1.5 | Classifier-free guidance strength |
| `seed` | int | 42 | Random seed for reproducibility |
| `segmentation_free` | bool | True | Maskless mode for better body preservation and unconstrained garment volume (less biased by original clothing shape) |

## Categories

| Category | Description | Examples |
|----------|-------------|----------|
| `tops` | Upper body garments | T-shirts, blouses, jackets, sweaters |
| `bottoms` | Lower body garments | Pants, skirts, shorts |
| `one-pieces` | Full body garments | Dresses, jumpsuits, rompers |

## Training

FASHN VTON v1.5 was trained from scratch in pixel space using a two-phase approach:

1. **Phase 1**: 18M masked try-on pairs
2. **Phase 2**: 50/50 mix of masked pairs plus 4M synthetic triplets generated from the Phase 1 checkpoint

Training optimizations included token dropping up to 75% to reduce computational demands.

## Performance

- **Inference time**: ~5 seconds on NVIDIA H100
- **Memory**: Requires ~8GB VRAM for inference
- **Precision**: Automatically uses bfloat16 on Ampere+ GPUs (RTX 30xx/40xx, A100, H100)

## Limitations

- **Resolution**: Output resolution (576x864) is lower than some VAE-based architectures that support 1K+ resolution
- **Body shape preservation**: May be imperfect due to synthetic triplet generation during training
- **Garment transitions**: Original garment traces may remain when swapping from long-to-short or bulky-to-slim garments
- **Hardware requirements**: Dedicated GPU recommended for reasonable inference speeds

## Citation

```bibtex
@article{bochman2026fashnvton,
  title={FASHN VTON v1.5: Efficient Maskless Virtual Try-On in Pixel Space},
  author={Bochman, Dan and Bochman, Aya},
  journal={arXiv preprint},
  year={2026},
  note={Paper coming soon}
}
```

## License

This model is released under the [Apache-2.0 License](https://www.apache.org/licenses/LICENSE-2.0).

**Third-party components:**
- [DWPose](https://github.com/IDEA-Research/DWPose) (Apache-2.0)
- [YOLOX](https://github.com/Megvii-BaseDetection/YOLOX) (Apache-2.0)
- [FASHN Human Parser](https://github.com/fashn-AI/fashn-human-parser) ([License](https://github.com/fashn-AI/fashn-human-parser?tab=readme-ov-file#license))

## Links

- [FASHN AI](https://fashn.ai/)
- [Project Page](https://fashn.ai/research/vton-1-5)
- [GitHub Repository](https://github.com/fashn-AI/fashn-vton-1.5)
- [API Documentation](https://docs.fashn.ai/)
