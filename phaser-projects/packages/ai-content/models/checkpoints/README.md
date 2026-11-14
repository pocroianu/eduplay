Place base diffusion checkpoints for local LoRA training in this folder.

Expected filenames for the current experimental trainer:

- `sd_xl_base_1.0.safetensors` for the `children-book` and `realistic` presets
- `sd_xl_turbo_1.0.safetensors` for the `fast-iteration` preset
- `v1-5-pruned-emaonly.safetensors` for the `memory-efficient` preset

This folder is bind-mounted into the ComfyUI container at `/app/models/checkpoints`.
After adding a checkpoint, restart the `comfyui` service so the trainer node refreshes its checkpoint list.
