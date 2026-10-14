> ## Documentation Index
> Fetch the complete documentation index at: https://docs.platform.decart.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Prompting Guide

> How to write effective prompts for Lucy 2.5, with templates and examples for every edit type.

Lucy 2.5 edits video from a short written prompt and an optional reference image. Describe the visible change you want — what to add, replace, remove, restyle, transform, or preserve. Then say how the edit should interact with the subject and scene.

<Tip>
  Lucy 2.5 uses a structured prompt format. [Prompt enhancement](/models/realtime/streaming-best-practices#use-prompt-enhancement) (`enhance: true`) rewrites your instruction to fit the input video and any reference image. It is on by default; keep it on.
</Tip>

<Note>
  **Prompt length.** Prompts have a maximum length. As a rough estimate, about 750 characters of English (around 120 words) fit. The exact limit depends on the wording, and other languages may allow fewer characters. If your prompt is too long, you get an error that tells you how many characters of it fit. This applies whether or not prompt enhancement is on.
</Note>

## Basics

Three inputs shape the result:

* **Input video:** What Lucy can see and track.
* **Reference image:** The visual material for an edit. It may not show every angle the video needs.
* **Prompt:** The change you want. Describe the edit, not every visible detail — enhancement fills in the rest.

### Choosing an input video

Lucy can only edit what it can clearly see and track. A good input video:

* Keeps the subject fully visible and well lit.
* Holds steady framing, and avoids fast motion, motion blur, and heavy occlusion.
* Uses a clean, uncluttered background, especially for background edits.

<Warning>
  Lucy edits your live video in real time. Make sure the thing you want to edit is visible in the current frame — or name it explicitly in your prompt.
</Warning>

### Core prompting principles

A strong prompt answers four questions, in four sentences or fewer:

* **What should change?** Describe the intended result: a new appearance, object, character, or scene.
* **Where is the change applied?** Anchor the edit to a visible location, such as a body part, garment detail, object surface, or background.
* **How does it interact and move?** Say how the edit attaches to the subject and holds up as the subject moves. Name the physical behavior — attaches to, wraps around, trails with motion, reflects on, casts light on, or is occluded by — so the result tracks the subject instead of looking pasted on.
* **What stays the same?** Name the details the edit should not affect, such as physical features, garment details, or objects.

Together, those answers form one prompt:

<div className="pg-wrap">
  ```text Example: theme={null}
  Add blue smoke and white smoke to the person's shoulders. It follows their movement, billows outward, and passes behind their arms and body. Keep their face, clothing, and background unchanged.
  ```
</div>

This names the change (blue and white smoke), where it goes (on the shoulders), how it behaves (follows the person's movement, billows outward, and passes behind the arms and body), and what to preserve (face, clothing, and background).

Make one focused edit per prompt. Combining several unrelated changes into one prompt makes each one less reliable — apply them one at a time.

Cut filler adjectives like realistic, seamless, natural, cinematic, or high quality. Concrete visual details do more; use such words only when the look itself is the edit.

Identify targets by visible details, not their position in the frame:

<div className="pg-dodont">
  | ✅ Visible detail | ❌ Frame position |
  | - | - |
  | `"the red hat on the woman's head"` | `"the hat on the right"` |
</div>

If several similar objects appear, tell them apart by color, material, pattern, text, logo, or shape.

Name each target with a concrete noun — the jacket, the left hand, the background — not a pronoun like it or this.

### Using reference images

A reference image supplies the visual material for an edit — a garment, object, character, or art style. The prompt tells Lucy which part to use and how to apply it.

Use a reference image when you need consistent results across different videos.

Good reference images:

* Show the intended item or style clearly and completely, with the full subject visible and centered.
* Keep important details visible, such as shape, material, color, pattern, and fit.
* Avoid cluttered backgrounds, occlusion, and extra people or objects.
* Use a sharp, lightly compressed image, about 1280px on the longest side.
* Pad unusual aspect ratios to the output orientation — 16:9 landscape or 9:16 portrait — instead of cropping or upscaling.

<Warning>
  Do not rely on an empty prompt. Even with a strong reference, specify the intended edit.
</Warning>

<div className="pg-dodont">
  | ✅ Specific | ❌ Too general |
  | - | - |
  | `"Put the black leather jacket from the reference image on the person in the video."` | `"Put this on the person."` |
</div>

When using a reference image, your prompt should:

* Name the item, character, or style to use.
* Call out the visual details that matter, such as color, material, texture, shape, pattern, logo placement, or fit.
* State where or how it should appear in the video.
* Ignore reference details that are not part of the edit, such as the reference subject's pose, lighting, or background.

## Prompt templates and examples

Each example starts on the unedited original clip, which shows the template for that edit type. Select a prompt beneath the video to see the edited result. Where a reference image was used, it appears next to the prompt.

### Character transformation

<div className="pg-hidden-tabs">
  <Tabs>
    <Tab title="Original person">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/character-transformation/source.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=36fec8fcd1b5a63a39cb3daddea03018" data-path="assets/lucy-2.5-prompting/character-transformation/source.mp4" />
      </div>
    </Tab>

    <Tab title="Space explorer">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/character-transformation/space-explorer.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=1d1d08177afd714b59a86aee7b404671" data-path="assets/lucy-2.5-prompting/character-transformation/space-explorer.mp4" />
      </div>
    </Tab>

    <Tab title="Cartoon chef">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/character-transformation/cartoon-chef.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=ccefbc6ef4cc7e90e65d2bcab88e46d5" data-path="assets/lucy-2.5-prompting/character-transformation/cartoon-chef.mp4" />
      </div>
    </Tab>

    <Tab title="Día de Muertos">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/character-transformation/dia-de-los-muertos.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=cc0d8a659f0b21693df65dce7f99362a" data-path="assets/lucy-2.5-prompting/character-transformation/dia-de-los-muertos.mp4" />
      </div>
    </Tab>
  </Tabs>
</div>

<div className="pg-prompt-tabs">
  <Tabs>
    <Tab title="Original person">
      ```text Template: theme={null}
      Replace the character in the video with <description of character>.
      ```
    </Tab>

    <Tab title="Space explorer">
      ```text Prompt: theme={null}
      Replace the character in the video with a silver-armored space explorer with a reflective blue visor, white gloves, glowing shoulder lights, and a short navy cape.
      ```
    </Tab>

    <Tab title="Cartoon chef">
      ```text Prompt: theme={null}
      Replace the character in the video with a cheerful cartoon chef wearing a tall white hat, red neck scarf, double-breasted jacket, and round glasses.
      ```
    </Tab>

    <Tab title="Día de Muertos">
      <div className="pg-pr">
        <div className="pg-pr-col">
          ```text Prompt: theme={null}
          Replace the character in the video with the Día de Muertos festival dancer from the reference image. She has tangerine and ivory face paint, an orange flower crown, a black dress with blue and orange floral embroidery, cream lace edging, a tiered skirt, and a fringed shawl.
          ```
        </div>

        <div className="pg-pr-col">
          <Frame caption="Reference">
            <img className="pg-ref" loading="lazy" decoding="async" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/character-transformation/dia-de-los-muertos-reference.webp?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=6c1faf304c4823c6abc81f0f744f2775" alt="Día de Muertos festival dancer reference image" width="800" height="800" data-path="assets/lucy-2.5-prompting/character-transformation/dia-de-los-muertos-reference.webp" />
          </Frame>
        </div>
      </div>
    </Tab>
  </Tabs>
</div>

**Tips**

* Capture the character's defining traits, not just how it looks — its materials, textures, and how they move, like rigid armor, flowing fabric, or glowing energy.
* Include distinctive details the reference may not show, such as wings, a tail, a shield, a backpack, or a cape.

**Troubleshooting**

* **If the person's face or identity changes:** This is the expected behavior – use Virtual Try-on (VTON) for costume changes that preserve identity.

<div className="pg-dodont">
  | ✅ Do | ❌ Don't |
  | - | - |
  | `"Replace the shirt with a red silk blouse. Keep the person's identity, face, and hair unchanged."` | `"Change the person into someone wearing a red blouse."` — changes the person, not the shirt |
</div>

### Add objects

<div className="pg-hidden-tabs">
  <Tabs>
    <Tab title="Original subject">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/add-objects/source.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=ddfc255cd921c9835712357d9ab57b8a" data-path="assets/lucy-2.5-prompting/add-objects/source.mp4" />
      </div>
    </Tab>

    <Tab title="Macaw parrot">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/add-objects/macaw-parrot.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=faa661600007f0ddf4b97bfe7afcdf6f" data-path="assets/lucy-2.5-prompting/add-objects/macaw-parrot.mp4" />
      </div>
    </Tab>

    <Tab title="Blue helmet">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/add-objects/blue-helmet.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=66b492ea006184bb8a4396a07e322d8d" data-path="assets/lucy-2.5-prompting/add-objects/blue-helmet.mp4" />
      </div>
    </Tab>

    <Tab title="Cape">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/add-objects/cape.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=96c0902207182e6a162367c5a0a08aba" data-path="assets/lucy-2.5-prompting/add-objects/cape.mp4" />
      </div>
    </Tab>
  </Tabs>
</div>

<div className="pg-prompt-tabs">
  <Tabs>
    <Tab title="Original subject">
      ```text Template: theme={null}
      Add <description of object> to <where it should appear>.
      ```
    </Tab>

    <Tab title="Macaw parrot">
      ```text Prompt: theme={null}
      Add two blue, yellow, white, and green macaw parrots to each of the person's shoulders.
      ```
    </Tab>

    <Tab title="Blue helmet">
      <div className="pg-pr">
        <div className="pg-pr-col">
          ```text Prompt: theme={null}
          Add the sparkly blue helmet to the person's head. The helmet has wings, chrome flames, and a transparent yellow glass visor that shows the person's face inside.
          ```
        </div>

        <div className="pg-pr-col">
          <Frame caption="Reference">
            <img className="pg-ref" loading="lazy" decoding="async" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/add-objects/blue-helmet-reference.webp?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=a66af612553bff92b505fb5effae7ecb" alt="Blue helmet reference image" width="800" height="800" data-path="assets/lucy-2.5-prompting/add-objects/blue-helmet-reference.webp" />
          </Frame>
        </div>
      </div>
    </Tab>

    <Tab title="Cape">
      ```text Prompt: theme={null}
      Add a long sparkly blue cape attached to the person's shoulders. The cape has a stand collar, an opening for arms, silver trim, and a yellow inner fabric.
      ```
    </Tab>
  </Tabs>
</div>

**Tips**

* Describe the new object in detail — its parts, colors, and material properties.
* When adding more than one, say how many and where each one goes.

<div className="pg-dodont">
  | ✅ Do | ❌ Don't |
  | - | - |
  | `"Add a silver crown floating above the person's head."` | `"Make it royal."` — too vague |
  | `"Glowing blue sparks emit from the person's fingertips, trail with their hand motion, and reflect on the person's fingers."` | `"A magical thing happens around the hands."` — too vague |
</div>

### Replace objects or features

<div className="pg-hidden-tabs">
  <Tabs>
    <Tab title="Original objects">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/replace-features/source.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=7312c6710d87e75d202a3d3b81785e73" data-path="assets/lucy-2.5-prompting/replace-features/source.mp4" />
      </div>
    </Tab>

    <Tab title="Heart glasses">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/replace-features/heart-glasses.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=daa8fb6f18014aa23f047d55e4533374" data-path="assets/lucy-2.5-prompting/replace-features/heart-glasses.mp4" />
      </div>
    </Tab>

    <Tab title="Tropical plants">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/replace-features/tropical-plants.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=dfc15e9f37c98124e208d11e2fdd5d3a" data-path="assets/lucy-2.5-prompting/replace-features/tropical-plants.mp4" />
      </div>
    </Tab>

    <Tab title="Fountain">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/replace-features/fountain.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=8b4a9ca490b246e90827003d1be5df4b" data-path="assets/lucy-2.5-prompting/replace-features/fountain.mp4" />
      </div>
    </Tab>
  </Tabs>
</div>

<div className="pg-prompt-tabs">
  <Tabs>
    <Tab title="Original objects">
      ```text Template: theme={null}
      Replace <description of object or detail> with <description of change>.
      ```
    </Tab>

    <Tab title="Heart glasses">
      <div className="pg-pr">
        <div className="pg-pr-col">
          ```text Prompt: theme={null}
          Replace the person's sunglasses with the heart-shaped sunglasses, including the glossy hot-pink frame and mirrored rose-tint lenses.
          ```
        </div>

        <div className="pg-pr-col">
          <Frame caption="Reference">
            <img className="pg-ref" loading="lazy" decoding="async" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/replace-features/heart-glasses-reference.webp?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=0a0c258dbb4c71a422154f9aa71065c5" alt="Heart-shaped sunglasses reference image" width="800" height="800" data-path="assets/lucy-2.5-prompting/replace-features/heart-glasses-reference.webp" />
          </Frame>
        </div>
      </div>
    </Tab>

    <Tab title="Tropical plants">
      ```text Prompt: theme={null}
      Replace the plants in the background with tropical foliage.
      ```
    </Tab>

    <Tab title="Fountain">
      ```text Prompt: theme={null}
      Replace the fence with a waterfall-style fountain along the edge of the deck.
      ```
    </Tab>
  </Tabs>
</div>

**Tips**

* To change many similar elements, name the category — like the plants in the background — instead of listing each one.
* Describe what you want to see, not how the edit should be done.

**Troubleshooting**

* **If the original still shows through the replacement:** Describe the new object in full, including the parts that should change.

<div className="pg-dodont">
  | ✅ Do | ❌ Don't |
  | - | - |
  | `"Replace the person's sunglasses with heart-shaped sunglasses, including the glossy hot-pink frame and mirrored rose-tint lenses."` | `"Change the glasses."` — no visible details |
</div>

### Change attribute

<div className="pg-hidden-tabs">
  <Tabs>
    <Tab title="Original items">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/change-attribute/source.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=38cc5fb2c41e6b4c0d193bd0381914fc" data-path="assets/lucy-2.5-prompting/change-attribute/source.mp4" />
      </div>
    </Tab>

    <Tab title="Headphones color">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/change-attribute/headphones.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=a7f06ec3d56f046a03d5da165b600186" data-path="assets/lucy-2.5-prompting/change-attribute/headphones.mp4" />
      </div>
    </Tab>

    <Tab title="Sweater and bag">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/change-attribute/blue-sweater-white-bag.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=a91320f8287f5a4c4c3041366879549d" data-path="assets/lucy-2.5-prompting/change-attribute/blue-sweater-white-bag.mp4" />
      </div>
    </Tab>

    <Tab title="Camo crossbody bag">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/change-attribute/camo-crossbody-bag.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=12b16a7549f57c96d6b6a22842efa957" data-path="assets/lucy-2.5-prompting/change-attribute/camo-crossbody-bag.mp4" />
      </div>
    </Tab>
  </Tabs>
</div>

<div className="pg-prompt-tabs">
  <Tabs>
    <Tab title="Original items">
      ```text Template: theme={null}
      Change <object or feature> to <new color, material, texture, or style>.
      ```
    </Tab>

    <Tab title="Headphones color">
      ```text Prompt: theme={null}
      Change the material of the person's headphones to glossy orange plastic.
      ```
    </Tab>

    <Tab title="Sweater and bag">
      ```text Prompt: theme={null}
      Make the person's sweater medium blue and his bag white leather.
      ```
    </Tab>

    <Tab title="Camo crossbody bag">
      <div className="pg-pr">
        <div className="pg-pr-col">
          ```text Prompt: theme={null}
          Change the material of the person's black bag and its strap to the camouflage print from the reference image.
          ```
        </div>

        <div className="pg-pr-col">
          <Frame caption="Reference">
            <img className="pg-ref" loading="lazy" decoding="async" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/change-attribute/camo-crossbody-bag-reference.webp?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=a87f51a97195fa6c0f03516772990790" alt="Camouflage print reference image" width="800" height="800" data-path="assets/lucy-2.5-prompting/change-attribute/camo-crossbody-bag-reference.webp" />
          </Frame>
        </div>
      </div>
    </Tab>
  </Tabs>
</div>

**Tips**

* Describe material properties — gloss, transparency, reflectivity, weave, finish, or graphic placement — not just the base color.
* Change one or a few related attributes at once, and keep each one specific.
* Try a reference image to apply a specific pattern or texture.

<div className="pg-dodont">
  | ✅ Do | ❌ Don't |
  | - | - |
  | `"Use the black cropped jacket from the reference, including the glossy leather texture and silver zipper. Apply it to the person's jacket."` | `"Use the reference image."` — no target or details |
</div>

### Remove objects

<div className="pg-hidden-tabs">
  <Tabs>
    <Tab title="Original scene">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/remove-objects/source.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=8bad2a1a8059c1e38701bbd403b5fecb" data-path="assets/lucy-2.5-prompting/remove-objects/source.mp4" />
      </div>
    </Tab>

    <Tab title="Foreground elements">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/remove-objects/foreground-elements.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=3a6c28d89b1ec6ea5d11d6d53eab6591" data-path="assets/lucy-2.5-prompting/remove-objects/foreground-elements.mp4" />
      </div>
    </Tab>

    <Tab title="Background elements">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/remove-objects/background-elements.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=3001ce1ea407c28640a6dbb619245b23" data-path="assets/lucy-2.5-prompting/remove-objects/background-elements.mp4" />
      </div>
    </Tab>

    <Tab title="Sun umbrella">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/remove-objects/sun-umbrella.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=311b15219d65477abd4aa8591e417c30" data-path="assets/lucy-2.5-prompting/remove-objects/sun-umbrella.mp4" />
      </div>
    </Tab>
  </Tabs>
</div>

<div className="pg-prompt-tabs">
  <Tabs>
    <Tab title="Original scene">
      ```text Template: theme={null}
      Remove <object> from <where it appears>.
      ```
    </Tab>

    <Tab title="Foreground elements">
      ```text Prompt: theme={null}
      Remove the woman sitting on the bench and the book she's holding so the result shows the people moving in the background.
      ```
    </Tab>

    <Tab title="Background elements">
      ```text Prompt: theme={null}
      Remove the cyclist behind the woman so the result shows only the path, bushes, trees, and grass in the background.
      ```
    </Tab>

    <Tab title="Sun umbrella">
      ```text Prompt: theme={null}
      Remove the large yellow sun umbrella, including its pole and cast shadow, so the result shows the woman in full sunlight.
      ```
    </Tab>
  </Tabs>
</div>

**Tips**

* Describe what should be visible after removal — the surface or background behind the object, including its texture and lighting.
* When removal changes what remains, such as the lighting or shadows on nearby objects, describe the new state.

**Troubleshooting**

* **If a shadow or outline of the removed object remains:** Name it in the prompt so it's removed along with the object.

<div className="pg-dodont">
  | ✅ Do | ❌ Don't |
  | - | - |
  | `"Remove the coffee mug from the desk, leaving the wooden tabletop visible."` | `"Remove the mug."` — no target details |
</div>

### Change background

<div className="pg-hidden-tabs">
  <Tabs>
    <Tab title="Original background">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/change-background/source.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=3293d701b455d8f3339df6cf32d78cec" data-path="assets/lucy-2.5-prompting/change-background/source.mp4" />
      </div>
    </Tab>

    <Tab title="Festive street">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/change-background/festive-street.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=9385423738bdd11c4abeec61f0598cb8" data-path="assets/lucy-2.5-prompting/change-background/festive-street.mp4" />
      </div>
    </Tab>

    <Tab title="Fall hike">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/change-background/hiking-in-the-fall.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=73fc30746c8f273b320c9df544e8c6d4" data-path="assets/lucy-2.5-prompting/change-background/hiking-in-the-fall.mp4" />
      </div>
    </Tab>

    <Tab title="Art deco concourse">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/change-background/art-deco-concourse.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=cd87c9cd774785eb0c9b3ad74e17b5fb" data-path="assets/lucy-2.5-prompting/change-background/art-deco-concourse.mp4" />
      </div>
    </Tab>
  </Tabs>
</div>

<div className="pg-prompt-tabs">
  <Tabs>
    <Tab title="Original background">
      ```text Template: theme={null}
      Change the background to <description of scene>.
      ```
    </Tab>

    <Tab title="Festive street">
      <div className="pg-pr">
        <div className="pg-pr-col">
          ```text Prompt: theme={null}
          Change the background to a Mediterranean street scene with streamers and flags that blow in the breeze.
          ```
        </div>

        <div className="pg-pr-col">
          <Frame caption="Reference">
            <img className="pg-ref" loading="lazy" decoding="async" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/change-background/festive-street-reference.webp?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=74d8c58dbe8e33890e0da60f534eee7e" alt="Mediterranean street scene reference image" width="800" height="450" data-path="assets/lucy-2.5-prompting/change-background/festive-street-reference.webp" />
          </Frame>
        </div>
      </div>
    </Tab>

    <Tab title="Fall hike">
      <div className="pg-pr">
        <div className="pg-pr-col">
          ```text Prompt: theme={null}
          Change the background to a nature preserve in fall with red and yellow trees and river rapids flowing beside the dirt trail.
          ```
        </div>

        <div className="pg-pr-col">
          <Frame caption="Reference">
            <img className="pg-ref" loading="lazy" decoding="async" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/change-background/hiking-in-the-fall-reference.webp?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=d4b0fdb32892c2a46b65263f5675055f" alt="Nature preserve in fall reference image" width="800" height="450" data-path="assets/lucy-2.5-prompting/change-background/hiking-in-the-fall-reference.webp" />
          </Frame>
        </div>
      </div>
    </Tab>

    <Tab title="Art deco concourse">
      <div className="pg-pr">
        <div className="pg-pr-col">
          ```text Prompt: theme={null}
          Change the background to an art deco concourse with softly glowing overhead lights.
          ```
        </div>

        <div className="pg-pr-col">
          <Frame caption="Reference">
            <img className="pg-ref" loading="lazy" decoding="async" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/change-background/art-deco-concourse-reference.webp?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=ecaf403e1b23d62517bbc119510ce981" alt="Art deco concourse reference image" width="800" height="450" data-path="assets/lucy-2.5-prompting/change-background/art-deco-concourse-reference.webp" />
          </Frame>
        </div>
      </div>
    </Tab>
  </Tabs>
</div>

**Tips**

* Say how background elements should move — flags blowing, water flowing — so the scene isn't static.
* To help the subject and new background read as one scene, try matching the light — direction, color, and time of day.
* Keep the prompt focused on the background change — extra instructions about the subject may steer the model toward changing the person instead.
* The background may be fit to the input's framing and camera angle rather than copied 1:1 from the reference — treat the image as a guide to the look, not an exact layout.

<div className="pg-dodont">
  | ✅ Do | ❌ Don't |
  | - | - |
  | `"Change the background to a beach with waves crashing, sunlight on the water, and pale sand."` | `"Make it a beach."` — too vague |
</div>

### Restyle the entire video

<div className="pg-hidden-tabs">
  <Tabs>
    <Tab title="Original style">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/restyle/source.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=e7b6c2449fe5c5e5df20677998db4ab0" data-path="assets/lucy-2.5-prompting/restyle/source.mp4" />
      </div>
    </Tab>

    <Tab title="Watercolor">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/restyle/watercolor.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=d866b79248bf378f1a1355af2709e33f" data-path="assets/lucy-2.5-prompting/restyle/watercolor.mp4" />
      </div>
    </Tab>

    <Tab title="Japanese woodblock print">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/restyle/japanese-woodblock.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=328defdb65a95d7992b93d1f5ae540b6" data-path="assets/lucy-2.5-prompting/restyle/japanese-woodblock.mp4" />
      </div>
    </Tab>

    <Tab title="Crocheted world">
      <div className="pg-stage">
        <video muted loop playsInline preload="none" className="pg-media" src="https://mintcdn.com/decart/t1-DhUmP7tgPCJWi/assets/lucy-2.5-prompting/restyle/crocheted-world.mp4?fit=max&auto=format&n=t1-DhUmP7tgPCJWi&q=85&s=f6eaca3d77bfd19675c3415bbf281e49" data-path="assets/lucy-2.5-prompting/restyle/crocheted-world.mp4" />
      </div>
    </Tab>
  </Tabs>
</div>

<div className="pg-prompt-tabs">
  <Tabs>
    <Tab title="Original style">
      ```text Template: theme={null}
      Transform the entire scene into <style keyword or description>.
      ```
    </Tab>

    <Tab title="Watercolor">
      ```text Prompt: theme={null}
      Transform the entire scene into a watercolor painting.
      ```
    </Tab>

    <Tab title="Japanese woodblock print">
      ```text Prompt: theme={null}
      Transform the entire scene into a Japanese woodblock print with flat layered color, carved linework, visible grain, and simplified shadows.
      ```
    </Tab>

    <Tab title="Crocheted world">
      ```text Prompt: theme={null}
      Transform the entire scene into a handcrafted crocheted world with chunky yarn surfaces, stitched details, soft fibers, and rounded three-dimensional forms.
      ```
    </Tab>
  </Tabs>
</div>

**Tips**

* Name a specific style — a 2D or 3D technique like oil painting or origami, or a material like clay or yarn applied across the whole scene.
* Describe one style through concrete traits, such as palette, texture, brushstroke, linework, or material.

**Troubleshooting**

* **If the restyle flickers between styles:** Use one well-defined style — avoid vague labels like 'artistic' or 'stylized,' and don't mix several styles in one prompt.

<div className="pg-dodont">
  | ✅ Do | ❌ Don't |
  | - | - |
  | `"Transform the entire scene into a watercolor painting style. The final video should show translucent color washes, visible paper texture, and muted pastel colors."` | `"Make this 3D style."` — no concrete style traits |
</div>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.