import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./pages/App";
import MappingsPage from "./pages/MappingsPage";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Toaster richColors position="top-right" />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/mappings" element={<MappingsPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
