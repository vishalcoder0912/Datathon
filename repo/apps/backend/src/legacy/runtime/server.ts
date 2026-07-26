import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import genaiRoutes from "../routes/genaiRoutes.js";
import { serviceUrls } from "../../config/serviceUrls.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// GenAI Routes
app.use("/api/genai", genaiRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "insightflow-genai" });
});

app.listen(PORT, () => {
  console.log(`🚀 InsightFlow GenAI Server running on port ${PORT}`);
  console.log(`📊 API Documentation: ${serviceUrls.frontend}/api/docs`);
});
