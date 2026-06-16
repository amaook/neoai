# neo Living Assistant UI

This pass turns the main window into an assistant-first surface based on the selected "Living Assistant Lens" direction.

## Layer Stack

1. Environment backdrop
   - Project asset: `public/assets/neo-living-assistant-bg.png`
   - Full-window bitmap background with obsidian, jade, coral, and titanium tones.
   - Lower center is kept dark enough for the editable composer.

2. Lens presence
   - CSS rings and pulse layers over the generated backdrop.
   - The lens is decorative and must not block pointer events.
   - Motion states: idle breathing, thinking pulse, sending flash.

3. Hidden capability rail
   - Top-right icon-only controls for history, workspace, model/tools, and settings.
   - Left history and right workspace remain functional but slide in as hidden drawers.
   - Default first screen shows conversation only.

4. Conversation glass dock
   - Existing `#chatForm` stays as the functional composer.
   - The dock receives a React Bits-inspired electric canvas border.
   - Attach, model selection, status, and send remain inside the dock.

5. Work panels and sheets
   - Existing settings, model popover, workspace, files, terminal, and artifacts remain.
   - They render as dark translucent overlays above the new assistant surface.

## Motion

- Lens breath: slow scale, glow, and ring rotation.
- Composer electric border: canvas-drawn jittered perimeter, inspired by React Bits ElectricBorder but implemented without React.
- Hidden drawers: slide and blur transition from the edges.
- Send state: composer glow intensifies while streaming.
- Reduced motion: static backdrop, no electric canvas, no continuous ring animation.

## Guardrails

- Do not remove existing chat, model, workspace, settings, file, terminal, task, artifact, memory, or pet hooks.
- Do not show the old three-column layout by default.
- Do not leave generated project assets only under the Codex generated image cache.
