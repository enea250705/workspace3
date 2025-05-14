import express, { type Express, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
// Replace the problematic import with a local configuration object
// import viteConfig from "../vite.config";
// Define a basic vite config object
const viteConfig = {
  plugins: [],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "client", "src"),
      "@shared": path.resolve(process.cwd(), "shared"),
    }
  },
  root: path.resolve(process.cwd(), "client"),
  build: {
    outDir: path.resolve(process.cwd(), "dist/public"),
    emptyOutDir: true,
  }
};
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
  try {
    // First try the standard dist/public path
    const distPath = path.resolve(process.cwd(), "dist", "public");
    
    // Render paths - look directly in dist folder
    const possiblePaths = [
      distPath,
      path.resolve(process.cwd(), "dist"),
      path.resolve(process.cwd(), "public"),
      path.resolve(process.cwd(), "client/dist"),
      path.resolve(process.cwd(), "client/build")
    ];
    
    // Log the paths we're checking
    log(`Checking for static files in: ${possiblePaths.join(', ')}`, "server");
    
    // Find the first path that exists
    const validPath = possiblePaths.find(p => {
      const exists = fs.existsSync(p);
      log(`Path ${p} exists: ${exists}`, "server");
      return exists;
    });
    
    if (!validPath) {
      // Don't throw, just log and serve a simple message
      log(`WARNING: Could not find any valid build directory. Using fallback.`, "server");
      
      // Set up simple middleware to handle all requests
      app.use('*', (_req: Request, res: Response) => {
        res.status(200).send(`
          <html>
            <head><title>Da Vittorino App</title></head>
            <body>
              <h1>Server is running</h1>
              <p>The server is running, but static files are not available. Please check build configuration.</p>
            </body>
          </html>
        `);
      });
      
      return;
    }
    
    log(`Using static files from: ${validPath}`, "server");
    
    // Serve static files with proper caching
    app.use(express.static(validPath, {
      maxAge: '1d',
      etag: true
    }));
    
    // Find index.html for client-side routing
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
        
        // Create a simple handler for all routes
        app.use('*', (_req: Request, res: Response) => {
          res.status(200).send(`
            <html>
              <head><title>Da Vittorino App</title></head>
              <body>
                <h1>Server is running</h1>
                <p>The server is running, but index.html is missing. Please check build configuration.</p>
              </body>
            </html>
          `);
        });
        
        return;
      }
    }
    
    // Fallback to index.html for client-side routing
    app.use("*", (_req: Request, res: Response) => {
      try {
        if (fs.existsSync(indexHtmlPath)) {
          res.sendFile(indexHtmlPath);
        } else {
          res.status(200).send("Server is running, but index.html is missing");
        }
      } catch (error) {
        log(`Error serving index.html: ${error}`, "server");
        res.status(500).send("Internal server error");
      }
    });
  } catch (error) {
    log(`Critical error in serveStatic: ${error}`, "server");
    
    // Provide a fallback route handler that won't crash
    app.use('*', (_req: Request, res: Response) => {
      res.status(500).send("Internal server error in static file serving");
    });
  }
}
