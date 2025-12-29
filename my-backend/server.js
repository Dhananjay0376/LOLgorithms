import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Weather endpoint
app.get("/api/weather", async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "Missing lat/lon" });

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Server missing OpenWeather API key" });

  try {
    const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`);
    if (!weatherRes.ok) throw new Error("Weather API failed");
    const data = await weatherRes.json();
    res.json(data);
  } catch (err) {
    console.error("Weather error:", err);
    res.status(502).json({ error: "Failed to fetch weather" });
  }
});

// Chatbot endpoint
app.post("/api/ai", async (req, res) => {
  const userMessage = req.body.message || "Hello";

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful guide about Mathura and Vrindavan temples." },
        { role: "user", content: userMessage }
      ]
    });

    const reply = completion.choices[0].message.content;
    res.json({ reply });
  }
  catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Server error. Check backend logs." });
  }
});

app.get("/", (req, res) => {
  res.send("Mathura Backend Running");
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
