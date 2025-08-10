
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY environment variable not set. Oracle feature will be disabled.");
}

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const SYSTEM_INSTRUCTION = `You are a wise and ancient Oracle in the world of Ashfall, a volcanic, desolate landscape.
The player is a hero wielding a powerful fire staff called 'The Firagle' against earthen creatures known as Rock Monsters.
Answer the player's questions about the lore of this world, the staff, the creatures, or the land itself.
Your tone should be epic, mysterious, and slightly archaic.
Keep your answers concise, no more than 3-4 sentences.`;

export const askOracle = async (query: string): Promise<string> => {
  if (!ai) {
    throw new Error("The Oracle's connection to the aether is severed. (API key not configured)");
  }
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: { 
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
        topP: 0.9,
      }
    });
    
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("The Oracle is silent at this moment. The connection to the aether is weak.");
  }
};
