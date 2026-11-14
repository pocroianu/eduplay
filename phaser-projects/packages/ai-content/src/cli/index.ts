#!/usr/bin/env node

import { Command } from 'commander';
import { setupServicesCommand } from './commands/setup-services';
import { checkHealthCommand } from './commands/check-health';
import { downloadModelsCommand } from './commands/download-models';
import { createGenerateCommand } from './commands/generate';

const program = new Command();

program
  .name('edu-generate')
  .description('Open-source AI-powered content generation for educational Phaser games')
  .version('1.0.0');

// Setup Docker services
program
  .command('setup-services')
  .description('Start local ComfyUI, Piper, and Redis services for configured providers')
  .option('--skip-models', 'Skip downloading base models')
  .option('--gpu-check', 'Verify GPU availability before starting')
  .action(setupServicesCommand);

// Health check for all services
program
  .command('check-health')
  .description('Verify all services are running and healthy')
  .option('--verbose', 'Show detailed health information')
  .action(checkHealthCommand);

// Download and manage models
program
  .command('download-models')
  .description('Prepare optional AI models or verify bundled Piper voices')
  .option('--qwen', 'Prepare the local Qwen base runtime and warm its cache')
  .option('--sdxl', 'Download Stable Diffusion XL model')
  .option('--mistral', 'Download optional Mistral 3 Small model for Ollama text provider')
  .option('--piper', 'Download Piper TTS voices')
  .option('--f5-romanian', 'Show preparation status for F5 Romanian TTS')
  .option('--all', 'Download all models')
  .option('--preset <name>', 'Download preset: children-books, minimal')
  .action(downloadModelsCommand);

program.addCommand(createGenerateCommand());

program.parse();
