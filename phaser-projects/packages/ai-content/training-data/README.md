# Training Data Layout

This directory stores source assets and dataset manifests for the exploratory training and LoRA code paths.

The concrete convention for manual image assets is:

```text
training-data/
├── raw/
│   └── assets/
│       └── images/
│           ├── animals/
│           │   ├── red-fox-01.png
│           │   └── brown-bear-01.png
│           └── vehicles/
│               └── fire-truck-01.png
└── datasets/
    └── image/
        ├── train.sample.jsonl
        ├── train.jsonl
        ├── val.jsonl
        └── test.jsonl
```

Guidelines:

- Put original image files under `raw/assets/images/<collection>/`.
- Keep file names stable and descriptive, for example `red-fox-01.png`.
- Reference those files from JSONL entries using package-relative paths such as `./training-data/raw/assets/images/animals/red-fox-01.png`.
- Keep prompts in the dataset manifest rather than encoding them in directory names.
- Do not place source assets directly in `ComfyUI/input/training`; the trainer copies files there at runtime.

Proof-of-life smoke dataset:

- `datasets/image/train.jsonl` is the real local smoke manifest used by `npm run train:lora:spike`.
- The current proof-of-life dataset uses 10 existing animal assets copied into `raw/assets/images/animals/`.
- The runner stages those assets into `./.runtime/comfyui/input/training/<job-id>/` before submitting the ComfyUI workflow.

Experimental runbook:

```bash
cd packages/ai-content

# 1. Rebuild the package
npm run build

# 2. Rebuild/start Docker services with the training node installed
docker compose -f docker/docker-compose.yml up --build -d comfyui redis piper

# 3. Verify the smoke dataset exists
type .\\training-data\\datasets\\image\\train.jsonl

# 4. Put the matching base checkpoint in .\\models\\checkpoints\\
#    Default children-book preset expects sd_xl_base_1.0.safetensors

# 5. Run the proof-of-life training spike
npm run train:lora:spike -- --dataset ./training-data/datasets/image/train.jsonl --name animals-smoke
```

Artifacts:

- final LoRA files land in `./loras/`
- staged job input lands in `./.runtime/comfyui/input/training/<job-id>/`
- checkpoint output is reserved under `./loras/checkpoints/<job-id>/`

Minimal JSONL shape:

```json
{"id":"animals-red-fox-01","imagePath":"./training-data/raw/assets/images/animals/red-fox-01.png","prompt":"friendly red fox, children's picture book style, isolated subject, bright colors","negativePrompt":"blurry, dark, realistic, text, watermark","category":"animals","style":"children-book","metadata":{"source":"manual-assets","license":"internal","tags":["fox","animal","cartoon"]}}
```
