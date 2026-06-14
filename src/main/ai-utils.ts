import axios, { AxiosError } from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, '').replace(/\/v1$/, '');
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
}

function formatError(err: unknown, context: string): string {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    const data = err.response?.data;
    const detail = typeof data === 'object' ? JSON.stringify(data) : String(data || '');

    if (status === 401) return `${context}: Invalid API Key (401)`;
    if (status === 403) return `${context}: Forbidden - check API Key permissions (403)`;
    if (status === 429) return `${context}: Rate limited - try again later (429)`;
    if (status === 404) return `${context}: Endpoint not found (404) ${detail.slice(0, 200)}`;

    return `${context} (${status || 'network error'}) ${detail.slice(0, 300)}`;
  }
  return `${context}: ${err instanceof Error ? err.message : String(err)}`;
}

// ─── Fetch Models ────────────────────────────────────────────────────────────

export async function fetchOpenAICompatibleModels(apiKey: string, endpoint: string): Promise<string[]> {
  const base = normalizeEndpoint(endpoint);

  // Try /v1/models first (OpenAI standard)
  try {
    const res = await axios.get(`${base}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 15000
    });
    const models = res.data?.data || [];
    if (models.length > 0) return models.map((m: any) => m.id).sort();
  } catch {}

  // Fallback: try without /v1 prefix
  try {
    const res = await axios.get(`${base}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 15000
    });
    const models = res.data?.data || res.data?.models || [];
    if (Array.isArray(models)) {
      return models.map((m: any) => typeof m === 'string' ? m : m.id).sort();
    }
  } catch {}

  // Last resort: return empty, user can type manually
  return [];
}

// ─── Text Generation (Chat Completions) ──────────────────────────────────────

export async function generateTextWithAI(
  apiKey: string,
  endpoint: string,
  model: string,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const base = normalizeEndpoint(endpoint);
  const url = `${base}/v1/chat/completions`;

  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  try {
    const res = await axios.post(url, {
      model,
      messages,
      temperature: 0.8,
      max_tokens: 2000
    }, {
      headers: authHeaders(apiKey),
      timeout: 60000
    });

    return res.data.choices?.[0]?.message?.content || '';
  } catch (err) {
    throw new Error(formatError(err, 'Text generation failed'));
  }
}

// ─── Image Generation (DALL-E compatible) ────────────────────────────────────

export async function generateImageWithAI(
  apiKey: string,
  endpoint: string,
  model: string,
  prompt: string,
  options?: { size?: string; quality?: string; n?: number }
): Promise<string[]> {
  const base = normalizeEndpoint(endpoint);
  const url = `${base}/v1/images/generations`;

  try {
    const body: any = {
      model: model || 'dall-e-3',
      prompt,
      n: options?.n || 1,
      size: options?.size || '1024x1024'
    };
    // quality and response_format not supported by all proxies (e.g. LiteLLM)
    // Only add quality for known OpenAI endpoints
    if (base.includes('api.openai.com')) {
      body.quality = options?.quality || 'standard';
      body.response_format = 'url';
    }

    const res = await axios.post(url, body, {
      headers: authHeaders(apiKey),
      timeout: 120000
    });

    // Normalize result: some services return URL, some return base64
    return (res.data?.data || []).map((item: any) => {
      if (item.url) return item.url;
      if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
      if (typeof item === 'string') {
        // Might be a URL or raw base64
        if (item.startsWith('http') || item.startsWith('data:')) return item;
        return `data:image/png;base64,${item}`;
      }
      return '';
    }).filter(Boolean);
  } catch (err) {
    throw new Error(formatError(err, 'Image generation failed'));
  }
}

// ─── Image Edit (DALL-E compatible) ──────────────────────────────────────────

export async function editImageWithAI(
  apiKey: string,
  endpoint: string,
  model: string,
  prompt: string,
  imagePath: string,
  maskPath?: string,
  options?: { size?: string }
): Promise<string[]> {
  // Fallback: use text-to-image endpoint since /v1/images/edits is not widely supported
  // The reference image is used as context for the prompt only
  const enhancedPrompt = `Based on a reference image, ${prompt}. Generate a new image inspired by this description.`;
  return generateImageWithAI(apiKey, endpoint, model, enhancedPrompt, { size: options?.size });
}

// ─── ElevenLabs: List Voices ─────────────────────────────────────────────────

export async function listElevenLabsVoices(apiKey: string): Promise<{ voiceId: string; name: string; category: string }[]> {
  try {
    const res = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
      timeout: 15000
    });
    return (res.data?.voices || []).map((v: any) => ({
      voiceId: v.voice_id,
      name: v.name,
      category: v.category || 'premade'
    }));
  } catch (err) {
    throw new Error(formatError(err, 'Failed to fetch voices'));
  }
}

// ─── ElevenLabs: Clone Voice (upload samples) ───────────────────────────────

export async function cloneVoiceWithElevenLabs(
  apiKey: string,
  name: string,
  description: string,
  audioFilePaths: string[]
): Promise<{ voiceId: string; name: string }> {
  const form = new FormData();
  form.append('name', name);
  if (description) form.append('description', description);

  for (const filePath of audioFilePaths) {
    const buffer = fs.readFileSync(filePath);
    const ext = filePath.split('.').pop() || 'mp3';
    form.append('files', buffer, { filename: `sample.${ext}`, contentType: `audio/${ext}` });
  }

  try {
    const res = await axios.post('https://api.elevenlabs.io/v1/voices/add', form, {
      headers: {
        'xi-api-key': apiKey,
        ...form.getHeaders()
      },
      timeout: 120000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    return { voiceId: res.data.voice_id, name: res.data.name };
  } catch (err) {
    throw new Error(formatError(err, 'Voice clone failed'));
  }
}

// ─── ElevenLabs TTS ──────────────────────────────────────────────────────────

export async function synthesizeWithElevenLabs(
  apiKey: string,
  voiceId: string,
  text: string,
  outputPath: string,
  modelId?: string
): Promise<string> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  try {
    const res = await axios.post(url, {
      text,
      model_id: modelId || 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    }, {
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer',
      timeout: 60000,
      validateStatus: () => true // don't throw on 4xx
    });

    // Check if response is actually audio or an error JSON
    if (res.status >= 400) {
      const errorText = Buffer.from(res.data).toString('utf-8');
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(`Voice synthesis failed (${res.status}): ${errorJson.detail?.message || errorJson.detail || errorText.slice(0, 200)}`);
      } catch (parseErr: any) {
        if (parseErr.message.startsWith('Voice synthesis failed')) throw parseErr;
        throw new Error(`Voice synthesis failed (${res.status}): ${errorText.slice(0, 200)}`);
      }
    }

    fs.writeFileSync(outputPath, Buffer.from(res.data));
    return outputPath;
  } catch (err: any) {
    if (err.message.startsWith('Voice synthesis failed')) throw err;
    throw new Error(formatError(err, 'Voice synthesis failed'));
  }
}

// ─── Xiaomi / OpenAI-compatible TTS ─────────────────────────────────────────

export async function synthesizeWithXiaomiTTS(
  apiKey: string,
  endpoint: string,
  text: string,
  voice: string,
  outputPath: string,
  options?: { speed?: number; format?: string }
): Promise<string> {
  const base = normalizeEndpoint(endpoint);
  // Try OpenAI-compatible /v1/audio/speech endpoint
  const url = `${base}/v1/audio/speech`;

  try {
    const res = await axios.post(url, {
      model: 'tts-1',
      input: text,
      voice: voice || 'alloy',
      speed: options?.speed || 1.0,
      response_format: options?.format || 'mp3'
    }, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer',
      timeout: 60000,
      validateStatus: () => true
    });

    if (res.status >= 400) {
      const errorText = Buffer.from(res.data).toString('utf-8');
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(`TTS failed (${res.status}): ${JSON.stringify(errorJson).slice(0, 300)}`);
      } catch (parseErr: any) {
        if (parseErr.message.startsWith('TTS failed')) throw parseErr;
        throw new Error(`TTS failed (${res.status}): ${errorText.slice(0, 300)}`);
      }
    }

    fs.writeFileSync(outputPath, Buffer.from(res.data));
    return outputPath;
  } catch (err: any) {
    if (err.message.startsWith('TTS failed')) throw err;
    throw new Error(formatError(err, 'TTS failed'));
  }
}

export async function listXiaomiVoices(apiKey: string, endpoint: string): Promise<{ voiceId: string; name: string; category: string }[]> {
  const base = normalizeEndpoint(endpoint);
  // Try to fetch voices from /v1/audio/voices
  try {
    const res = await axios.get(`${base}/v1/audio/voices`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 10000,
      validateStatus: () => true
    });
    if (res.status < 400 && res.data?.voices) {
      return res.data.voices.map((v: any) => ({
        voiceId: v.voice_id || v.id || v.name,
        name: v.name || v.voice_id || v.id,
        category: v.category || 'custom'
      }));
    }
  } catch {}

  // Fallback: return common presets
  return [
    { voiceId: 'alloy', name: 'Alloy', category: 'preset' },
    { voiceId: 'echo', name: 'Echo', category: 'preset' },
    { voiceId: 'fable', name: 'Fable', category: 'preset' },
    { voiceId: 'onyx', name: 'Onyx', category: 'preset' },
    { voiceId: 'nova', name: 'Nova', category: 'preset' },
    { voiceId: 'shimmer', name: 'Shimmer', category: 'preset' }
  ];
}

export async function cloneVoiceWithXiaomi(
  apiKey: string,
  endpoint: string,
  name: string,
  audioFilePaths: string[]
): Promise<{ voiceId: string; name: string }> {
  const base = normalizeEndpoint(endpoint);
  const url = `${base}/v1/audio/voices`;

  const form = new FormData();
  form.append('name', name);
  for (const filePath of audioFilePaths) {
    const buffer = fs.readFileSync(filePath);
    const ext = filePath.split('.').pop() || 'mp3';
    form.append('files', buffer, { filename: `sample.${ext}`, contentType: `audio/${ext}` });
  }

  try {
    const res = await axios.post(url, form, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...form.getHeaders()
      },
      timeout: 120000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    return { voiceId: res.data.voice_id || res.data.id || name, name: res.data.name || name };
  } catch (err: any) {
    throw new Error(formatError(err, 'Voice clone failed'));
  }
}
