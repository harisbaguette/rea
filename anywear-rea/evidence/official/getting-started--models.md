> ## Documentation Index
> Fetch the complete documentation index at: https://docs.platform.decart.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Models

> Explore Decart's AI models for video and image transformation

Decart offers state-of-the-art AI models for realtime and batch video transformation, lip synchronization, and image editing. Our models are optimized for creative applications, delivering professional-quality results with minimal latency.

<Note>
  **Lucy 2.5 is the latest editing model for realtime and video — text prompts, reference images, or both.** [Get started →](/models/realtime/lucy-2.5)
</Note>

## Realtime models

Realtime models process live video and audio with low latency. They run continuously as long as the connection is open.

| Model | ID | Resolution | Use Case |
| - | - | - | - |
| **Lucy 2.5** | `lucy-2.5` | 720p | Video editing (latest) |
| **Lucy VTON 3.6** | `lucy-vton-3.6` | 720p | Virtual try-on (latest) |
| **Lucy VTON 3.5** | `lucy-vton-3.5` | 720p | Virtual try-on |
| **Lucy Restyle 2** | `lucy-restyle-2` | 720p | Video restyling |
| **Oasis 3 Preview** | `oasis-3-preview` | 768×512 | Realtime world model / driving simulator |

<Note>
  **Fast mode.** `lucy-2.5` / `lucy-latest`, `lucy-vton-3.6` / `lucy-vton-latest`, and `lucy-vton-3.5` accept `speed: "fast"` at connect time for lower latency and higher throughput, with unchanged output quality. Billed at 2x the standard realtime rate; other models ignore the option. [Learn more →](/models/realtime/lucy-2.5#fast-mode)
</Note>

<Note>
  **Oasis 3 Preview** is a realtime, promptable world model — you set a scene and drive it with actions, and it generates the next camera frames. It uses the dedicated Python gRPC SDK [`decart-oasis`](https://pypi.org/project/decart-oasis/) rather than the `@decartai/sdk` realtime SDKs. [Get started →](/models/realtime/oasis-3)
</Note>

<Accordion title="Previous generation models">
  | Model | ID | Resolution | Use Case |
  | - | - | - | - |
  | **Lucy 2.1** | `lucy-2.1` | 720p | Video editing |
</Accordion>

## Video models

Video models process pre-recorded video asynchronously. Submit a job, poll for completion, then download the result.

| Model | ID | Resolution | Use Case |
| - | - | - | - |
| **Lucy 2.5** | `lucy-2.5` | 720p | Video editing (latest) |
| **Lucy VTON 3.6** | `lucy-vton-3.6` | 720p | Virtual try-on (latest) |
| **Lucy VTON 3.5** | `lucy-vton-3.5` | 720p | Virtual try-on |
| **Lucy Restyle 2** | `lucy-restyle-2` | 720p | Video restyling |

<Accordion title="Previous generation models">
  | Model | ID | Resolution | Use Case |
  | - | - | - | - |
  | **Lucy 2.1** | `lucy-2.1` | 720p | Video editing |
  | **Lucy Clip** | `lucy-clip` | 720p | Video editing |
</Accordion>

## Image models

Image models edit and transform images.

| Model | ID | Resolution | Use Case |
| - | - | - | - |
| **Lucy Image 2** | `lucy-image-2` | 480p, 720p | Image editing |

## Latest aliases

Use `-latest` aliases to always target the newest version of a model family. The server resolves these to the current latest version automatically, so your code stays up to date without changes.

| Alias | Type | Currently resolves to |
| - | - | - |
| `lucy-latest` | realtime + video | `lucy-2.5` |
| `lucy-vton-latest` | realtime + video | `lucy-vton-3.6` |
| `lucy-restyle-latest` | realtime + video | `lucy-restyle-2` |
| `lucy-clip-latest` | video | `lucy-clip` |
| `lucy-image-latest` | image | `lucy-image-2` |

```typescript theme={null}
// Always use the latest Lucy model — no code changes needed when new versions ship
const model = models.realtime("lucy-latest");
const result = await client.queue.submitAndPoll({
  model: models.video("lucy-latest"),
  prompt: "Anime style",
  data: videoFile,
});
```

## Technical Specifications

### Video Requirements

All video models accept MP4 files with these specifications:

* **Format:** MP4 (H.264 or VP8 codec)
* **Aspect Ratio:** 16:9 or 9:16
* **File Size:** Maximum 200MB

## Choosing the Right Model

### Decision Matrix

| If you need to... | Use this model | Why? |
| - | - | - |
| Transform or edit live video on camera | **Lucy 2.5** (`lucy-2.5`) | Character reference images + text editing in one realtime model (latest) |
| Apply artistic styles to a live stream | **Lucy Restyle 2** (`lucy-restyle-2`) | Full scene restyling in realtime |
| Transform or edit existing video | **Lucy 2.5** (`lucy-2.5`) | Best quality, fastest speed, unlimited duration, supports prompt + reference image (latest) |
| Edit or transform an image | **Lucy Image 2** (`lucy-image-2`) | Precise image editing |
| Simulate a drivable world for RL or robotics | **Oasis 3 Preview** (`oasis-3-preview`) | Realtime world model — actions in, generated camera frames out |

### Quick Start Examples

<CodeGroup>
  ```typescript Lucy 2.5 (realtime) theme={null}
  import { createDecartClient, models } from "@decartai/sdk";

  const client = createDecartClient({ apiKey: "your-api-key-here" });
  const model = models.realtime("lucy-latest");
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { frameRate: model.fps, width: model.width, height: model.height },
  });

  const realtimeClient = await client.realtime.connect(stream, {
    model,
    onRemoteStream: (s) => { document.getElementById("output").srcObject = s; },
  });

  // Character transformation
  const photo = document.querySelector("input[type=file]").files[0];
  await realtimeClient.set({ prompt: "Transform into this character", image: photo, enhance: true });
  ```

  ```typescript Lucy Restyle 2 (realtime) theme={null}
  import { createDecartClient, models } from "@decartai/sdk";

  const client = createDecartClient({ apiKey: "your-api-key-here" });
  const realtimeClient = await client.realtime.connect(stream, {
    model: models.realtime("lucy-restyle-2"),
    onRemoteStream: (s) => { document.getElementById("output").srcObject = s; },
    initialState: { prompt: { text: "Cartoon style", enhance: true } },
  });

  // Switch styles on the fly
  realtimeClient.setPrompt("Cyberpunk city");
  ```

  ```typescript Lucy 2.5 (batch) theme={null}
  import { createDecartClient, models } from "@decartai/sdk";

  const client = createDecartClient({ apiKey: "your-api-key-here" });
  const result = await client.queue.submitAndPoll({
    model: models.video("lucy-latest"),
    prompt: "Anime style transformation",
    data: videoFile,
    resolution: "720p",
  });

  if (result.status === "completed") {
    const buffer = Buffer.from(await result.data.arrayBuffer());
    writeFileSync("output.mp4", buffer);
  }
  ```
</CodeGroup>

## Pricing

<Note>
  For detailed pricing information, see the [Pricing page](/getting-started/pricing).
</Note>

## Next Steps

<CardGroup cols={2}>
  <Card title="Lucy 2.5 Guide" icon="sparkles" href="/models/realtime/lucy-2.5">
    Character transformation with reference images in realtime
  </Card>

  <Card title="Use Cases" icon="lightbulb" href="/examples/use-cases">
    Explore what you can build with realtime and batch models
  </Card>

  <Card title="Quickstart Guide" icon="rocket" href="/getting-started/quickstart">
    Transform your first video in minutes
  </Card>

  <Card title="API Reference" icon="code" href="/api-reference/lucy-21">
    Detailed API documentation
  </Card>

  <Card title="JavaScript SDK" icon="js" href="/sdks/javascript">
    Build with our JavaScript SDK
  </Card>

  <Card title="Streaming Best Practices" icon="bolt" href="/models/realtime/streaming-best-practices">
    Optimize your realtime integration
  </Card>
</CardGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.