import { describe, expect, it } from 'vitest';
import { parseLanguages, resolveImageModel, validateLanguagesForAudioProvider } from '../generate';

describe('resolveImageModel', () => {
  it('defaults to base when no LoRA settings are provided', () => {
    expect(resolveImageModel({})).toEqual({
      imageModel: 'base',
      loraModel: undefined
    });
  });

  it('preserves backward compatibility by inferring lora mode from --lora', () => {
    expect(resolveImageModel({ lora: 'animals-bulk_20260327_143605.safetensors' })).toEqual({
      imageModel: 'lora',
      loraModel: 'animals-bulk_20260327_143605.safetensors'
    });
  });

  it('allows explicitly forcing the base model even when a LoRA is supplied', () => {
    expect(resolveImageModel({
      imageModel: 'base',
      lora: 'animals-bulk_20260327_143605.safetensors'
    })).toEqual({
      imageModel: 'base',
      loraModel: undefined
    });
  });

  it('requires a LoRA name when lora mode is selected explicitly', () => {
    expect(() => resolveImageModel({ imageModel: 'lora' })).toThrow(
      'Image model "lora" requires --lora <model>.'
    );
  });

  it('rejects unsupported image model values', () => {
    expect(() => resolveImageModel({ imageModel: 'custom' })).toThrow(
      "Invalid image model: custom. Must be 'base' or 'lora'."
    );
  });
});

describe('parseLanguages', () => {
  it('trims comma-separated languages and removes empty entries', () => {
    expect(parseLanguages(' en, ro , ,fr ')).toEqual(['en', 'ro', 'fr']);
  });

  it('rejects an empty language list', () => {
    expect(() => parseLanguages(' , , ')).toThrow(
      'At least one language must be specified. Use --languages en,ro or --languages ro.'
    );
  });
});

describe('validateLanguagesForAudioProvider', () => {
  it('allows F5 Romanian generation for Romanian only', () => {
    expect(() => validateLanguagesForAudioProvider('f5-romanian', ['ro'])).not.toThrow();
  });

  it('rejects F5 Romanian generation when English is requested', () => {
    expect(() => validateLanguagesForAudioProvider('f5-romanian', ['en', 'ro'])).toThrow(
      'F5 Romanian TTS only supports Romanian audio. Use --languages ro or keep Piper for: en'
    );
  });

  it('does not restrict Piper languages', () => {
    expect(() => validateLanguagesForAudioProvider('piper', ['en', 'ro'])).not.toThrow();
  });
});
