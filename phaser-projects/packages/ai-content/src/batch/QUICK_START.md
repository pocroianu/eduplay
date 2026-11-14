# Batch Processing - Quick Start Guide

## Installation

The batch module is included in `@edu-play/ai-content` package.

```bash
npm install @edu-play/ai-content
```

## 5-Minute Tutorial

### 1. Generate 10 Games

```bash
edu-generate batch generate \
  --category fruits \
  --count 10 \
  --theme nature \
  --output ./my-games
```

### 2. Monitor Progress

In another terminal:

```bash
edu-generate batch status <batch-id>
```

### 3. Resume if Interrupted

```bash
edu-generate batch resume <batch-id>
```

### 4. View Metrics

```bash
edu-generate metrics summary
```

## Programmatic Usage

### Basic Example

```typescript
import { BatchProcessor, GameContentGenerator } from '@edu-play/ai-content';

// Initialize
const batchProcessor = new BatchProcessor(gameGenerator);

// Create request
const request = {
  batchId: 'my-batch',
  name: 'My First Batch',
  category: 'fruits',
  count: 5,
  options: {
    theme: 'nature',
    difficulty: 'easy',
    languages: ['en'],
    questionCount: 5,
    validate: true,
    outputDir: './games'
  }
};

// Run batch
const result = await batchProcessor.processBatch(request);

console.log(`Success: ${result.metrics.successRate * 100}%`);
```

### With Progress Monitoring

```typescript
import { BatchEvents } from '@edu-play/ai-content';

batchProcessor.on(BatchEvents.PROGRESS_UPDATE, (progress) => {
  console.log(`${progress.percentage}% complete`);
  console.log(`ETA: ${Math.round(progress.estimatedTimeRemaining / 60000)} minutes`);
});

batchProcessor.on(BatchEvents.JOB_COMPLETED, (job) => {
  console.log(`✓ Generated: ${job.gameId}`);
});

await batchProcessor.processBatch(request);
```

### WebSocket Monitoring

```typescript
import WebSocket from 'ws';
import { StatusServer } from '@edu-play/ai-content';

// Start status server
const statusServer = new StatusServer();
await statusServer.start();

// Connect client
const ws = new WebSocket('ws://localhost:3001');

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'progress') {
    console.log(`Progress: ${msg.payload.progress.percentage}%`);
  }
});

// Run batch (broadcasts to all connected clients)
await batchProcessor.processBatch(request);
```

## Common Patterns

### Pattern 1: Generate with Custom LoRA

```bash
edu-generate batch generate \
  -c animals \
  -n 20 \
  --lora my-animal-lora \
  --theme forest
```

### Pattern 2: Multi-Language Games

```bash
edu-generate batch generate \
  -c colors \
  -n 15 \
  --languages en,ro,es \
  --theme rainbow
```

### Pattern 3: High-Quality with Validation

```bash
edu-generate batch generate \
  -c shapes \
  -n 10 \
  --validate \
  --difficulty hard \
  --questions 10
```

### Pattern 4: Workflow (Train → Generate)

Create `workflow.json`:

```json
{
  "steps": [
    {
      "id": "train",
      "type": "train",
      "config": {
        "dataset": "./training-data/animals.jsonl",
        "modelName": "animals-lora"
      }
    },
    {
      "id": "generate",
      "type": "generate",
      "config": {
        "category": "animals",
        "count": 50,
        "loraModel": "animals-lora"
      }
    }
  ],
  "continueOnError": false
}
```

Run workflow:

```bash
edu-generate workflow run workflow.json
```

## Configuration

### Environment Variables

```bash
# State directory
export EDU_GENERATE_STATE_DIR=~/.edu-generate/batches

# Status server port
export EDU_GENERATE_STATUS_PORT=3001

# Concurrency
export EDU_GENERATE_CONCURRENCY=3
```

### Programmatic Configuration

```typescript
const batchProcessor = new BatchProcessor(generator, {
  concurrency: 5,              // More parallel jobs
  stateDir: './my-state',      // Custom state location
  autoSaveInterval: 5000,      // Save every 5 seconds
  retryConfig: {
    maxAttempts: 5,            // More retries
    baseDelay: 2000,           // Longer delays
    strategy: 'exponential'
  }
});
```

## Troubleshooting

### Issue: Batch Stuck

**Symptoms:** Progress not updating

**Solution:**
```bash
# Check status
edu-generate batch status <batch-id>

# Cancel and retry
edu-generate batch cancel <batch-id>
edu-generate batch resume <batch-id>
```

### Issue: High Failure Rate

**Symptoms:** Many jobs failing

**Solution:**
```bash
# Check service health
edu-generate check-health

# Review errors
edu-generate batch status <batch-id>

# Adjust retry config
```

### Issue: Out of Memory

**Symptoms:** Process crashes

**Solution:**
```typescript
// Reduce concurrency
{ concurrency: 2 }

// Enable validation only
{ validate: false }
```

## Best Practices

### 1. Start Small

Test with 3-5 games before running large batches:

```bash
edu-generate batch generate -c fruits -n 3
```

### 2. Monitor First Batch

Use status server to monitor first batch:

```bash
# Terminal 1: Run batch
edu-generate batch generate -c fruits -n 10

# Terminal 2: Monitor status
watch -n 1 "edu-generate batch status <batch-id>"
```

### 3. Use Resume Feature

Always use resume instead of restart:

```bash
# Don't restart from scratch
# edu-generate batch generate ... # ❌

# Resume existing batch
edu-generate batch resume <batch-id>  # ✅
```

### 4. Collect Metrics

Review metrics after each batch:

```bash
edu-generate metrics report > batch-metrics.txt
```

### 5. Clean Up State

Periodically clean old batches:

```bash
# List old batches
edu-generate batch list

# Delete completed batches
rm ~/.edu-generate/batches/batch-*.json
```

## Next Steps

- **Read Full Docs:** See `README.md` for complete API reference
- **Run Examples:** Check `PHASE7_COMPLETE.md` for examples
- **Write Tests:** Follow patterns in `__tests__/` directory
- **Customize Workflows:** Create multi-step workflows

## Support

- **Issues:** GitHub Issues
- **Docs:** `src/batch/README.md`
- **Examples:** `PHASE7_COMPLETE.md`
- **Tests:** `src/batch/__tests__/`

## Cheat Sheet

```bash
# Generate batch
edu-generate batch generate -c <category> -n <count>

# Resume batch
edu-generate batch resume <batch-id>

# Check status
edu-generate batch status <batch-id>

# Cancel batch
edu-generate batch cancel <batch-id>

# List batches
edu-generate batch list

# View metrics
edu-generate metrics summary
edu-generate metrics report

# Run workflow
edu-generate workflow run <file>

# Create workflow template
edu-generate workflow create --type full -o workflow.json
```

---

**Happy Batch Processing! 🚀**
