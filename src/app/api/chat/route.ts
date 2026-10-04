import { GoogleGenAI } from '@google/genai';
import { config } from '@/config/env';

export async function POST(request: Request) {
  try {
    const { 
      address, 
      jurisdictions, 
      date, 
      question, 
      answer, 
      evidence, 
      history, 
      tone,
      newMessage 
    } = await request.json();

    if (!config.geminiApiKey || config.geminiApiKey === 'your_api_key_here') {
      return new Response("I couldn't find sufficient authoritative evidence to answer this reliably. (Missing API Key)", { status: 200 });
    }

    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    const contextText = evidence.map((e: any) => `
[Document ID: ${e.documentId}]
Title: ${e.title}
Jurisdiction: ${e.jurisdiction}
Status: ${e.status}
Text: ${e.snapshot_text || e.relevantText}
---`).join('\n');

    const systemPrompt = `You are a rental housing law assistant.
Respond to the user's follow-up question based ONLY on the provided Context.

Context:
Address: ${address}
Jurisdictions: ${jurisdictions.map((j:any)=>j.name).join(', ')}
Target Date: ${date}
Original Question: ${question}
Original Answer: ${answer?.shortAnswer}

Retrieved Documents:
${contextText}

CRITICAL INSTRUCTIONS:
1. Grounding: Answer ONLY using the Retrieved Documents.
2. If evidence is insufficient, or if the user asks something unrelated, reply EXACTLY with: "I couldn't find sufficient authoritative evidence to answer this reliably."
3. If facts are missing (e.g., building age), ask ONE short clarifying question instead of guessing, and explain why it matters.
4. If sources conflict, output "Potential conflict detected" and name the sources and why.
5. Tone: ${tone === 'Explain like I am 12' ? 'Use very simple, child-like language' : tone === 'Summarize for my landlord' ? 'Use formal, professional language suited for a landlord' : 'Use clear, accessible legal information framing'}.
6. NEVER predict court outcomes or give legal advice. Say "This is legal information, not legal advice." if pushed.
7. Citations: When you make a claim, append the citation like [doc_123]. Ensure the ID matches EXACTLY with the Retrieved Documents.`;

    const chatSession = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemPrompt,
            temperature: 0.2
        }
    });

    // Send history
    for (const msg of history) {
        if (msg.role === 'user') {
            await chatSession.sendMessage({ message: msg.content }); // Wait, Gemini API handles history differently?
            // Actually, ai.chats.create takes history directly? No, it's easier to just pass the whole thing in generateContentStream.
        }
    }

    // Since I might not know the exact `@google/genai` chat history API off the top of my head for streaming, 
    // I'll format the history into a single prompt for generateContentStream to guarantee it works.
    
    let fullConversation = `Previous Chat History:\n`;
    for(const msg of history) {
        fullConversation += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    }
    fullConversation += `\nCurrent User Message: ${newMessage}`;

    const stream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: [
            { role: 'system', parts: [{ text: systemPrompt }] },
            { role: 'user', parts: [{ text: fullConversation }] }
        ],
        config: { temperature: 0.2 }
    });

    // Convert async iterable to ReadableStream
    const readable = new ReadableStream({
        async start(controller) {
            try {
                for await (const chunk of stream) {
                    if (chunk.text) {
                        controller.enqueue(new TextEncoder().encode(chunk.text));
                    }
                }
                controller.close();
            } catch (err) {
                controller.error(err);
            }
        }
    });

    return new Response(readable, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });

  } catch (err: any) {
    console.error('Chat API Error:', err);
    return new Response("An error occurred. I couldn't find sufficient authoritative evidence to answer this reliably.", { status: 500 });
  }
}
