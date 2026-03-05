import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function generateNarrative({
  startLabel,
  endLabel,
  pathLabels,
  category,
}: {
  startLabel: string
  endLabel: string
  pathLabels: string[]
  category: string
}): Promise<string> {
  const pathString = pathLabels.join(' → ')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [
      {
        role: 'user',
        content: `Write a 2-3 sentence "RabbitHole" narrative that explains the connection from "${startLabel}" to "${endLabel}" through this path: ${pathString}.

Category: ${category}

The narrative should be engaging and explain WHY each connection makes sense, like a curious fact trail. Be concise and enthusiastic. No bullet points, just flowing prose.`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') return ''
  return content.text
}
