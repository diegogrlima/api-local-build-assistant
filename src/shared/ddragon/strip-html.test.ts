import { describe, expect, it } from 'vitest';
import { stripHtml } from './strip-html.js';

describe('stripHtml', () => {
  it('remove tags e converte <br> em quebra de linha', () => {
    const html = '<mainText><stats><attention>75</attention> de Dano<br>25% de Crítico</stats>';

    expect(stripHtml(html)).toBe('75 de Dano\n25% de Crítico');
  });

  it('junta quebras de linha repetidas e remove espaços nas pontas', () => {
    expect(stripHtml(' Golpeia à frente. <br /><br /> Arremessa ao ar. ')).toBe(
      'Golpeia à frente.\nArremessa ao ar.',
    );
  });
});
