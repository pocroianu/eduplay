/**
 * Example usage of ComfyUIProvider
 *
 * This demonstrates basic usage patterns for the ComfyUI image provider.
 * Run with: ts-node src/providers/image/example.ts
 */

import { ComfyUIProvider } from './ComfyUIProvider';
import { ProviderEvents } from '../base/BaseProvider';
import { writeFile } from 'fs/promises';
import { join } from 'path';

async function main() {
  console.log('ComfyUI Provider Example\n');

  // Initialize provider
  console.log('1. Initializing provider...');
  const provider = new ComfyUIProvider({
    name: 'comfyui-example',
    baseUrl: 'http://localhost:8188',
    timeout: 120000,
    retries: 3,
    healthCheckInterval: 30000,
    checkpointName: 'sd_xl_base_1.0.safetensors',
    defaultSampler: 'euler',
    defaultScheduler: 'normal',
    defaultLoraStrengthModel: 1,
    defaultLoraStrengthClip: 1,
    outputFormat: 'png'
  });

  // Setup event listeners
  provider.on(ProviderEvents.STATE_CHANGED, (data) => {
    console.log(`   State: ${data.oldState} -> ${data.newState}`);
  });

  provider.on(ProviderEvents.REQUEST_START, (data) => {
    console.log(`   Request started: ${data.requestId}`);
  });

  provider.on(ProviderEvents.REQUEST_SUCCESS, (data) => {
    console.log(`   Request completed in ${data.latency}ms`);
  });

  try {
    await provider.init();
    console.log('   ✓ Provider initialized\n');

    // Check health
    console.log('2. Checking provider health...');
    const health = await provider.isHealthy();
    console.log(`   Healthy: ${health.healthy}`);
    console.log(`   Latency: ${health.latency}ms`);
    if (health.details) {
      console.log(`   Pending requests: ${health.details.pendingRequests}\n`);
    }

    // Generate a single image
    console.log('3. Generating a single image...');
    const result = await provider.generate({
      prompt: 'a cute cartoon apple with a smiling face, educational illustration',
      width: 512,
      height: 512,
      steps: 20,
      cfgScale: 7,
      style: 'cartoon',
      seed: 42  // Fixed seed for reproducibility
    });

    console.log(`   ✓ Generated image:`);
    console.log(`     - Size: ${result.data.buffer.length} bytes`);
    console.log(`     - Dimensions: ${result.data.width}x${result.data.height}`);
    console.log(`     - Seed: ${result.data.seed}`);
    console.log(`     - Format: ${result.data.mimeType}`);
    console.log(`     - Latency: ${result.latency}ms\n`);

    // Save image
    const outputPath = join(__dirname, 'example-output.png');
    await writeFile(outputPath, result.data.buffer);
    console.log(`   ✓ Saved to: ${outputPath}\n`);

    // Generate multiple images in batch
    console.log('4. Generating batch of images...');
    const batchResults = await provider.generateBatch(
      [
        {
          prompt: 'cartoon apple',
          width: 512,
          height: 512,
          steps: 20,
          cfgScale: 7,
          style: 'cartoon'
        },
        {
          prompt: 'cartoon banana',
          width: 512,
          height: 512,
          steps: 20,
          cfgScale: 7,
          style: 'cartoon'
        },
        {
          prompt: 'cartoon orange',
          width: 512,
          height: 512,
          steps: 20,
          cfgScale: 7,
          style: 'cartoon'
        }
      ],
      {
        concurrency: 1,
        stopOnError: false,
        progressCallback: (completed, total) => {
          console.log(`   Progress: ${completed}/${total}`);
        }
      }
    );

    console.log(`   ✓ Generated ${batchResults.length} images\n`);

    // Save batch results
    for (let i = 0; i < batchResults.length; i++) {
      const batchOutputPath = join(__dirname, `example-batch-${i}.png`);
      await writeFile(batchOutputPath, batchResults[i].data.buffer);
      console.log(`   ✓ Saved batch image ${i + 1}: ${batchOutputPath}`);
    }

    // Get metrics
    console.log('\n5. Provider metrics:');
    const metrics = provider.getMetrics();
    console.log(`   Total requests: ${metrics.totalRequests}`);
    console.log(`   Successful: ${metrics.successfulRequests}`);
    console.log(`   Failed: ${metrics.failedRequests}`);
    console.log(`   Average latency: ${metrics.averageLatency.toFixed(2)}ms`);
    console.log(`   Success rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1)}%\n`);

    // Get supported styles
    console.log('6. Supported styles:');
    const styles = provider.getSupportedStyles();
    console.log(`   ${styles.join(', ')}\n`);

    // Get available LoRAs
    console.log('7. Available LoRA models:');
    const loras = await provider.getAvailableLoras();
    if (loras.length > 0) {
      console.log(`   ${loras.join(', ')}\n`);
    } else {
      console.log('   No LoRA models found\n');
    }

    // Shutdown
    console.log('8. Shutting down provider...');
    await provider.shutdown();
    console.log('   ✓ Provider shut down cleanly\n');

    console.log('Example completed successfully!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);
