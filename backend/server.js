const app = require("./src/app");
const { cleanupExpiredAccounts } = require("./src/services/cleanupService");

const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  
  // Run cleanup on startup and every hour
  cleanupExpiredAccounts();
  setInterval(cleanupExpiredAccounts, 60 * 60 * 1000); // Every hour
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${port} is already in use. A server instance is probably still running.`,
    );
    console.error(`To fix, find and kill the process, then start again:`);
    console.error(`  netstat -ano | findstr :${port}`);
    console.error(`  taskkill /PID <PID> /F`);
    console.error(`Or run on another port:  PORT=5001 node server.js`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
