import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import Results from "./Results.jsx";
import Admin from "./Admin.jsx";
import Leaderboard from "./Leaderboard";
import Rules from "./Rules.jsx";
import Reglas from "./Reglas.jsx";
import History from "./History.jsx";
import Login from "./Login.jsx";
import Profile from "./Profile.jsx";
import WhosIn from "./WhosIn.jsx";
import RequireAuth from "./RequireAuth.jsx";
import UpdateBanner from "./UpdateBanner.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <UpdateBanner />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><App /></RequireAuth>} />
        <Route path="/results" element={<RequireAuth><Results /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
        <Route path="/leaderboard" element={<RequireAuth><Leaderboard /></RequireAuth>} />
        <Route path="/rules" element={<RequireAuth><Rules /></RequireAuth>} />
        <Route path="/reglas" element={<RequireAuth><Reglas /></RequireAuth>} />
        <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/whos-in" element={<RequireAuth><WhosIn /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
