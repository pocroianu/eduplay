import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComfyUIProvider, type ComfyUIWorkflow } from '../ComfyUIProvider';

const qwenWorkflow: ComfyUIWorkflow = {
  '3': {
    inputs: {
      seed: 0,
      steps: 30,
      cfg: 5.5,
      sampler_name: 'euler',
      scheduler: 'normal',
      denoise: 1,
      model: ['10', 0],
      positive: ['27', 0],
      negative: ['34', 0],
      latent_image: ['13', 0]
    },
    class_type: 'KSampler'
  },
  '10': {
    inputs: {
      unet_name: 'qwen_image_fp8_e4m3fn.safetensors',
      weight_dtype: 'fp8_e4m3fn'
    },
    class_type: 'UNETLoader'
  },
  '13': {
    inputs: {
      width: 1024,
      height: 1024,
      batch_size: 1
    },
    class_type: 'EmptySD3LatentImage'
  },
  '20': {
    inputs: {
      clip_name: 'qwen_2.5_vl_7b_fp8_scaled.safetensors',
      type: 'qwen_image'
    },
    class_type: 'CLIPLoader'
  },
  '27': {
    inputs: {
      text: '',
      clip: ['20', 0]
    },
    class_type: 'CLIPTextEncode'
  },
  '30': {
    inputs: {
      vae_name: 'qwen_image_vae.safetensors'
    },
    class_type: 'VAELoader'
  },
  '34': {
    inputs: {
      text: '',
      clip: ['20', 0]
    },
    class_type: 'CLIPTextEncode'
  }
};

const baseWorkflow: ComfyUIWorkflow = {
  '3': {
    inputs: {
      seed: 0,
      steps: 20,
      cfg: 7,
      model: ['10', 0],
      positive: ['6', 0],
      negative: ['7', 0],
      latent_image: ['5', 0]
    },
    class_type: 'KSampler'
  },
  '4': {
    inputs: {
      ckpt_name: 'sd_xl_base_1.0.safetensors'
    },
    class_type: 'CheckpointLoaderSimple'
  },
  '5': {
    inputs: {
      width: 512,
      height: 512,
      batch_size: 1
    },
    class_type: 'EmptyLatentImage'
  },
  '6': {
    inputs: {
      text: '',
      clip: ['10', 1]
    },
    class_type: 'CLIPTextEncode'
  },
  '7': {
    inputs: {
      text: '',
      clip: ['10', 1]
    },
    class_type: 'CLIPTextEncode'
  },
  '10': {
    inputs: {
      model: ['4', 0],
      clip: ['4', 1],
      lora_name: '',
      strength_model: 1,
      strength_clip: 1
    },
    class_type: 'LoraLoader'
  }
};

function createQwenProvider() {
  const provider = new ComfyUIProvider({
    name: 'comfyui-test',
    baseUrl: 'http://localhost:8188',
    timeout: 120000
  });

  (provider as any).baseWorkflow = JSON.parse(JSON.stringify(qwenWorkflow));

  return provider as any;
}

function createProvider() {
  const provider = new ComfyUIProvider({
    name: 'comfyui-test',
    baseUrl: 'http://localhost:8188',
    timeout: 120000
  });

  (provider as any).baseWorkflow = JSON.parse(JSON.stringify(baseWorkflow));

  return provider as any;
}

describe('ComfyUIProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies a requested LoRA to the workflow model and clip path', () => {
    const provider = createProvider();

    const workflow = provider.createWorkflow({
      prompt: 'A friendly elephant',
      width: 512,
      height: 512,
      steps: 20,
      cfgScale: 7,
      lora: 'animals-bulk_20260327_143605.safetensors'
    });

    expect(workflow['10']).toBeDefined();
    expect(workflow['10'].inputs.lora_name).toBe('animals-bulk_20260327_143605.safetensors');
    expect(workflow['3'].inputs.model).toEqual(['10', 0]);
    expect(workflow['6'].inputs.clip).toEqual(['10', 1]);
    expect(workflow['7'].inputs.clip).toEqual(['10', 1]);
  });

  it('bypasses the LoRA loader when no LoRA is requested', () => {
    const provider = createProvider();

    const workflow = provider.createWorkflow({
      prompt: 'A friendly elephant',
      width: 512,
      height: 512,
      steps: 20,
      cfgScale: 7
    });

    expect(workflow['10']).toBeUndefined();
    expect(workflow['3'].inputs.model).toEqual(['4', 0]);
    expect(workflow['6'].inputs.clip).toEqual(['4', 1]);
    expect(workflow['7'].inputs.clip).toEqual(['4', 1]);
  });

  it('routes the Qwen workflow directly through the UNET when no LoRA is requested', () => {
    const provider = createQwenProvider();

    const workflow = provider.createWorkflow({
      prompt: 'A cute apple',
      negativePrompt: 'text, watermark',
      width: 512,
      height: 512,
      steps: 12,
      cfgScale: 3.5
    });

    expect(workflow['15']).toBeUndefined();
    expect(workflow['3'].inputs.model).toEqual(['10', 0]);
    expect(workflow['13'].inputs.width).toBe(512);
    expect(workflow['13'].inputs.height).toBe(512);
    expect(workflow['27'].inputs.text).toBe('A cute apple');
    expect(workflow['34'].inputs.text).toBe('text, watermark');
  });

  it('adds a Qwen model-only LoRA loader when a LoRA is requested', () => {
    const provider = createQwenProvider();

    const workflow = provider.createWorkflow({
      prompt: 'A cute apple',
      width: 512,
      height: 512,
      lora: 'Qwen-Image-Lightning-8steps-V1.0.safetensors'
    });

    expect(workflow['15']).toEqual({
      class_type: 'LoraLoaderModelOnly',
      inputs: {
        model: ['10', 0],
        lora_name: 'Qwen-Image-Lightning-8steps-V1.0.safetensors',
        strength_model: 1
      }
    });
    expect(workflow['3'].inputs.model).toEqual(['15', 0]);
    expect(workflow['27'].inputs.clip).toEqual(['20', 0]);
    expect(workflow['34'].inputs.clip).toEqual(['20', 0]);
  });

  it('falls back to LoraLoader object metadata when /loras is unavailable', async () => {
    const provider = createProvider() as ComfyUIProvider;
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          LoraLoader: {
            input: {
              required: {
                lora_name: [[
                  'animals-bulk_20260327_143605.safetensors',
                  'animals-smoke_20260327_141650.safetensors'
                ]]
              }
            }
          }
        })
      } as Response);

    const loras = await provider.getAvailableLoras();

    expect(loras).toEqual([
      'animals-bulk_20260327_143605.safetensors',
      'animals-smoke_20260327_141650.safetensors'
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:8188/object_info/LoraLoader',
      expect.any(Object)
    );
  });

  it('accepts successful prompt submissions with empty node_errors', async () => {
    const provider = createProvider();

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        prompt_id: 'prompt-123',
        number: 1,
        node_errors: {}
      })
    } as Response);

    await expect(
      provider.submitWorkflow({
        '3': {
          inputs: {},
          class_type: 'KSampler'
        }
      })
    ).resolves.toBe('prompt-123');
  });
});
