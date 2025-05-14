import express, { type Express, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: [] as string[],
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg: any, options: any) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req: Request, res: Response, next: NextFunction) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        process.cwd(),
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // First try the standard dist/public path
  const distPath = path.resolve(process.cwd(), "server", "public");
  
  // Vercel paths may be different, so we check multiple options
  const possiblePaths = [
    distPath,
    path.resolve(process.cwd(), "dist/public"),
    path.resolve(process.cwd(), "dist"),
    path.resolve(process.cwd(), "public")
  ];
  
  // Find the first path that exists
  const validPath = possiblePaths.find(p => fs.existsSync(p));
  
  if (!validPath) {
    const error = `ERROR: Could not find any valid build directory. Checked: ${possiblePaths.join(', ')}`;
    log(error, "server");
    throw new Error(error);
  }
  
  log(`Using static files from: ${validPath}`, "server");
  app.use(express.static(validPath));
  
  // We also set up a path for the index.html
  let indexHtmlPath = path.resolve(validPath, "index.html");
  
  // If index.html doesn't exist in the validPath, try to find it
  if (!fs.existsSync(indexHtmlPath)) {
    const possibleIndexPaths = possiblePaths.map(p => path.resolve(p, "index.html"));
    const validIndexPath = possibleIndexPaths.find(p => fs.existsSync(p));
    
    if (validIndexPath) {
      indexHtmlPath = validIndexPath;
      log(`Found index.html at: ${indexHtmlPath}`, "server");
    } else {
      log(`WARNING: Could not find index.html in any directory`, "server");
    }
  }
  
  // Fallback to index.html for client-side routing
  app.use("*", (_req: Request, res: Response) => {
    if (fs.existsSync(indexHtmlPath)) {
      res.sendFile(indexHtmlPath);
    } else {
      res.status(404).send("Not found - Build files missing");
    }
  });
}
