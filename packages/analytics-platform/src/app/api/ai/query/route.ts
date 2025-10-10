import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(req: NextRequest) {
  try {
    const { question, schema } = await req.json()

    if (!question || !schema) {
      return NextResponse.json(
        { error: 'Missing required fields: question and schema' },
        { status: 400 }
      )
    }

    const systemPrompt = `You are an analytics assistant. Generate query specifications based on user questions.

AVAILABLE SCHEMA:
Measures: ${schema.measures.join(', ')}
Dimensions: ${schema.dimensions.join(', ')}
Current date: ${schema.currentDate}

Respond with valid JSON only following this structure:
{
  "naturalLanguageAnswer": "string - conversational insight about what you'll show",
  "querySpec": {
    "measure": "string - one of available measures",
    "dimensions": ["array of dimension strings"],
    "filters": [{
      "field": "string",
      "operator": "eq|between|gt|lt|contains",
      "value": "any"
    }],
    "sort": {"field": "string", "order": "asc|desc"},
    "limit": number
  },
  "visualizationSpec": {
    "type": "bar|line|pie|table|metric",
    "xField": "dimension field name",
    "yField": "measure field name",
    "orientation": "horizontal|vertical",
    "color": "#6366f1"
  },
  "followUpSuggestions": ["2-3 related questions user might ask"]
}

RULES:
- Only use measures/dimensions from the schema
- Parse dates naturally: "last month" = previous calendar month, "this week" = current week, etc.
- Choose chart types: temporal data = line, categories = bar, single value = metric, parts of whole = pie
- For top/bottom queries, use sort + limit
- Keep naturalLanguageAnswer concise (1-2 sentences)
- Be specific in followUpSuggestions
- Always include at least one dimension unless asking for a single metric
- For time-based queries, use appropriate temporal dimensions like 'day', 'hour', 'month'`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: question
        }
      ]
    })

    // Extract text from response
    const responseText = message.content.find(block => block.type === 'text')?.text || ''
    
    // Parse JSON from response
    let response
    try {
      // Try to extract JSON from code blocks or direct JSON
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                       responseText.match(/```\n([\s\S]*?)\n```/) ||
                       [null, responseText]
      
      response = JSON.parse(jsonMatch[1] || responseText)
    } catch (parseError) {
      console.error('Failed to parse LLM response:', responseText)
      throw new Error('Invalid JSON response from AI')
    }

    // Validate response structure
    if (!response.naturalLanguageAnswer || !response.querySpec || !response.visualizationSpec) {
      throw new Error('Invalid response structure from AI')
    }

    // Ensure querySpec has required fields
    if (!response.querySpec.measure) {
      throw new Error('Query spec must include a measure')
    }

    // Ensure followUpSuggestions is an array
    if (!Array.isArray(response.followUpSuggestions)) {
      response.followUpSuggestions = []
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('AI query error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process query' },
      { status: 500 }
    )
  }
}

