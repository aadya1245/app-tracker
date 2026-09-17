import { z } from 'zod';
import { systemPrompt, toolDefinitions, type Model, type Message, type ModelReply } from './engine.js';

const responseSchema = z.object({
  content: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), text: z.string() }),
    z.object({ type: z.literal('tool_use'), id: z.string(), name: z.string(), input: z.record(z.unknown()) })
  ])).max(20),
  usage: z.object({ input_tokens: z.number().nonnegative(), output_tokens: z.number().nonnegative() })
});

export class AnthropicModel implements Model {
  constructor(private key: string, private model: string, private transport: typeof fetch = fetch) {}
  async respond(messages: Message[], signal: AbortSignal): Promise<ModelReply> {
    const response = await this.transport('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-api-key': this.key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: this.model, max_tokens: 3500, system: systemPrompt, tools: toolDefinitions, messages })
    });
    // Never expose upstream bodies: they may contain request content or provider internals.
    if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}. Check configuration or retry later.`);
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error('AI provider returned an unsupported response');
    return { content: parsed.data.content, inputTokens: parsed.data.usage.input_tokens, outputTokens: parsed.data.usage.output_tokens };
  }
}
