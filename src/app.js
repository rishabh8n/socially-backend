const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
require("dotenv").config();
const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// routes
const authRoutes = require("./routes/auth.routes");
const profileRoutes = require("./routes/profile.routes");
const searchRoutes = require("./routes/search.routes");

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/search", searchRoutes);

module.exports = app;
