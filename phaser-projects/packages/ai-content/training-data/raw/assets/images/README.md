# Image Assets

Put manual training images in collection folders under this directory.

Example:

```text
training-data/raw/assets/images/
├── animals/
│   ├── red-fox-01.png
│   └── brown-bear-01.png
└── vehicles/
    └── fire-truck-01.png
```

Then reference those files from `training-data/datasets/image/*.jsonl` using paths like:

`./training-data/raw/assets/images/animals/red-fox-01.png`
