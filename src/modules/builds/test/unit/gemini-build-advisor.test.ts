import { ApiError } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../../shared/errors/app-error.js';
import { GeminiBuildAdvisor, type GenerateContentClient } from '../../gemini-build-advisor.js';

const request = {
  systemInstruction: 'Instruções',
  prompt: 'Contexto',
  responseSchema: { type: 'object' },
};

function createAdvisor(generateContent: GenerateContentClient['generateContent']) {
  return new GeminiBuildAdvisor({
    apiKey: 'chave',
    model: 'modelo-teste',
    client: { generateContent },
  });
}

async function errorFrom(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    return error as AppError;
  }
  throw new Error('Era esperado que a chamada falhasse.');
}

describe('GeminiBuildAdvisor', () => {
  it('envia o modelo, as instruções e o schema JSON', async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: '{"ok":true}' });

    await createAdvisor(generateContent).generate(request);

    expect(generateContent).toHaveBeenCalledWith({
      model: 'modelo-teste',
      contents: 'Contexto',
      config: expect.objectContaining({
        systemInstruction: 'Instruções',
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' },
      }),
    });
  });

  it('devolve o JSON da resposta', async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: '{"items":[]}' });

    expect(await createAdvisor(generateContent).generate(request)).toEqual({ items: [] });
  });

  it('devolve o texto cru quando a resposta não é JSON', async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: 'texto livre' });

    expect(await createAdvisor(generateContent).generate(request)).toBe('texto livre');
  });

  it('converte limite de uso (429) em 503 AI_RATE_LIMITED', async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValue(new ApiError({ message: 'quota', status: 429 }));

    const error = await errorFrom(createAdvisor(generateContent).generate(request));

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('AI_RATE_LIMITED');
  });

  it('converte alta demanda (503) em 503 AI_UNAVAILABLE', async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValue(new ApiError({ message: 'high demand', status: 503 }));

    const error = await errorFrom(createAdvisor(generateContent).generate(request));

    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('AI_UNAVAILABLE');
  });

  it('converte outras falhas em 502 AI_ERROR', async () => {
    const generateContent = vi.fn().mockRejectedValue(new Error('rede'));

    const error = await errorFrom(createAdvisor(generateContent).generate(request));

    expect(error.statusCode).toBe(502);
    expect(error.code).toBe('AI_ERROR');
  });
});
