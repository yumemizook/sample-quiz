// Minimal Express server serving static files
// Usage: npm run serve

const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Serve static site files
app.use(express.static(path.join(__dirname)));



app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
