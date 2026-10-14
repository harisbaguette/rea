> ## Documentation Index
> Fetch the complete documentation index at: https://docs.platform.decart.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Lucy 2.5 Realtime

> Edit any element in a live video stream - add, replace, or remove objects, swap characters, change backgrounds, and apply effects in realtime.

> Transform any video in realtime with AI-powered editing at 720p. Lucy 2.5 is a general editing model - capable across edit type, object, and scene.

<Info>
  Use Lucy 2.5 as your default realtime editing model. It supports text prompts, reference images, or both in the same integration.
</Info>

## Quick start

### Installation

<Tabs>
  <Tab title="JavaScript">
    ```bash theme={null}
    npm install @decartai/sdk
    ```
  </Tab>

  <Tab title="Python">
    ```bash theme={null}
    pip install decart
    ```
  </Tab>

  <Tab title="Android">
    Add the JitPack repository to your `settings.gradle.kts`:

    ```kotlin settings.gradle.kts theme={null}
    dependencyResolutionManagement {
        repositories {
            google()
            mavenCentral()
            maven { url = uri("https://jitpack.io") }
        }
    }
    ```

    Then add the dependency to your app's `build.gradle.kts`:

    ```kotlin build.gradle.kts theme={null}
    dependencies {
        implementation("com.github.DecartAI:decart-android:0.2.0")
    }
    ```
  </Tab>
</Tabs>

### Connect and start editing

<Tabs>
  <Tab title="JavaScript">
    ```typescript theme={null}
    import { createDecartClient, models } from "@decartai/sdk";

    const model = models.realtime("lucy-2.5");

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        frameRate: model.fps,
        width: model.width,
        height: model.height,
      },
    });

    const client = createDecartClient({
      apiKey: "your-api-key-here",
    });

    const realtimeClient = await client.realtime.connect(stream, {
      model,
      mirror: "auto",
      onRemoteStream: (transformedStream) => {
        document.getElementById("output").srcObject = transformedStream;
      },
      initialState: {
        prompt: {
          text: "Change the wall's color to light blue, natural consistent paint finish.",
          enhance: true,
        },
      },
    });

    await realtimeClient.set({
      prompt: "Substitute the character in the video with the person in the reference image.",
      image: characterImage,
      enhance: true,
    });
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={null}
    import asyncio
    from decart import DecartClient, models
    from decart.types import ModelState, Prompt

    async def main():
        async with DecartClient(api_key="your-api-key-here") as client:
            model = models.realtime("lucy-2.5")

            realtime = await client.realtime.connect(
                stream=media_stream,
                model=model,
                on_remote_stream=lambda s: display(s),
                initial_state=ModelState(
                    prompt=Prompt(
                        text="Change the wall's color to light blue, natural consistent paint finish.",
                        enhance=True,
                    ),
                ),
            )

            with open("character.jpg", "rb") as f:
                await realtime.set(
                    prompt="Substitute the character in the video with the person in the reference image.",
                    image=f,
                    enhance=True,
                )

    asyncio.run(main())
    ```
  </Tab>

  <Tab title="Android">
    ```kotlin theme={null}
    val model = RealtimeModels.LUCY_2_5

    val client = DecartClient(context, DecartClientConfig(apiKey = "your-api-key"))
    client.realtime.initialize(eglBase)

    val videoSource = client.realtime.createVideoSource(isScreencast = false)!!
    val videoTrack = client.realtime.createVideoTrack("camera", videoSource)!!

    val enumerator = Camera2Enumerator(context)
    val cameraName = enumerator.deviceNames.first { enumerator.isFrontFacing(it) }
    val capturer = enumerator.createCapturer(cameraName, null)

    capturer.initialize(
        SurfaceTextureHelper.create("CaptureThread", client.realtime.getEglBaseContext()),
        context,
        videoSource.capturerObserver
    )
    capturer.startCapture(model.width, model.height, model.fps)

    client.realtime.connect(
        localVideoTrack = videoTrack,
        options = ConnectOptions(
            model = model,
            onRemoteVideoTrack = { track ->
                remoteRenderer.addSink(track)
            },
            initialPrompt = InitialPrompt(
                text = "Change the wall's color to light blue, natural consistent paint finish.",
                enhance = true,
            ),
        )
    )

    val characterBase64 = Base64.encodeToString(characterBytes, Base64.NO_WRAP)
    client.realtime.setImage(
        imageBase64 = characterBase64,
        prompt = "Substitute the character in the video with the person in the reference image.",
        enhance = true
    )
    ```
  </Tab>
</Tabs>

<Tip>
  Pass the prompt and/or reference image in `initialState` so the first frame is already transformed - otherwise viewers briefly see the raw camera feed.
</Tip>

## Model capabilities

Lucy 2.5 is designed as a general editing model - reliable across a wide range of tasks, object types, and input conditions.

| Quality dimension | Description |
| - | - |
| **Reference adherence** | Follows the provided reference image precisely |
| **Task adherence** | Executes the prompt exactly as written |
| **Aesthetic and realism** | Natural results across face, body, clothing, and environment |
| **Motion accuracy** | Tracks facial expressions, lip sync, and body movement |
| **Consistency** | Stays stable across long sessions |

### Edit types

| Edit type | Description |
| - | - |
| **Character swap** | Replace a person or character with a new identity from a reference image |
| **Virtual try-on** | Swap clothing or accessories onto a person |
| **Add** | Insert a new object into the scene |
| **Replace** | Swap an existing object with something different |
| **Remove** | Clean removal of objects with background reconstruction |
| **Background** | Swap the scene environment |
| **Style transformation** | Apply a global visual aesthetic to the entire video |
| **Visual effects** | Add dynamic effects - fire, explosions, smoke, particles |

<Info>
  Virtual try-on has a dedicated optimized model. See the [Lucy - Virtual try-on model](/models/realtime/virtual-try-on) for details.
</Info>

## Use cases

<CardGroup cols={2}>
  <Card title="Virtual try-on" icon="shirt">
    Let customers see clothing and accessories on themselves in realtime. Supports a wide range of garment types, materials, and body conditions.
  </Card>

  <Card title="Ad variation" icon="megaphone">
    Generate personalized ad creatives at scale. Swap products, backgrounds, or characters across live or pre-recorded content without reshoots.
  </Card>

  <Card title="Social engagement" icon="heart">
    Give audiences interactive effects, filters, and transformations that drive participation and sharing.
  </Card>

  <Card title="Content monetization" icon="circle-dollar-sign">
    Embed branded products and sponsored placements directly into live video.
  </Card>

  <Card title="Live shopping" icon="bag-shopping">
    Sell any product, in any video. Give sellers the ability to place any item into live content instantly.
  </Card>

  <Card title="Furniture replacement" icon="couch">
    Swap furniture and home decor in live video, letting customers visualize products in their own space before buying.
  </Card>
</CardGroup>

## Updating the reference image

You can change the reference image at any time without reconnecting. Use the `set()` method to atomically replace the session state - include all fields you want to keep:

<CodeGroup>
  ```typescript JavaScript theme={null}
  // Change to a new character
  await realtimeClient.set({
    prompt: "Substitute the character in the video with the person in the reference image.",
    image: newCharacterImage,
    enhance: true,
  });

  // Set a new image only (clears any previous prompt)
  await realtimeClient.set({ image: newCharacterImage });

  // Set a new prompt only (clears any previous image)
  await realtimeClient.set({ prompt: "Add dark sunglasses to the person's face." });

  // Clear the reference image (fall back to text-only editing)
  await realtimeClient.set({ image: null });
  ```

  ```python Python theme={null}
  # Change to a new character
  with open("new_character.jpg", "rb") as f:
      await realtime.set(
          prompt="Substitute the character in the video with the person in the reference image.",
          image=f,
          enhance=True,
      )

  # Set a new image only (clears any previous prompt)
  with open("another.jpg", "rb") as f:
      await realtime.set(image=f)

  # Set a new prompt only (clears any previous image)
  await realtime.set(prompt="Add dark sunglasses to the person's face.")
  ```

  ```kotlin Android theme={null}
  // Change to a new character
  val newCharacterBase64 = Base64.encodeToString(newCharacterBytes, Base64.NO_WRAP)
  client.realtime.setImage(
      imageBase64 = newCharacterBase64,
      prompt = "Substitute the character in the video with the person in the reference image.",
      enhance = true
  )

  // Set a new image only
  client.realtime.setImage(imageBase64 = newCharacterBase64)

  // Set a new prompt only (text-only editing)
  client.realtime.setPrompt("Add dark sunglasses to the person's face.")

  // Clear the reference image (fall back to text-only editing)
  client.realtime.setImage(imageBase64 = null)
  ```
</CodeGroup>

<Tip>
  `set()` replaces the entire state - fields you omit are cleared. Always include every field you want to keep. This avoids intermediate states and ensures prompt and image stay in sync.
</Tip>

### Reference image best practices

<CardGroup cols={2}>
  <Card title="Use a clear, well-lit portrait" icon="sun">
    Consistent, even lighting works best regardless of edit type. For characters, use a front-facing photo. For garments and objects, avoid harsh shadows or reflections that obscure important details.
  </Card>

  <Card title="Match the framing" icon="crop">
    Match the reference framing to the source video. If the source shows a full-body standing person and you want to swap the character or change clothes, use a full-body reference shot rather than a head-and-shoulders crop.
  </Card>

  <Card title="Avoid occlusion" icon="eye">
    Make sure the key features of the reference are fully visible. Partially hidden characters, garments, or objects reduce what the model can extract and may affect output quality.
  </Card>

  <Card title="Resolution and format" icon="image">
    At least 512×512 pixels recommended. Supported formats: JPEG, PNG, and WebP.
  </Card>

  <Card title="For object replacement" icon="box">
    Use a clean product or object shot against a neutral background. The cleaner the separation between subject and background, the more precisely the model can apply it.
  </Card>

  <Card title="For virtual try-on" icon="shirt">
    A front-facing, evenly lit garment shot on a plain background gives the model the clearest signal. Include the full item from collar to hem where possible.
  </Card>
</CardGroup>

## Text-only editing

Lucy 2.5 works without a reference image too. Use text prompts to add, modify, or remove elements in your live video:

<CodeGroup>
  ```typescript JavaScript theme={null}
  // No reference image needed for text-only edits
  await realtimeClient.set({ prompt: "Add a small dog running around in the background." });
  await realtimeClient.set({ prompt: "Change the background to a sandy beach with clear blue water." });
  await realtimeClient.set({ prompt: "Change the person's hair color to bright blonde." });
  ```

  ```python Python theme={null}
  # No reference image needed for text-only edits
  await realtime.set(prompt="Add a small dog running around in the background.")
  await realtime.set(prompt="Change the background to a sandy beach with clear blue water.")
  await realtime.set(prompt="Change the person's hair color to bright blonde.")
  ```

  ```kotlin Android theme={null}
  // No reference image needed for text-only edits
  client.realtime.setPrompt("Add a small dog running around in the background.")
  client.realtime.setPrompt("Change the background to a sandy beach with clear blue water.")
  client.realtime.setPrompt("Change the person's hair color to bright blonde.")
  ```
</CodeGroup>

See the [prompting guide](#prompting-guide) below for the best prompt structures for each edit type.

## Prompting guide

Strong prompts answer five questions: what should change, what should it become, where should it apply, how should it interact with the subject or environment, and what should stay the same.
Think of the prompt as short creative direction. You do not need technical language. You do need clear visual details.

<Info>
  For deeper guidance - layered edits, physical effects, restyle prompts, troubleshooting, and dos/don'ts - see the full [Prompting guide for Lucy 2.5](/models/realtime/lucy-2.5-prompting).
</Info>

Lucy 2.5 responds best when prompts follow the specific pattern for each edit type. The table below shows all eight supported operations with their recommended templates.

| Edit type | Prompt template |
| - | - |
| **Character swap** | `"Substitute the character in the video with <description>."` |
| **Add** | `"Add <description of object> to <where to add it>."` |
| **Replace** | `"Change <object to change> with <description of replacement>."` |
| **Remove** | `"Remove <object to remove> from the scene."` |
| **Change attribute** | `"Change <object> to <description of new attribute>."` |
| **Background** | `"Change the background to <description of new background>."` |
| **Style** | `"Change the style of the video to <style description>."` |
| **VFX** | `"Add <effect description> to <location in scene>."` |

<Note>
  Avoid negative instructions such as "don't add a hat" or "the person never changes clothes." Describe what you want to see instead.
</Note>

### Character swap

When using a reference image, describe the character's appearance in the prompt. The more detail you provide, the closer the output matches the reference.

**"Substitute the character in the video with <span style={{color: '#527a2e'}}>\<description of the character in the reference image></span>."**

Examples:

* *Substitute the character with <span style={{color: '#527a2e'}}>an older man, which has pale, wrinkled skin, light blue eyes, a powdered white wig with side curls, and wears a dark formal coat with a white ruffled neckpiece.</span>*
* *Substitute the character with <span style={{color: '#527a2e'}}>a young person wearing a short-sleeved pink top with white ribbon ties on the back, loose pink pants, and short brown hair tied in a side ponytail.</span>*
* *Substitute the character with <span style={{color: '#527a2e'}}>a furry creature, which has soft brown and orange fur, a light face with dark eye markings, a dark nose, and long claws.</span>*

```typescript theme={null}
await realtimeClient.set({
  prompt: "Substitute the character with a furry creature, which has soft brown and orange fur, a light face with dark eye markings, a dark nose, and long claws.",
  image: referenceImage,
  enhance: true,
});
```

<Note>
  Describe what you see in the reference image - skin tone, hair, clothing, distinctive features. Generic prompts like "Transform into this character" still work but produce less precise results.
</Note>

### Adding objects

Add new elements to the scene by specifying what to add and where to place it.

**"Add <span style={{color: '#527a2e'}}>\<description of object></span> to <span style={{color: '#96603a'}}>\<where to add it></span>."**

Examples:

* *Add <span style={{color: '#527a2e'}}>a red conical hat, covered in sequins, with a white fluffy trim and a matching pompom</span> to <span style={{color: '#96603a'}}>the person's head</span>.*
* *Add <span style={{color: '#527a2e'}}>a coffee mug with a green logo</span> to <span style={{color: '#96603a'}}>the person's right hand</span>.*

```typescript theme={null}
await realtimeClient.set({
  prompt: "Add a red conical hat, covered in sequins, with a white fluffy trim and a matching pompom to the person's head.",
  image: hatReference,
  enhance: true,
});
```

<Tip>
  Always specify placement ("to the person's head", "in the background", "on the table"). Without a location, the model places the object unpredictably.
</Tip>

### Replacing objects

Swap an existing element in the scene with something different.

**"Change <span style={{color: '#96603a'}}>\<object to change></span> with <span style={{color: '#527a2e'}}>\<description of the replacement></span>."**

Examples:

* *Change <span style={{color: '#96603a'}}>the person's sweater</span> with <span style={{color: '#527a2e'}}>a red knit sweater, which has a white-outlined, gold and white striped rectangular emblem on the chest</span>.*
* *Change <span style={{color: '#96603a'}}>the phone in the person's hand</span> with <span style={{color: '#527a2e'}}>a sleek black smartphone with a triple-lens camera on the back</span>.*

```typescript theme={null}
await realtimeClient.set({
  prompt: "Change the person's sweater with a red knit sweater, which has a white-outlined, gold and white striped rectangular emblem on the chest.",
  image: sweaterReference,
  enhance: true,
});
```

### Removing objects

Remove an element from the scene. The model reconstructs the background behind it.

**"Remove <span style={{color: '#96603a'}}>\<object to remove></span> from the scene."**

Examples:

* *Remove <span style={{color: '#96603a'}}>the microphone stand</span> from the scene.*
* *Remove <span style={{color: '#96603a'}}>the logo on the person's shirt</span> from the scene.*
* *Remove <span style={{color: '#96603a'}}>the bottle on the table</span> from the scene.*

```typescript theme={null}
await realtimeClient.set({
  prompt: "Remove the microphone stand from the scene.",
});
```

### Changing attributes

Modify a property of an existing object - color, texture, material - without replacing the object itself.

**"Change <span style={{color: '#96603a'}}>\<object></span> to <span style={{color: '#527a2e'}}>\<description of new attribute></span>."**

Examples:

* *Change <span style={{color: '#96603a'}}>the wall's color</span> to <span style={{color: '#527a2e'}}>light blue, natural consistent paint finish</span>.*
* *Change <span style={{color: '#96603a'}}>the shirt's texture</span> to <span style={{color: '#527a2e'}}>knitted, woven fabric</span>.*

```typescript theme={null}
await realtimeClient.set({
  prompt: "Change the wall's color to light blue, natural consistent paint finish.",
});
```

### Background replacement

Replace the background of the scene with a new environment. Works with or without a reference image.

**"Change the background to <span style={{color: '#527a2e'}}>\<description of the new background></span>."**

Examples:

* *Change the background to <span style={{color: '#527a2e'}}>a sandy beach with clear blue water and a bright sunny sky</span>.*
* *Change the background to <span style={{color: '#527a2e'}}>a cozy living room with warm lighting, bookshelves, and a fireplace</span>.*
* *Change the background to <span style={{color: '#527a2e'}}>a neon-lit city street at night with reflections on wet pavement</span>.*

```typescript theme={null}
await realtimeClient.set({
  prompt: "Change the background to a sandy beach with clear blue water and a bright sunny sky.",
  enhance: true,
});
```

### Style transformation

Apply a global visual style change to the entire scene - mood, aesthetic, or look and feel.

**"Change the style of the video to <span style={{color: '#527a2e'}}>\<style description></span>."**

Examples:

* *Change the style of the video to <span style={{color: '#527a2e'}}>a vintage 1970s film aesthetic with warm tones and slight grain</span>.*
* *Change the style of the video to <span style={{color: '#527a2e'}}>an anime illustration style with cel shading and bold outlines</span>.*
* *Change the style of the video to <span style={{color: '#527a2e'}}>a dark cyberpunk aesthetic with teal and magenta color grading</span>.*

```typescript theme={null}
await realtimeClient.set({
  prompt: "Change the style of the video to a vintage 1970s film aesthetic with warm tones and slight grain.",
  enhance: true,
});
```

### Visual effects

Add dynamic effects to characters or environments. VFX use the same "Add" structure but describe effects rather than physical objects.

**"Add <span style={{color: '#527a2e'}}>\<effect description></span> to <span style={{color: '#96603a'}}>\<location in scene></span>."**

Examples:

* *Add <span style={{color: '#527a2e'}}>shooting fireballs</span> to <span style={{color: '#96603a'}}>the person's hands</span>.*
* *Add <span style={{color: '#527a2e'}}>a large explosion with rising smoke</span> to <span style={{color: '#96603a'}}>the background</span>.*
* *Add <span style={{color: '#527a2e'}}>a swirling vortex of electricity</span> <span style={{color: '#96603a'}}>around the person</span>.*

```typescript theme={null}
await realtimeClient.set({
  prompt: "Add shooting fireballs to the person's hands.",
  enhance: true,
});
```

### Dos and don'ts

| Do | Don't |
| - | - |
| `"Add a silver crown floating above the person's head."` | `"Make it royal."` |
| `"Remove the coffee mug from the desk, leaving the wooden tabletop visible."` | `"Remove the mug."` |
| `"Change the background to a beach with waves crashing, sunlight on the water, and pale sand."` | `"Make it a beach."` |
| `"Use the black cropped jacket from the reference, including the glossy leather texture and silver zipper. Apply it to the person's jacket."` | `"Use the reference image."` |
| `"Replace the shirt with a red silk blouse. Keep the person's identity, face, and hair unchanged."` | `"Change the person into someone wearing a red blouse."` |
| `"Glowing sparks emit from the person's fingertips, trail with their hand motion, and reflect on their fingers."` | `"A magical thing happens around the hands."` |

## Connection lifecycle

Lucy 2.5 shares the same connection lifecycle as all realtime models. See the [JavaScript SDK](/sdks/javascript-realtime#connection-state), [Python SDK](/sdks/python-realtime), or [Android SDK](/sdks/android-realtime#connection-state) for details on:

* Connection states (`connecting`, `connected`, `generating`, `reconnecting`, `disconnected`)
* Auto-reconnect with exponential backoff
* Error handling with `DecartSDKError`
* Session tracking with `generationTick` events
* Session viewing with subscribe tokens

## Complete example

A full application with character switching, connection management, and error handling:

<CodeGroup>
  ```typescript JavaScript theme={null}
  import { createDecartClient, models, type DecartSDKError } from "@decartai/sdk";

  async function setupLucy25() {
    const model = models.realtime("lucy-2.5");

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        frameRate: model.fps,
        width: model.width,
        height: model.height,
      },
    });

    document.getElementById("input-video").srcObject = stream;

    const client = createDecartClient({
      apiKey: process.env.DECART_API_KEY,
    });

    const realtimeClient = await client.realtime.connect(stream, {
      model,
      onRemoteStream: (transformedStream) => {
        document.getElementById("output-video").srcObject = transformedStream;
      },
    });

    realtimeClient.on("connectionChange", (state) => {
      document.getElementById("status").textContent = state;
    });

    realtimeClient.on("generationTick", ({ seconds }) => {
      document.getElementById("usage").textContent = `${seconds}s`;
    });

    realtimeClient.on("error", (error: DecartSDKError) => {
      console.error("Lucy 2.5 error:", error.code, error.message);
    });

    document.getElementById("character-input").addEventListener("change", async (e) => {
      const file = (e.target as HTMLInputElement).files[0];
      if (file) {
        await realtimeClient.set({
          prompt: "Substitute the character in the video with the person in the reference image.",
          image: file,
          enhance: true,
        });
      }
    });

    window.addEventListener("beforeunload", () => {
      realtimeClient.disconnect();
      stream.getTracks().forEach((track) => track.stop());
    });

    return realtimeClient;
  }

  setupLucy25();
  ```

  ```python Python theme={null}
  import asyncio
  from decart import DecartClient, models

  async def main():
      async with DecartClient(api_key="your-api-key-here") as client:
          model = models.realtime("lucy-2.5")

          realtime = await client.realtime.connect(
              stream=media_stream,
              model=model,
              on_remote_stream=lambda s: display(s),
          )

          @realtime.on("connection_change")
          def on_state(state):
              print(f"Connection: {state}")

          @realtime.on("generation_tick")
          def on_tick(seconds):
              print(f"Usage: {seconds}s")

          @realtime.on("error")
          def on_error(error):
              print(f"Lucy 2.5 error: {error.code} {error.message}")

          with open("character.jpg", "rb") as f:
              await realtime.set(
                  prompt="Substitute the character in the video with the person in the reference image.",
                  image=f,
                  enhance=True,
              )

  asyncio.run(main())
  ```

  ```kotlin Android theme={null}
  import ai.decart.sdk.*
  import ai.decart.sdk.realtime.*
  import org.webrtc.*

  val model = RealtimeModels.LUCY_2_5
  val client = DecartClient(context, DecartClientConfig(apiKey = "your-api-key"))
  client.realtime.initialize(eglBase)

  val videoSource = client.realtime.createVideoSource(false)!!
  val videoTrack = client.realtime.createVideoTrack("camera", videoSource)!!
  val enumerator = Camera2Enumerator(context)
  val capturer = enumerator.createCapturer(
      enumerator.deviceNames.first { enumerator.isFrontFacing(it) }, null
  )
  capturer.initialize(
      SurfaceTextureHelper.create("CaptureThread", client.realtime.getEglBaseContext()),
      context, videoSource.capturerObserver
  )
  capturer.startCapture(model.width, model.height, model.fps)

  client.realtime.connect(
      localVideoTrack = videoTrack,
      options = ConnectOptions(
          model = model,
          onRemoteVideoTrack = { track -> remoteRenderer.addSink(track) }
      )
  )

  lifecycleScope.launch {
      client.realtime.connectionState.collect { state -> statusText.text = state.name }
  }
  lifecycleScope.launch {
      client.realtime.generationTicks.collect { tick -> usageText.text = "${tick.seconds}s" }
  }
  lifecycleScope.launch {
      client.realtime.errors.collect { error ->
          Log.e("Lucy25", "Error: ${error.code} ${error.message}") }
  }

  fun onCharacterSelected(imageBytes: ByteArray) {
      val base64 = Base64.encodeToString(imageBytes, Base64.NO_WRAP)
      client.realtime.setImage(
          imageBase64 = base64,
          prompt = "Substitute the character in the video with the person in the reference image.",
          enhance = true
      )
  }

  capturer.stopCapture()
  client.realtime.disconnect()
  client.release()
  eglBase.release()
  ```
</CodeGroup>

## Client-side authentication

For browser and mobile apps, use client tokens instead of your permanent API key.

<CodeGroup>
  ```typescript JavaScript theme={null}
  // Backend: generate a short-lived token (expires in 60 s by default)
  const token = await client.tokens.create();

  // Frontend: let the SDK fetch a fresh token right before every connect and reconnect
  const frontendClient = createDecartClient({
    apiKeyProvider: async () => {
      const res = await fetch("/api/realtime-token", { method: "POST" });
      const { apiKey } = await res.json();
      return apiKey;
    },
  });
  ```

  ```python Python theme={null}
  # Backend: generate a short-lived token
  token = await client.tokens.create()

  # Frontend: connect with the token
  frontend_client = DecartClient(api_key=token.api_key)
  ```

  ```kotlin Android theme={null}
  // Fetch a short-lived token from your backend
  val ephemeralKey = fetchTokenFromBackend()

  // Connect with the token
  val client = DecartClient(context, DecartClientConfig(apiKey = ephemeralKey))
  ```
</CodeGroup>

See the full pattern for [JavaScript](/sdks/javascript-realtime#client-side-authentication) or [Android](/sdks/android-realtime#client-side-authentication).

Client tokens expire 60 seconds after minting by default, so fetch them per dial with `apiKeyProvider` rather than on page load. See [Token lifetime](/getting-started/client-tokens#token-lifetime).

## Technical specifications

| Property | Value |
| - | - |
| **Model ID** | `lucy-2.5` |
| **Resolution** | 1280×720 |
| **Orientation** | Landscape (16:9) and Portrait (9:16) |
| **Transport** | WebRTC |
| **Character reference** | Yes (JPEG, PNG, WebP) |
| **Prompt enhancement** | Yes (default: enabled) |
| **Self-anchoring** | Yes (default: enabled) |
| **Fast mode** | Yes (`speed: "fast"`; 2x rate) |
| **Auto-reconnect** | Yes (exponential backoff, up to 5 retries) |

### Portrait mode (9:16)

On mobile devices (iOS/Android), portrait mode works automatically - the OS maps the front camera to a vertical stream regardless of the constraints you pass. For desktop browsers or external webcams, swap `width` and `height` when calling `getUserMedia`:

```typescript theme={null}
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    frameRate: { ideal: model.fps },
    width: { ideal: model.height },  // swap: use height as width
    height: { ideal: model.width },  // swap: use width as height
    facingMode: "user",
  },
});
```

### Generation stability

In long sessions, Lucy 2.5 can use its own output as an additional anchor - feeding recent generated frames back as the reference image. This self-anchoring mechanism keeps the output stable over time, preventing drifting. It is enabled by default, so most integrations need to do nothing.

Self-anchoring is a connect-time setting. To turn it off, pass `self_anchor=false` as a connection query parameter - the model then anchors only to the live input. Changing it requires a reconnect; it can't be toggled mid-session with `set()`.

```typescript theme={null}
const realtimeClient = await client.realtime.connect(stream, {
  model,
  onRemoteStream: (transformedStream) => {
    document.getElementById("output").srcObject = transformedStream;
  },
  queryParams: { self_anchor: "false" }, // disable self-anchoring
});
```

<Note>
  Self-anchoring works best when the scene stays consistent. If the stream changes significantly - a different person enters the frame, the camera cuts, or the scene shifts entirely - the model may still anchor to the last edited frame, which no longer matches the new input. In these cases do not use self-anchoring.
</Note>

### Fast mode

Fast mode (`speed: "fast"`) gives the session lower latency and higher throughput; output quality is unchanged. It is available for `lucy-2.5` / `lucy-latest`, `lucy-vton-3.6` / `lucy-vton-latest`, and `lucy-vton-3.5`, and is billed at 2x the standard realtime rate for those models. Other models ignore the option. Omit it (the default) for standard mode. See [Pricing](/getting-started/pricing#realtime-models).

Like self-anchoring, fast mode is a connect-time setting: pass `speed: "fast"` when connecting. Changing it requires a reconnect; it can't be toggled mid-session with `set()`. The SDK carries the option across its automatic reconnects.

<CodeGroup>
  ```typescript JavaScript theme={null}
  const realtimeClient = await client.realtime.connect(stream, {
    model,
    speed: "fast", // fast mode
    onRemoteStream: (transformedStream) => {
      document.getElementById("output").srcObject = transformedStream;
    },
  });
  ```

  ```text Raw WebSocket theme={null}
  wss://api3.decart.ai/v1/stream?api_key=YOUR_API_KEY&model=lucy-2.5&speed=fast
  ```
</CodeGroup>

The option ships in [JavaScript](/sdks/javascript-realtime#fast-mode) v0.2.2, [Python](/sdks/python-realtime#fast-mode) v0.2.1, [Android](/sdks/android-realtime#fast-mode) 0.8.1 and [Swift](/sdks/swift-realtime#fast-mode) v0.7.1. On earlier `@decartai/sdk` versions, pass `queryParams: { speed: "fast" }` instead — it lands on the same query parameter.

<Note>
  Standard mode is the *absence* of the option — don't send `speed=standard` or an empty value. If you run a [signaling proxy](/integrations/signaling-proxy-ws), forward the end user's `speed` to the upstream URL, or the session lands on the standard tier.
</Note>

## Next steps

<CardGroup cols={2}>
  <Card title="JavaScript SDK" icon="js" href="/sdks/javascript-realtime">
    Full JavaScript SDK reference for realtime features
  </Card>

  <Card title="Python SDK" icon="python" href="/sdks/python-realtime">
    Full Python SDK reference for realtime features
  </Card>

  <Card title="Android SDK" icon="android" href="/sdks/android-realtime">
    Full Android SDK reference for realtime features
  </Card>

  <Card title="All Models" icon="layer-group" href="/getting-started/models">
    Compare all Decart models side by side
  </Card>
</CardGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.