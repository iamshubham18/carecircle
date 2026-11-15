declare module '@google/genai' {
  export interface Part {
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    };
  }

  export interface Content {
    role?: string;
    parts: Part[];
  }

  export interface GenerateContentParams {
    model: string;
    contents: string | Part[] | Content[];
    config?: {
      temperature?: number;
      responseMimeType?: string;
      thinkingConfig?: {
        thinkingBudget?: number;
      };
    };
  }

  export interface GenerateContentResponse {
    text?: string | (() => string);
  }

  export class GoogleGenAI {
    constructor(options?: { apiKey?: string });
    models: {
      generateContent(params: GenerateContentParams): Promise<GenerateContentResponse>;
    };
  }
}
