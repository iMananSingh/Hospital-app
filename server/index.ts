import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

(async () => {
  const port = parseInt(process.env.PORT || '5000', 10);

  if (process.env.NODE_ENV === "development") {
    // Development mode: use Vite dev server
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });

    app.use(vite.middlewares);
  } else {
    // Production mode: serve static files
    const distPath = path.resolve(__dirname, "../dist/public");
    app.use(express.static(distPath));

    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
  });
})();