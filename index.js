require("dotenv").config();
const app = require("./app");
const connectDB = require("./db");

connectDB()
  .then(() => {
    const PORT = process.env.PORT || 8000;
    app.on("error", (err) => {
      console.log("Error starting server", err);
      throw err;
    });
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log("Error connecting to database", err);
  });
