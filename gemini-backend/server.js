import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: 'AIzaSyDCV74Ius71fdKhB6_YiXeUGCII8ak_3Wg' });
const app = express();
app.use(cors()); // Allow requests from your extension
app.use(express.json());

app.post('/gemini-action', async (req, res) => {
  const { context, note, url } = req.body;

  console.log("Req aagyi kyaaa ")
  
  try {
    const prompt = `Context: ${context}
Note: ${note}
URL: ${url}
Generate a single, concise, one-line action item (max 1 sentence) for the user, in this format:
Action: <one-liner action item>`;

    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract action from the response
    const actionMatch = text.match(/Action:\s*(.+)/i);
    const action = actionMatch ? actionMatch[1].trim() : text.trim();
    
    res.json({ action });
  } catch (e) {
    console.error('Gemini API error:', e);
    res.status(500).json({ error: 'Gemini API error', details: e.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Gemini backend running on port ${PORT}`)); 