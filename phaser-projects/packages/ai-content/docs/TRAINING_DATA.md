# Training Data Collection Guide

Complete guide to extracting, analyzing, and building training datasets from educational Phaser games.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Pipeline Steps](#pipeline-steps)
  - [1. Extract Data](#1-extract-data)
  - [2. Analyze Content](#2-analyze-content)
  - [3. Build Datasets](#3-build-datasets)
  - [4. Validate Quality](#4-validate-quality)
- [CLI Commands](#cli-commands)
- [Quality Metrics](#quality-metrics)
- [Example Workflows](#example-workflows)
- [Troubleshooting](#troubleshooting)

---

## Overview

Phase 3 provides a complete pipeline for collecting training data from existing games to train custom AI models (LoRA) in Phase 4.

Manual image assets should follow this convention:

- put source images in `./training-data/raw/assets/images/<collection>/`
- create an image dataset manifest in `./training-data/datasets/image/`
- use `imagePath` values that point at those files, for example `./training-data/raw/assets/images/animals/red-fox-01.png`
- do not manually copy files into `ComfyUI/input/training`; the trainer prepares that directory from the dataset manifest

See `../training-data/README.md` and `../training-data/datasets/image/train.sample.jsonl` for a concrete example.

For the current proof-of-life local training path, use:

- `../training-data/datasets/image/train.jsonl` as the real smoke dataset
- `npm run train:lora:spike -- --dataset ./training-data/datasets/image/train.jsonl --name animals-smoke`

This runner is intentionally experimental and does not re-enable the old broad training CLI surface.

**What it does:**
- Extracts questions, choices, and assets from game configs
- Analyzes content patterns (categories, themes, common words)
- Builds train/validation/test splits with stratification
- Validates content quality with 22+ metrics

**Why it matters:**
- Creates high-quality training data for LoRA fine-tuning
- Ensures consistency across generated content
- Maintains educational standards (age-appropriate, clear, engaging)

---

## Quick Start

```bash
# 1. Navigate to ai-content package
cd packages/ai-content

# 2. Build the package
npm run build

# 3. Extract data from all games
npm run generate extract --verbose

# 4. Analyze text patterns
npm run generate analyze --type text --verbose

# 5. Build text dataset (70/15/15 split)
npm run generate build-dataset \
  --input ./training-data/raw \
  --type text \
  --split 70:15:15 \
  --seed 42 \
  --verbose

# 6. Validate dataset quality
npm run generate validate \
  --input ./training-data/datasets/text/train.jsonl \
  --type text \
  --min-quality 80 \
  --verbose
```

**Output:**
```
training-data/
├── raw/
│   ├── extracted-games.json
│   └── games/
│       ├── fruits-01.json
│       ├── animals-01.json
│       └── ...
├── analysis/
│   ├── text-analysis.json
│   ├── image-analysis.json
│   └── audio-analysis.json
└── datasets/
    ├── text/
    │   ├── train.jsonl
    │   ├── val.jsonl
    │   ├── test.jsonl
    │   └── manifest.json
    ├── image/
    │   └── ...
    └── audio/
        └── ...
```

---

## Pipeline Steps

### 1. Extract Data

Extract training data from existing game configurations.

**Command:**
```bash
edu-generate extract [options]
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--game-id <id>` | Extract specific game | All games |
| `--output <path>` | Output directory | `./training-data/raw` |
| `--languages <langs>` | Comma-separated languages | `en,ro` |
| `--no-assets` | Skip asset extraction | Include assets |
| `--verbose` | Show detailed progress | false |

**What it extracts:**
- Question texts in all languages
- Choice texts and asset paths
- Categories and difficulty levels
- Game metadata (theme, target age, etc.)
- Asset information (images, audio)

**Example:**
```bash
# Extract all games with verbose output
edu-generate extract --verbose

# Extract specific game
edu-generate extract --game-id fruits-01 --verbose

# Extract without assets (faster)
edu-generate extract --no-assets
```

**Output format (JSON):**
```json
{
  "gameId": "fruits-01",
  "meta": {
    "title": "Fruit Quiz",
    "theme": "nature",
    "difficulty": "easy",
    "languages": ["en", "ro"]
  },
  "questions": [
    {
      "id": "q1",
      "text": {
        "en": "Which one is an apple?",
        "ro": "Care este marul?"
      },
      "category": "fruits",
      "choices": [
        {
          "id": "apple",
          "text": {
            "en": "Apple",
            "ro": "Măr"
          },
          "assetPath": "assets/images/apple.png",
          "category": "fruits"
        }
      ],
      "correctChoice": "apple",
      "difficulty": 1
    }
  ],
  "assets": [...],
  "statistics": {...}
}
```

---

### 2. Analyze Content

Analyze extracted content to identify patterns and themes.

**Command:**
```bash
edu-generate analyze [options]
```

**Options:**
| Option | Description | Required |
|--------|-------------|----------|
| `--input <path>` | Input directory | No (`./training-data/raw`) |
| `--output <path>` | Output directory | No (`./training-data/analysis`) |
| `--type <type>` | Content type: `image`, `text`, or `audio` | **Yes** |
| `--verbose` | Show detailed analysis | No |

**What it analyzes:**

**Text Analysis:**
- Common words and phrases
- Average word count and readability
- Language patterns
- Category distribution
- Sentence complexity

**Image Analysis:**
- Image formats (PNG, JPG, etc.)
- Average dimensions
- Color palettes
- Style consistency

**Audio Analysis:**
- Sample rates and bitrates
- Average duration
- Language distribution
- Quality metrics

**Example:**
```bash
# Analyze text patterns
edu-generate analyze --type text --verbose

# Analyze image patterns
edu-generate analyze --type image --verbose

# Analyze audio patterns
edu-generate analyze --type audio --verbose
```

**Output format (JSON):**
```json
{
  "totalItems": 150,
  "patterns": {
    "categories": {
      "fruits": 45,
      "animals": 38,
      "colors": 30
    },
    "commonThemes": [
      "identification",
      "comparison",
      "counting"
    ]
  },
  "textAnalysis": {
    "commonWords": ["which", "one", "select", "find"],
    "averageWordCount": 6.5,
    "averageReadability": 85.2,
    "languageDistribution": {
      "en": 75,
      "ro": 75
    }
  }
}
```

---

### 3. Build Datasets

Build ML-ready datasets with train/validation/test splits.

**Command:**
```bash
edu-generate build-dataset [options]
```

**Options:**
| Option | Description | Required |
|--------|-------------|----------|
| `--input <path>` | Input extracted data path | **Yes** |
| `--output <path>` | Output directory | No (`./training-data/datasets`) |
| `--type <type>` | Dataset type: `image`, `text`, or `audio` | **Yes** |
| `--split <ratio>` | Train:val:test ratio | No (`70:15:15`) |
| `--no-shuffle` | Disable shuffling | No (shuffled by default) |
| `--seed <number>` | Random seed for reproducibility | No |
| `--verbose` | Show detailed progress | No |

**Split ratios:**
- Must be in format `train:val:test` (e.g., `70:15:15`)
- Must sum to 100
- Common ratios:
  - `70:15:15` - Standard (default)
  - `80:10:10` - More training data
  - `60:20:20` - More validation/test data

**Example:**
```bash
# Build text dataset with standard split
edu-generate build-dataset \
  --input ./training-data/raw \
  --type text \
  --split 70:15:15 \
  --seed 42 \
  --verbose

# Build image dataset with more training data
edu-generate build-dataset \
  --input ./training-data/raw \
  --type image \
  --split 80:10:10 \
  --seed 42

# Build audio dataset without shuffling
edu-generate build-dataset \
  --input ./training-data/raw \
  --type audio \
  --no-shuffle
```

**Output format (JSONL - one JSON object per line):**

**Text dataset:**
```jsonl
{"id":"fruits-01-q1-en","text":"Which one is an apple?","category":"fruits","metadata":{"gameId":"fruits-01","questionId":"q1","language":"en","difficulty":1}}
{"id":"fruits-01-q2-en","text":"Which one is a banana?","category":"fruits","metadata":{"gameId":"fruits-01","questionId":"q2","language":"en","difficulty":2}}
```

**Image dataset:**
```jsonl
{"id":"fruits-01-q1-apple","imagePath":"assets/images/apple.png","prompt":"Which one is an apple?","category":"fruits","metadata":{"gameId":"fruits-01","questionId":"q1","choiceId":"apple","isCorrect":true}}
{"id":"fruits-01-q1-banana","imagePath":"assets/images/banana.png","prompt":"Which one is an apple?","category":"fruits","metadata":{"gameId":"fruits-01","questionId":"q1","choiceId":"banana","isCorrect":false}}
```

**Manifest file:**
```json
{
  "type": "text",
  "created": "2025-01-18T10:00:00.000Z",
  "splitRatio": {
    "train": 0.7,
    "val": 0.15,
    "test": 0.15
  },
  "shuffle": true,
  "seed": 42,
  "statistics": {
    "total": 150,
    "train": 105,
    "val": 22,
    "test": 23,
    "categories": ["fruits", "animals", "colors"]
  },
  "files": {
    "train": "./training-data/datasets/text/train.jsonl",
    "val": "./training-data/datasets/text/val.jsonl",
    "test": "./training-data/datasets/text/test.jsonl"
  }
}
```

---

### 4. Validate Quality

Validate content quality against 22+ metrics.

**Command:**
```bash
edu-generate validate [options]
```

**Options:**
| Option | Description | Required |
|--------|-------------|----------|
| `--input <path>` | Input file or directory | **Yes** |
| `--type <type>` | Content type: `image`, `text`, or `audio` | **Yes** |
| `--output <path>` | Save validation report to file | No |
| `--min-quality <score>` | Minimum quality score (0-100) | No (80) |
| `--strict` | Fail on warnings | No |
| `--verbose` | Show detailed validation | No |

**Example:**
```bash
# Validate text dataset
edu-generate validate \
  --input ./training-data/datasets/text/train.jsonl \
  --type text \
  --min-quality 80 \
  --verbose

# Validate with strict mode (fail on warnings)
edu-generate validate \
  --input ./training-data/datasets/text/train.jsonl \
  --type text \
  --min-quality 85 \
  --strict

# Save validation report
edu-generate validate \
  --input ./training-data/datasets/text/train.jsonl \
  --type text \
  --output ./training-data/validation-report.json
```

**Validation output:**
```
✔ Validation complete - all checks passed!

Validation Results:
  📊 Total items: 105
  ✅ Passed: 102
  ❌ Failed: 3
  ⚠️  Warnings: 5
  📈 Pass rate: 97.1%

Issues Found:
  ❌ Quality score 75.0 below minimum 80: 3
  ⚠️  readability: 72.5 (could be improved): 5

  💾 Report saved to: ./training-data/validation-report.json

✅ Validation completed successfully!
```

---

## CLI Commands

### Global Options

All commands support:
- `--verbose` - Show detailed progress and debugging information
- `--help` - Show command help

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error or validation failure |

---

## Quality Metrics

The validation system uses 22+ quality metrics across text, image, and audio content.

### Text Metrics (10 metrics)

| Metric | Range | Description | Target |
|--------|-------|-------------|--------|
| **Length** | 0-100 | Word count appropriateness | 70-100 |
| **Clarity** | 0-100 | Sentence clarity and simplicity | 80-100 |
| **Grammar** | 0-100 | Basic grammar rules | 90-100 |
| **Readability** | 0-100 | Flesch-Kincaid readability | 75-95 |
| **Age appropriateness** | 0-100 | Vocabulary for ages 3-8 | 80-100 |
| **Engagement** | 0-100 | Question phrasing | 70-100 |
| **Completeness** | 0-100 | Has all required parts | 100 |
| **Consistency** | 0-100 | Consistent style and tone | 80-100 |
| **Cultural sensitivity** | 0-100 | Appropriate for all cultures | 90-100 |
| **Instruction clarity** | 0-100 | Clear instructions | 85-100 |

### Image Metrics (7 metrics)

| Metric | Range | Description | Target |
|--------|-------|-------------|--------|
| **Resolution** | 0-100 | Image dimensions | 80-100 |
| **Format appropriateness** | 0-100 | PNG/JPG suitability | 90-100 |
| **File size** | 0-100 | Size optimization | 70-100 |
| **Visual clarity** | 0-100 | Clear, not blurry | 85-100 |
| **Color appropriateness** | 0-100 | Child-friendly colors | 80-100 |
| **Simplicity** | 0-100 | Not overly complex | 75-100 |
| **Background** | 0-100 | Appropriate background | 80-100 |

### Audio Metrics (5 metrics)

| Metric | Range | Description | Target |
|--------|-------|-------------|--------|
| **Duration** | 0-100 | Length appropriateness | 70-100 |
| **Quality** | 0-100 | Audio clarity | 85-100 |
| **Speed** | 0-100 | Speaking pace | 80-100 |
| **Volume** | 0-100 | Audio level | 85-100 |
| **Text match** | 0-100 | Matches text content | 95-100 |

### Overall Score Calculation

```
Overall Score = Σ(metric_score × metric_weight) / Σ(metric_weight)
```

**Pass criteria:**
- Overall score ≥ minimum quality (default: 80)
- No critical issues (score = 0 for any metric)
- In strict mode: no warnings (all metrics ≥ 85)

---

## Example Workflows

### Workflow 1: Complete Pipeline

Extract data, analyze patterns, build datasets, and validate:

```bash
# Step 1: Extract all games
edu-generate extract --verbose

# Step 2: Analyze content (all types)
edu-generate analyze --type text --verbose
edu-generate analyze --type image --verbose
edu-generate analyze --type audio --verbose

# Step 3: Build datasets (all types)
edu-generate build-dataset \
  --input ./training-data/raw \
  --type text \
  --split 70:15:15 \
  --seed 42 \
  --verbose

edu-generate build-dataset \
  --input ./training-data/raw \
  --type image \
  --split 70:15:15 \
  --seed 42

edu-generate build-dataset \
  --input ./training-data/raw \
  --type audio \
  --split 70:15:15 \
  --seed 42

# Step 4: Validate datasets
edu-generate validate \
  --input ./training-data/datasets/text/train.jsonl \
  --type text \
  --min-quality 80 \
  --verbose

edu-generate validate \
  --input ./training-data/datasets/image/train.jsonl \
  --type image \
  --min-quality 80

edu-generate validate \
  --input ./training-data/datasets/audio/train.jsonl \
  --type audio \
  --min-quality 80
```

### Workflow 2: Single Game Analysis

Extract and analyze a specific game:

```bash
# Extract specific game
edu-generate extract --game-id fruits-01 --verbose

# Analyze text patterns
edu-generate analyze \
  --input ./training-data/raw/games \
  --type text \
  --verbose

# Build small dataset
edu-generate build-dataset \
  --input ./training-data/raw/games \
  --type text \
  --split 60:20:20 \
  --seed 42
```

### Workflow 3: Quality Audit

Validate existing datasets with strict criteria:

```bash
# Validate with high quality threshold
edu-generate validate \
  --input ./training-data/datasets/text/train.jsonl \
  --type text \
  --min-quality 90 \
  --strict \
  --output ./audit-report.json \
  --verbose
```

### Workflow 4: Data Refresh

Re-extract and rebuild after game updates:

```bash
# Clear old data
rm -rf ./training-data

# Re-extract all games
edu-generate extract --verbose

# Rebuild datasets with same seed for reproducibility
edu-generate build-dataset \
  --input ./training-data/raw \
  --type text \
  --split 70:15:15 \
  --seed 42

# Validate new datasets
edu-generate validate \
  --input ./training-data/datasets/text/train.jsonl \
  --type text \
  --min-quality 80
```

---

## Troubleshooting

### Issue: No games found

**Error:** `No game data found. Run "extract" command first.`

**Solution:**
- Ensure Activities exist in `activities/*/versions/*/`
- Check that each Activity version has `config.json` and `strings/en.json` / `strings/ro.json`
- Run `edu-generate extract --verbose` to see what's being discovered

### Issue: Invalid split ratio

**Error:** `Split ratios must sum to 100. Got: 95`

**Solution:**
- Ensure train:val:test ratios sum to exactly 100
- Example: `70:15:15` ✅, `70:10:15` ❌

### Issue: Low quality scores

**Warning:** `Quality score 65.0 below minimum 80`

**Solution:**
1. Review the specific metrics failing (use `--verbose`)
2. Check the validation report (use `--output`)
3. Fix source content in game configs
4. Re-extract and rebuild datasets

### Issue: No items found

**Error:** `No text items found in extracted data`

**Solution:**
- Verify content type matches data
- For text: check questions have text content
- For image: check choices have asset paths
- For audio: check audio assets exist

### Issue: File not found

**Error:** `ENOENT: no such file or directory`

**Solution:**
- Check input paths are correct
- Use absolute paths or paths relative to `packages/ai-content`
- Ensure extract ran successfully before analyze/build

### Issue: Permission denied

**Error:** `EACCES: permission denied`

**Solution:**
- Check file/directory permissions
- Ensure output directories are writable
- On Unix/Mac: `chmod +w ./training-data`

---

## Next Steps

After completing Phase 3:

1. **Review Analysis Reports**: Check `./training-data/analysis/` for content patterns
2. **Inspect Datasets**: Verify `./training-data/datasets/` JSONL files
3. **Check Validation**: Ensure pass rate ≥ 80%
4. **Phase 4: LoRA Training**: Use datasets to train custom LoRA models

**See also:**
- [Phase 3 Specification](../.spec/phase-3-training-data.md)
- [Phase 4 Specification](../.spec/phase-4-lora-training.md)
- [Main README](../README.md)

---

*Last updated: January 2025*
