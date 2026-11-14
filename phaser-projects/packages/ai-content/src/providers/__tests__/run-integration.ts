#!/usr/bin/env npx ts-node
/**
 * Standalone Integration Test Runner for Phase 2 Provider System
 *
 * This script can be run directly with:
 *   npx ts-node src/providers/__tests__/run-integration.ts
 *
 * It validates that the Phase 2 provider system is working correctly
 * without requiring Docker services (uses mock providers).
 */

import { ProviderFactory, FactoryConfig } from '../factory/ProviderFactory';
import { MockImageProvider } from '../mocks/MockImageProvider';
import { MockTextProvider } from '../mocks/MockTextProvider';
import { MockAudioProvider } from '../mocks/MockAudioProvider';
import { ProviderState } from '../base/BaseProvider';

// ANSI color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message: string): void {
  console.log(message);
}

function success(message: string): void {
  console.log(`${colors.green}[PASS]${colors.reset} ${message}`);
}

function fail(message: string, error?: Error): void {
  console.log(`${colors.red}[FAIL]${colors.reset} ${message}`);
  if (error) {
    console.log(`       ${colors.red}Error: ${error.message}${colors.reset}`);
  }
}

function info(message: string): void {
  console.log(`${colors.blue}[INFO]${colors.reset} ${message}`);
}

function header(message: string): void {
  console.log(`\n${colors.bold}${colors.yellow}=== ${message} ===${colors.reset}\n`);
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: Error;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    success(`${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - start;
    results.push({ name, passed: false, error: error as Error, duration });
    fail(`${name} (${duration}ms)`, error as Error);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function main(): Promise<void> {
  console.log('\n');
  log(`${colors.bold}Phase 2 Provider System - Integration Test${colors.reset}`);
  log('============================================\n');
  log('Running comprehensive tests for the AI content provider system.');
  log('Tests use mock providers - no Docker services required.\n');

  // Test 1: ProviderFactory Initialization
  header('1. ProviderFactory Initialization');

  await runTest('Factory singleton creation', async () => {
    ProviderFactory.reset();
    const config: FactoryConfig = {
      mode: 'self-hosted',
      providers: {
        text: { provider: 'mock', config: {} },
        image: { provider: 'mock', config: {} },
        audio: { provider: 'mock', config: {} }
      },
      cache: { enabled: true }
    };
    const factory = ProviderFactory.getInstance(config);
    await factory.initialize();
    assert(factory !== null, 'Factory should be created');
    await factory.shutdown();
    ProviderFactory.reset();
  });

  await runTest('Factory returns cached providers', async () => {
    ProviderFactory.reset();
    const config: FactoryConfig = {
      mode: 'self-hosted',
      providers: {
        text: { provider: 'mock', config: {} },
        image: { provider: 'mock', config: {} },
        audio: { provider: 'mock', config: {} }
      },
      cache: { enabled: true }
    };
    const factory = ProviderFactory.getInstance(config);
    await factory.initialize();
    const p1 = await factory.getImageProvider();
    const p2 = await factory.getImageProvider();
    assert(p1 === p2, 'Same provider instance should be returned');
    await factory.shutdown();
    ProviderFactory.reset();
  });

  // Test 2: Image Provider
  header('2. Image Provider Tests');

  await runTest('Image generation with mock provider', async () => {
    const provider = new MockImageProvider();
    await provider.init();
    const result = await provider.generate({
      prompt: 'A red apple',
      width: 512,
      height: 512,
      steps: 20,
      cfgScale: 7
    });
    assert(result.data.buffer !== undefined, 'Image buffer should exist');
    assert(result.data.width === 512, 'Width should be 512');
    assert(result.data.mimeType === 'image/png', 'MIME type should be image/png');
    await provider.shutdown();
  });

  await runTest('Image batch generation', async () => {
    const provider = new MockImageProvider();
    await provider.init();
    const results = await provider.generateBatch([
      { prompt: 'apple', width: 512, height: 512, steps: 20, cfgScale: 7 },
      { prompt: 'banana', width: 512, height: 512, steps: 20, cfgScale: 7 }
    ]);
    assert(results.length === 2, 'Should return 2 results');
    await provider.shutdown();
  });

  // Test 3: Text Provider
  header('3. Text Provider Tests');

  await runTest('Text generation with mock provider', async () => {
    const provider = new MockTextProvider();
    await provider.init();
    const result = await provider.generate({
      prompt: 'Generate a question',
      maxTokens: 100,
      temperature: 0.7,
      topP: 0.9,
      format: 'text'
    });
    assert(result.data.text.length > 0, 'Text should be generated');
    assert(result.data.finishReason === 'stop', 'Finish reason should be stop');
    await provider.shutdown();
  });

  await runTest('Text provider model info', async () => {
    const provider = new MockTextProvider();
    await provider.init();
    const info = await provider.getModelInfo();
    assert(info.name === 'mock-model', 'Model name should be mock-model');
    assert(info.contextLength === 4096, 'Context length should be 4096');
    await provider.shutdown();
  });

  // Test 4: Audio Provider
  header('4. Audio Provider Tests');

  await runTest('Audio generation with mock provider', async () => {
    const provider = new MockAudioProvider();
    await provider.init();
    const result = await provider.generate({
      text: 'Hello, this is a test.',
      language: 'en',
      speed: 1.0,
      pitch: 1.0,
      format: 'mp3'
    });
    assert(result.data.buffer !== undefined, 'Audio buffer should exist');
    assert(result.data.mimeType === 'audio/mpeg', 'MIME type should be audio/mpeg');
    assert(result.data.duration > 0, 'Duration should be greater than 0');
    await provider.shutdown();
  });

  await runTest('Audio provider voice listing', async () => {
    const provider = new MockAudioProvider();
    await provider.init();
    const enVoices = await provider.getVoices('en');
    const roVoices = await provider.getVoices('ro');
    assert(enVoices.length > 0, 'Should have English voices');
    assert(roVoices.length > 0, 'Should have Romanian voices');
    await provider.shutdown();
  });

  // Test 5: Health Checks
  header('5. Health Check Tests');

  await runTest('Health check reports healthy', async () => {
    ProviderFactory.reset();
    const config: FactoryConfig = {
      mode: 'self-hosted',
      providers: {
        text: { provider: 'mock', config: {} },
        image: { provider: 'mock', config: {} },
        audio: { provider: 'mock', config: {} }
      },
      cache: { enabled: true }
    };
    const factory = ProviderFactory.getInstance(config);
    await factory.initialize();
    const health = await factory.healthCheck();
    assert(health.image.healthy === true, 'Image provider should be healthy');
    assert(health.text.healthy === true, 'Text provider should be healthy');
    assert(health.audio.healthy === true, 'Audio provider should be healthy');
    assert(health.cache.healthy === true, 'Cache should be healthy');
    await factory.shutdown();
    ProviderFactory.reset();
  });

  // Test 6: Provider State Lifecycle
  header('6. Provider Lifecycle Tests');

  await runTest('Provider state transitions', async () => {
    const provider = new MockImageProvider();
    assert(provider.getState() === ProviderState.UNINITIALIZED, 'Should start uninitialized');
    await provider.init();
    assert(provider.getState() === ProviderState.READY, 'Should be ready after init');
    await provider.shutdown();
    assert(provider.getState() === ProviderState.SHUTDOWN, 'Should be shutdown after shutdown');
  });

  // Test 7: End-to-End Game Content Generation
  header('7. End-to-End Game Content Generation');

  await runTest('Generate content for one educational question', async () => {
    ProviderFactory.reset();
    const config: FactoryConfig = {
      mode: 'self-hosted',
      providers: {
        text: { provider: 'mock', config: {} },
        image: { provider: 'mock', config: {} },
        audio: { provider: 'mock', config: {} }
      },
      cache: { enabled: true }
    };
    const factory = ProviderFactory.getInstance(config);
    await factory.initialize();

    const textProvider = await factory.getTextProvider();
    const imageProvider = await factory.getImageProvider();
    const audioProvider = await factory.getAudioProvider();

    // Generate question text
    const questionText = await textProvider.generate({
      prompt: 'Generate a question about identifying an apple',
      maxTokens: 100,
      temperature: 0.7,
      topP: 0.9,
      format: 'text'
    });
    assert(questionText.data.text.length > 0, 'Question text should be generated');

    // Generate images for choices
    const images = await imageProvider.generateBatch([
      { prompt: 'apple', width: 512, height: 512, steps: 20, cfgScale: 7 },
      { prompt: 'banana', width: 512, height: 512, steps: 20, cfgScale: 7 },
      { prompt: 'orange', width: 512, height: 512, steps: 20, cfgScale: 7 }
    ]);
    assert(images.length === 3, 'Should generate 3 images');

    // Generate audio for question
    const audio = await audioProvider.generate({
      text: 'Which one is an apple?',
      language: 'en',
      speed: 1.0,
      pitch: 1.0,
      format: 'mp3'
    });
    assert(audio.data.duration > 0, 'Audio should have duration');

    info(`  Generated: 1 question text, ${images.length} images, 1 audio file`);

    await factory.shutdown();
    ProviderFactory.reset();
  });

  // Summary
  header('Test Summary');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  log(`Total tests: ${results.length}`);
  log(`${colors.green}Passed: ${passed}${colors.reset}`);

  if (failed > 0) {
    log(`${colors.red}Failed: ${failed}${colors.reset}`);
    log('\nFailed tests:');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        log(`  - ${r.name}: ${r.error?.message}`);
      });
  }

  log(`\nTotal duration: ${totalDuration}ms`);

  if (failed === 0) {
    log(`\n${colors.green}${colors.bold}All tests passed! Phase 2 implementation is complete.${colors.reset}`);
    process.exit(0);
  } else {
    log(`\n${colors.red}${colors.bold}Some tests failed. Please review the errors above.${colors.reset}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
