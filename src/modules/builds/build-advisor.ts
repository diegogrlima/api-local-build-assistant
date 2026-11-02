export type AdvisorRequest = {
  systemInstruction: string;
  prompt: string;
  // JSON Schema que a IA deve seguir na resposta.
  responseSchema: Record<string, unknown>;
};

// Modelo de IA que gera a recomendação. Devolve o JSON cru: quem chama é responsável por validar.
export interface BuildAdvisor {
  generate(request: AdvisorRequest): Promise<unknown>;
}
