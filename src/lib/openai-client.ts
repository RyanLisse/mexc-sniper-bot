/**
 * OpenAI Client Configuration
 * 
 * Provides OpenAI client instance for embedding generation and AI services
 */

import OpenAI from 'openai';

// Initialize OpenAI client if API key is available
let openai: OpenAI | null = null;

try {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (apiKey && apiKey.trim() !== '') {
    openai = new OpenAI({
      apiKey: apiKey,
    });
  } else {
    console.debug('OpenAI API key not found - embeddings will use fallback method');
  }
} catch (error) {
  console.warn('Failed to initialize OpenAI client:', error);
  openai = null;
}

export { openai };

// Default export for compatibility
export default openai;

// Helper types for OpenAI operations
export interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
    object: string;
  }>;
  model: string;
  object: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Utility functions for common operations
export async function generateEmbedding(text: string, model = 'text-embedding-3-small'): Promise<number[] | null> {
  if (!openai) {
    return null;
  }

  try {
    const response = await openai.embeddings.create({
      model,
      input: text,
    });

    return response.data[0]?.embedding || null;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    return null;
  }
}

export async function generateChatCompletion(
  messages: Array<{ role: string; content: string }>,
  model = 'gpt-3.5-turbo'
): Promise<string | null> {
  if (!openai) {
    return null;
  }

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('Failed to generate chat completion:', error);
    return null;
  }
}

// Health check function
export async function checkOpenAIHealth(): Promise<boolean> {
  if (!openai) {
    return false;
  }

  try {
    // Test with a simple embedding request
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: 'test',
    });

    return response.data.length > 0;
  } catch (error) {
    console.error('OpenAI health check failed:', error);
    return false;
  }
}