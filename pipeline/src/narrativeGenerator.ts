import OpenAI from 'openai'

const client = new OpenAI()

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

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `Write a 2-3 sentence "RabbitHole" narrative that explains the connection from "${startLabel}" to "${endLabel}" through this path: ${pathString}.

Category: ${category}

The narrative should be engaging and explain WHY each connection makes sense, like a curious fact trail. Be concise and enthusiastic. No bullet points, just flowing prose.`,
      },
    ],
  })

  return response.choices[0]?.message?.content ?? ''
}
