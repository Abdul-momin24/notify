import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: 'AIzaSyDCV74Ius71fdKhB6_YiXeUGCII8ak_3Wg' });
const app = express();
app.use(cors()); // Allow requests from your extension
app.use(express.json());

app.post('/gemini-action', async (req, res) => {
  const { context, note, url } = req.body;
  const prompt = `Context: ${context}
Note: ${note}
URL: ${url}
Generate a single, concise, one-line action item (max 1 sentence) for the user, in this format:
Action: <one-liner action item>`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    let action = response.text.trim().replace(/\\s+/g, ' '); // Collapse all whitespace to single spaces
// Optionally, extract only the first line or sentence if Gemini returns more
action = action.split('\n')[0];
    res.json({ action });
  } catch (e) {
    res.status(500).json({ error: 'Gemini API error', details: e.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Gemini backend running on port ${PORT}`)); 