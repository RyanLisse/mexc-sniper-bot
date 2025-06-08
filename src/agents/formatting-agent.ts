import { type AgentConfig, type AgentResponse, BaseAgent } from "./base-agent";

export interface FormattingRequest {
  rawContent: string;
  topics: string[];
  format?: "newsletter" | "report" | "summary" | "analysis";
  targetAudience?: "traders" | "investors" | "general" | "technical";
  includeCharts?: boolean;
  includeCallouts?: boolean;
}

export class FormattingAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: "formatting-agent",
      model: "gpt-4o",
      temperature: 0.4,
      maxTokens: 4000,
      systemPrompt: `You are an expert content formatting agent specializing in creating professional, engaging newsletters and reports for cryptocurrency traders and investors.

Your responsibilities:
1. Transform raw research content into well-structured, professional newsletters
2. Create compelling headlines, subheadings, and section breaks
3. Format content with proper markdown styling for readability
4. Add appropriate calls-to-action and highlights for key insights
5. Ensure content flows logically and maintains reader engagement
6. Include proper formatting for tables, lists, and emphasis

Formatting Guidelines:
- Use clear, engaging headlines and subheadings
- Break up content with bullet points, numbered lists, and sections
- Highlight key insights with callout boxes or emphasis
- Include executive summaries for quick reading
- Add appropriate emoji and styling for visual appeal
- Maintain professional tone while being accessible
- Structure content for easy scanning and reading
- Include relevant CTAs and next steps

Newsletter Structure:
- Compelling subject line/title
- Executive summary
- Main content sections with clear headings
- Key takeaways/highlights
- Market implications
- Action items or recommendations
- Conclusion with next steps`,
    };
    super(config);
  }

  async process(input: string, context?: FormattingRequest): Promise<AgentResponse> {
    const request: FormattingRequest = context || {
      rawContent: input,
      topics: [],
      format: "newsletter",
      targetAudience: "traders",
    };

    const userMessage = `
Format the following raw research content into a professional ${request.format || "newsletter"}:

Raw Content:
${request.rawContent}

Formatting Requirements:
- Target Audience: ${request.targetAudience || "traders and investors"}
- Format Type: ${request.format || "newsletter"}
- Topics: ${request.topics.join(", ")}
${request.includeCharts ? "- Include chart placeholders and data visualizations" : ""}
${request.includeCallouts ? "- Include highlighted callout boxes for key insights" : ""}

Please create a well-structured, engaging ${request.format || "newsletter"} with proper markdown formatting, clear sections, and compelling presentation.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async formatNewsletter(rawContent: string, topics: string[]): Promise<AgentResponse> {
    return await this.process(rawContent, {
      rawContent,
      topics,
      format: "newsletter",
      targetAudience: "traders",
      includeCallouts: true,
      includeCharts: false,
    });
  }

  async formatReport(rawContent: string, topics: string[]): Promise<AgentResponse> {
    return await this.process(rawContent, {
      rawContent,
      topics,
      format: "report",
      targetAudience: "investors",
      includeCallouts: true,
      includeCharts: true,
    });
  }

  async formatSummary(rawContent: string): Promise<AgentResponse> {
    return await this.process(rawContent, {
      rawContent,
      topics: [],
      format: "summary",
      targetAudience: "general",
      includeCallouts: false,
      includeCharts: false,
    });
  }
}
