import OpenAI from "openai";

export interface AgentConfig {
  name: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt: string;
}

export interface AgentResponse {
  content: string;
  metadata: {
    agent: string;
    timestamp: string;
    tokensUsed?: number;
    model?: string;
  };
}

export class BaseAgent {
  protected openai: OpenAI;
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  protected async callOpenAI(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options?: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>
  ): Promise<AgentResponse> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model || "gpt-4o",
        messages: [
          {
            role: "system",
            content: this.config.systemPrompt,
          },
          ...messages,
        ],
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 2000,
        ...options,
      });

      const content = response.choices[0]?.message?.content || "";
      
      return {
        content,
        metadata: {
          agent: this.config.name,
          timestamp: new Date().toISOString(),
          tokensUsed: response.usage?.total_tokens,
          model: response.model,
        },
      };
    } catch (error) {
      console.error(`[${this.config.name}] OpenAI API error:`, error);
      throw new Error(`Agent ${this.config.name} failed: ${error}`);
    }
  }

  async process(input: string, context?: Record<string, any>): Promise<AgentResponse> {
    throw new Error("Process method must be implemented by subclass");
  }
}