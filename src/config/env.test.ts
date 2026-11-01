import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('aplica valores padrão', () => {
    expect(loadEnv({})).toMatchObject({ PORT: 3333, NODE_ENV: 'development' });
  });

  it('converte PORT para número', () => {
    expect(loadEnv({ PORT: '4000' }).PORT).toBe(4000);
  });

  it('rejeita valores inválidos', () => {
    expect(() => loadEnv({ PORT: 'abc' })).toThrow(/inválidas/);
  });
});
