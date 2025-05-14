#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Starting Vercel build process...');

// Ensure environment is prepared for rollup
process.env.ROLLUP_SKIP_LOAD_CONFIG = 'true';

try {
  // Resolve rollup dependency issue
  console.log('⚙️ Setting up environment for build...');
  process.env.ROLLUP_SKIP_LOAD_CONFIG = 'true';
  
  // Check for the explicit Rollup binary
  if (!fs.existsSync('./node_modules/rollup/dist/rollup.js')) {
    console.log('⚠️ Rollup binary not found, installing explicitly...');
    execSync('npm install rollup@4.9.6 --no-save', { stdio: 'inherit' });
  }
  
  // Build the client
  console.log('📦 Building client...');
  execSync('vite build', { stdio: 'inherit' });
  
  // Ensure server dependencies are available
  if (fs.existsSync('./server/package.json')) {
    console.log('📋 Installing server dependencies...');
    execSync('cd server && npm install --omit=dev', { stdio: 'inherit' });
  }
  
  // Build the server
  console.log('📦 Building server...');
  execSync('esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { stdio: 'inherit' });
  
  // Ensure API directory exists for Vercel
  const apiDir = path.resolve(process.cwd(), 'api');
  if (!fs.existsSync(apiDir)) {
    console.log('📁 Creating API directory for Vercel...');
    fs.mkdirSync(apiDir, { recursive: true });
  }
  
  // Copy static assets
  const publicDir = path.resolve(process.cwd(), 'public');
  const distPublicDir = path.resolve(process.cwd(), 'dist/public');
  
  if (!fs.existsSync(distPublicDir)) {
    console.log(`📁 Creating directory: ${distPublicDir}`);
    fs.mkdirSync(distPublicDir, { recursive: true });
  }
  
  if (fs.existsSync(publicDir)) {
    console.log('📋 Copying public assets...');
    // Copy all files from public to dist/public
    const files = fs.readdirSync(publicDir);
    files.forEach(file => {
      const srcPath = path.join(publicDir, file);
      const destPath = path.join(distPublicDir, file);
      fs.copyFileSync(srcPath, destPath);
      console.log(`  - Copied ${file}`);
    });
  }
  
  // Create a post-deployment check file to verify the build
  const deployCheckFile = path.resolve(process.cwd(), 'dist/vercel-deploy-check.json');
  fs.writeFileSync(deployCheckFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    buildVersion: process.env.VERCEL_GIT_COMMIT_SHA || 'dev-build',
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development'
  }, null, 2));
  
  console.log('✅ Build process completed successfully');
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
} 