import { ApiError, GoogleGenAI } from '@google/genai';
import { AppError } from '../../shared/errors/app-error.js';
import type { AdvisorRequest, BuildAdvisor } from './build-advisor.js';

const TIMEOUT_MS = 60_000;
const TEMPERATURE = 0.4;

// Subconjunto do cliente do SDK usado aqui; permite injetar um fake nos testes.
export type GenerateContentClient = Pick<GoogleGenAI['models'], 'generateContent'>;

type Options = {
  apiKey: string;
  model: string;
  client?: GenerateContentClient;
};

export class GeminiBuildAdvisor implements BuildAdvisor {
  private readonly client: GenerateContentClient;
  private readonly model: string;

  constructor({ apiKey, model, client }: Options) {
    this.client = client ?? new GoogleGenAI({ apiKey }).models;
    this.model = model;
  }

  async generate({ systemInstruction, prompt, responseSchema }: AdvisorRequest): Promise<unknown> {
    let text: string | undefined;

    try {
      const response = await this.client.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseJsonSchema: responseSchema,
          temperature: TEMPERATURE,
          httpOptions: { timeout: TIMEOUT_MS },
        },
      });
      text = response.text;
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        throw new AppError(
          'O limite de uso da IA foi atingido. Tente novamente em alguns instantes.',
          503,
          'AI_RATE_LIMITED',
          { cause: error },
        );
      }

      // No free tier, o Gemini responde 503 em picos de demanda: é temporário.
      if (error instanceof ApiError && error.status >= 500) {
        throw new AppError(
          'A IA está temporariamente indisponível. Tente novamente em alguns instantes.',
          503,
          'AI_UNAVAILABLE',
          { cause: error },
        );
      }

      throw new AppError('Não foi possível consultar a IA no momento.', 502, 'AI_ERROR', {
        cause: error,
      });
    }

    // JSON inválido segue adiante como texto: o validador o rejeita e a chamada pode ser repetida.
    try {
      return JSON.parse(text ?? '');
    } catch {
      return text;
    }
  }
}
