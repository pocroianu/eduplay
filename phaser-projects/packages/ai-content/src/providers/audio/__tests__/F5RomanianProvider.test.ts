import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { F5RomanianProvider } from '../F5RomanianProvider';
import { ProviderTimeoutError, ProviderUnavailableError, ProviderValidationError } from '../../base/errors';

function wavBuffer(sampleRate = 24000, channels = 1, dataBytes = 48000): Buffer {
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * 2, 28);
  buffer.writeUInt16LE(channels * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  return buffer;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
}

describe('F5RomanianProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes from /voices and returns Romanian voice metadata', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      service: 'f5-romanian-tts',
      voices: [{ language: 'ro', voice: 'f5-ro-reference', description: 'F5 Romanian reference voice' }]
    }));

    const provider = new F5RomanianProvider({
      name: 'f5-romanian',
      baseUrl: 'http://localhost:5001',
      timeout: 120000,
      retries: 0,
      healthCheckInterval: 30000
    });

    await provider.init();
    try {
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:5001/voices', expect.objectContaining({
        method: 'GET'
      }));

      expect(provider.getSupportedLanguages()).toEqual(['ro']);
      await expect(provider.getVoices('ro')).resolves.toEqual([
        { id: 'f5-ro-reference', name: 'F5 Romanian reference voice', gender: 'neutral' }
      ]);
      await expect(provider.getVoices('en')).resolves.toEqual([]);
    } finally {
      await provider.shutdown();
    }
  });

  it('rejects unexpected service identities during initialization', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      service: 'piper-tts',
      voices: [{ language: 'ro', voice: 'ro_RO-mihai-medium', description: 'Romanian - Mihai - Medium quality' }]
    }));

    const provider = new F5RomanianProvider({
      name: 'f5-romanian',
      baseUrl: 'http://localhost:5001',
      timeout: 120000,
      retries: 0,
      healthCheckInterval: 30000
    });

    await expect(provider.init()).rejects.toMatchObject({
      name: ProviderUnavailableError.name,
      cause: expect.objectContaining({ message: expect.stringContaining('Unexpected service') })
    });
  });

  it('rejects voice discovery responses without a Romanian F5 voice', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      service: 'f5-romanian-tts',
      voices: [{ language: 'en', voice: 'en_US-lessac-medium', description: 'English voice' }]
    }));

    const provider = new F5RomanianProvider({
      name: 'f5-romanian',
      baseUrl: 'http://localhost:5001',
      timeout: 120000,
      retries: 0,
      healthCheckInterval: 30000
    });

    await expect(provider.init()).rejects.toMatchObject({
      name: ProviderUnavailableError.name,
      cause: expect.objectContaining({ message: expect.stringContaining('No Romanian F5 voice available') })
    });
  });

  it('rejects non-Romanian generation before making an HTTP request', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      service: 'f5-romanian-tts',
      voices: [{ language: 'ro', voice: 'f5-ro-reference', description: 'F5 Romanian reference voice' }]
    }));

    const provider = new F5RomanianProvider({
      name: 'f5-romanian',
      baseUrl: 'http://localhost:5001',
      timeout: 120000,
      retries: 0,
      healthCheckInterval: 30000
    });
    await provider.init();
    try {
      fetchMock.mockClear();

      await expect(provider.generate({ text: 'Hello', language: 'en' })).rejects.toBeInstanceOf(ProviderValidationError);
      await expect(provider.generate({ text: 'Bonjour', language: 'fr' } as any)).rejects.toBeInstanceOf(ProviderValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await provider.shutdown();
    }
  });

  it('rejects unsupported requested voices before synthesis', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      service: 'f5-romanian-tts',
      voices: [{ language: 'ro', voice: 'f5-ro-reference', description: 'F5 Romanian reference voice' }]
    }));

    const provider = new F5RomanianProvider({
      name: 'f5-romanian',
      baseUrl: 'http://localhost:5001',
      timeout: 120000,
      retries: 0,
      healthCheckInterval: 30000
    });
    await provider.init();
    try {
      fetchMock.mockClear();

      await expect(provider.generate({
        text: 'Salut',
        language: 'ro',
        voice: 'unknown-voice',
        format: 'wav'
      })).rejects.toBeInstanceOf(ProviderValidationError);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await provider.shutdown();
    }
  });

  it('posts Romanian synthesis requests and parses WAV metadata', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        service: 'f5-romanian-tts',
        voices: [{ language: 'ro', voice: 'f5-ro-reference', description: 'F5 Romanian reference voice' }]
      }))
      .mockResolvedValueOnce(new Response(wavBuffer(), { status: 200, headers: { 'Content-Type': 'audio/wav' } }));

    const provider = new F5RomanianProvider({
      name: 'f5-romanian',
      baseUrl: 'http://localhost:5001',
      timeout: 120000,
      retries: 0,
      healthCheckInterval: 30000
    });
    await provider.init();
    try {
      const result = await provider.generate({
        text: 'Care este un măr?',
        language: 'ro',
        speed: 1.1,
        voice: 'f5-ro-reference',
        format: 'wav'
      });

      expect(fetchMock).toHaveBeenLastCalledWith('http://localhost:5001/synthesize', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Care este un măr?',
          language: 'ro',
          voice: 'f5-ro-reference',
          speed: 1.1,
          output_format: 'wav'
        })
      }));
      expect(result.data.mimeType).toBe('audio/wav');
      expect(result.data.sampleRate).toBe(24000);
      expect(result.data.duration).toBe(1);
    } finally {
      await provider.shutdown();
    }
  });

  it('requests MP3 synthesis and uses non-WAV response metadata', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        service: 'f5-romanian-tts',
        voices: [{ language: 'ro', voice: 'f5-ro-reference', description: 'F5 Romanian reference voice' }]
      }))
      .mockResolvedValueOnce(new Response(Buffer.from([1, 2, 3]), {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'x-audio-duration': '1.5',
          'x-audio-sample-rate': '24000'
        }
      }));

    const provider = new F5RomanianProvider({
      name: 'f5-romanian',
      baseUrl: 'http://localhost:5001',
      timeout: 120000,
      retries: 0,
      healthCheckInterval: 30000
    });
    await provider.init();
    try {
      const result = await provider.generate({
        text: 'Care este un măr?',
        language: 'ro',
        speed: 1,
        voice: 'f5-ro-reference',
        format: 'mp3'
      });

      expect(fetchMock).toHaveBeenLastCalledWith('http://localhost:5001/synthesize', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Care este un măr?',
          language: 'ro',
          voice: 'f5-ro-reference',
          speed: 1,
          output_format: 'mp3'
        })
      }));
      expect(result.data.mimeType).toBe('audio/mpeg');
      expect(result.data.duration).toBe(1.5);
      expect(result.data.sampleRate).toBe(24000);
    } finally {
      await provider.shutdown();
    }
  });

  it('uses the discovered server voice when the configured default is unavailable', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        service: 'f5-romanian-tts',
        voices: [{ language: 'ro', voice: 'server-ro-voice', description: 'Server Romanian voice' }]
      }))
      .mockResolvedValueOnce(new Response(wavBuffer(), { status: 200, headers: { 'Content-Type': 'audio/wav' } }));

    const provider = new F5RomanianProvider({
      name: 'f5-romanian',
      baseUrl: 'http://localhost:5001',
      timeout: 120000,
      retries: 0,
      healthCheckInterval: 30000
    });
    await provider.init();
    try {
      await provider.generate({ text: 'Salut', language: 'ro', format: 'wav' });

      expect(fetchMock).toHaveBeenLastCalledWith('http://localhost:5001/synthesize', expect.objectContaining({
        body: JSON.stringify({
          text: 'Salut',
          language: 'ro',
          voice: 'server-ro-voice',
          speed: 1,
          output_format: 'wav'
        })
      }));
    } finally {
      await provider.shutdown();
    }
  });

  it('preserves synthesis timeout errors', async () => {
    const abortError = new Error('The operation was aborted.');
    abortError.name = 'AbortError';

    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        service: 'f5-romanian-tts',
        voices: [{ language: 'ro', voice: 'server-ro-voice', description: 'Server Romanian voice' }]
      }))
      .mockRejectedValueOnce(abortError);

    const provider = new F5RomanianProvider({
      name: 'f5-romanian',
      baseUrl: 'http://localhost:5001',
      timeout: 120000,
      retries: 0,
      healthCheckInterval: 30000
    });
    await provider.init();
    try {
      await expect(provider.generate({ text: 'Salut', language: 'ro' })).rejects.toBeInstanceOf(ProviderTimeoutError);
    } finally {
      await provider.shutdown();
    }
  });

  it('surfaces synthesis server errors as provider unavailable errors', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        service: 'f5-romanian-tts',
        voices: [{ language: 'ro', voice: 'f5-ro-reference', description: 'F5 Romanian reference voice' }]
      }))
      .mockResolvedValueOnce(jsonResponse({ error: 'F5 inference failed' }, { status: 500 }));

    const provider = new F5RomanianProvider({
      name: 'f5-romanian',
      baseUrl: 'http://localhost:5001',
      timeout: 120000,
      retries: 0,
      healthCheckInterval: 30000
    });
    await provider.init();
    try {
      await expect(provider.generate({ text: 'Salut', language: 'ro' })).rejects.toMatchObject({
        name: ProviderUnavailableError.name,
        cause: expect.objectContaining({ message: expect.stringContaining('F5 inference failed') })
      });
    } finally {
      await provider.shutdown();
    }
  });
});
