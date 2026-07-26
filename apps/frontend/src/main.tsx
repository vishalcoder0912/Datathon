/**
 * @fileoverview Main React Client Entrypoint for InsightFlow Web Application.
 * Binds root DOM element and initializes top-level React component tree.
 * 
 * @module frontend/main
 */

import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./index.css";

// Render root application component into DOM container
createRoot(document.getElementById("root")!).render(<App />);

