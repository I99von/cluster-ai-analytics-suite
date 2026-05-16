import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const summarizeBusinessGoals = async (goals: string) => {
  const prompt = `
    Como científico de datos senior, resume los siguientes objetivos de negocio y establece el enfoque analítico 
    necesario para un proyecto de clustering:
    
    "${goals}"
    
    Genera un resumen técnico y estratégico que incluya:
    1. Objetivo Analítico Principal.
    2. KPI's clave sugeridos.
    3. Valor esperado para el negocio.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Error al obtener respuesta de la IA.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error al generar el resumen de objetivos.";
  }
};

export const interpretClusters = async (
  businessGoals: string,
  clusterData: any[],
  variableStats: any
) => {
  const prompt = `
    Analiza la siguiente segmentación de datos y genera nombres descriptivos, perfiles detallados y una visión estratégica central ("Core del Negocio").
    
    Contexto de negocio: ${businessGoals}
    
    Estadísticas por cluster (Centroides y Medias):
    ${JSON.stringify(clusterData, null, 2)}
    
    Responde en formato JSON estrictamente:
    {
      "businessCore": "Un resumen ejecutivo de alto nivel sobre la naturaleza del negocio y su ventaja competitiva basada en los datos.",
      "segments": [
        { "id": 0, "name": "...", "description": "...", "strategy": "..." },
        ...
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return { businessCore: "Error al generar interpretación.", segments: [] };
  }
};
