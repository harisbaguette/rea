> ## Documentation Index
> Fetch the complete documentation index at: https://docs.platform.decart.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Pricing

> Clear, usage-based pricing for Decart models

Decart uses pay-as-you-go pricing.

<Info>
  No subscriptions and no minimum spend. You pay only for usage.
</Info>

## How pricing works

* Realtime models: billed per second of active generation
* Video models: billed per generated second
* Image models: billed per generation

## Realtime models

| Model | ID | 720p | Fast mode | Best for |
| - | - | - | - | - |
| **Lucy 2.5** | `lucy-2.5` | \$0.02/sec | \$0.04/sec | Realtime video editing (latest) |
| **Lucy VTON 3.6** | `lucy-vton-3.6` | \$0.02/sec | \$0.04/sec | Virtual try-on (latest) |
| **Lucy VTON 3.5** | `lucy-vton-3.5` | \$0.02/sec | \$0.04/sec | Virtual try-on |
| **Lucy Restyle 2** | `lucy-restyle-2` | \$0.01/sec | - | Realtime style transfer |
| **Oasis 3 Preview** | `oasis-3-preview` | \$0.02/sec | - | Realtime world model / driving simulator |

<Note>
  **Fast mode** (`speed: "fast"`) gives the session lower latency and higher throughput; output quality is unchanged. It is available for `lucy-2.5` / `lucy-latest`, `lucy-vton-3.6` / `lucy-vton-latest`, and `lucy-vton-3.5`, and is billed at 2x the standard realtime rate for those models. Other models ignore the option. Omit it (the default) for standard mode. See [Fast mode](/models/realtime/lucy-2.5#fast-mode).
</Note>

<Note>
  Oasis 3 Preview is billed at **\$0.02 per second**, with enterprise pricing available depending on the use case — contact `contact@decart.ai`.
</Note>

<Accordion title="Previous generation models">
  | Model | ID | 720p | Best for |
  | - | - | - | - |
  | **Lucy 2.1** | `lucy-2.1` | \$0.02/sec | Realtime video editing |
</Accordion>

## Video models

| Model | ID | 480p | 720p | Best for |
| - | - | - | - | - |
| **Lucy 2.5** | `lucy-2.5` | - | \$0.04/sec | Video editing (latest) |
| **Lucy VTON 3.6** | `lucy-vton-3.6` | - | \$0.04/sec | Virtual try-on (latest) |
| **Lucy VTON 3.5** | `lucy-vton-3.5` | - | \$0.04/sec | Virtual try-on |
| **Lucy Restyle 2** | `lucy-restyle-2` | - | \$0.01/sec | Video restyling |

<Accordion title="Previous generation models">
  | Model | ID | 480p | 720p | Best for |
  | - | - | - | - | - |
  | **Lucy 2.1** | `lucy-2.1` | - | \$0.04/sec | Video editing |
  | **Lucy Clip** | `lucy-clip` | - | \$0.15/sec | Video editing |
</Accordion>

## Image models

| Model | ID | 480p | 720p | Best for |
| - | - | - | - | - |
| **Lucy Image 2** | `lucy-image-2` | \$0.01 | \$0.02 | Image editing |

## Cost examples

* 5-second video edit with `lucy-2.5` (720p): `5 x $0.04 = $0.20`
* 30-second realtime Lucy 2.5 session: `30 x $0.02 = $0.60`
* 30-second realtime Lucy 2.5 session in fast mode (`speed: "fast"`): `30 x $0.04 = $1.20`
* One 720p image edit with `lucy-image-2`: `$0.02`
* 60-second Oasis 3 Preview session: `60 x $0.02 = $1.20`

## FAQ

<AccordionGroup>
  <Accordion title="Do you have a free tier?">
    New accounts receive free credits so you can test the API before paying.
  </Accordion>

  <Accordion title="How is video billing calculated?">
    Video jobs are billed per generated second. Realtime is billed per active generation time.
  </Accordion>

  <Accordion title="Do you offer enterprise pricing?">
    Yes. Contact `contact@decart.ai` for custom volume pricing.
  </Accordion>
</AccordionGroup>

## Next steps

<CardGroup cols={2}>
  <Card title="Model comparison" href="/getting-started/models" icon="layer-group">
    Pick the best quality/speed/cost tradeoff for your product.
  </Card>

  <Card title="Get started" href="https://platform.decart.ai" icon="arrow-right">
    Create an account and run your first request.
  </Card>
</CardGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.