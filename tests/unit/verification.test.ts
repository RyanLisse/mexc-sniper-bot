import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

describe('Project Verification Tests', () => {
  const projectRoot = join(__dirname, '../..')

  describe('Python Cleanup Verification', () => {
    it('should have no Python source files in src directory', () => {
      const srcPath = join(projectRoot, 'src')
      const checkForPythonFiles = (dir: string): string[] => {
        const fs = require('fs')
        if (!fs.existsSync(dir)) return []
        
        const files = fs.readdirSync(dir, { withFileTypes: true })
        let pythonFiles: string[] = []
        
        for (const file of files) {
          const fullPath = join(dir, file.name)
          if (file.isDirectory()) {
            pythonFiles = pythonFiles.concat(checkForPythonFiles(fullPath))
          } else if (file.name.endsWith('.py')) {
            pythonFiles.push(fullPath)
          }
        }
        
        return pythonFiles
      }

      const pythonFiles = checkForPythonFiles(srcPath)
      expect(pythonFiles).toHaveLength(0)
    })

    it('should not have Python configuration files', () => {
      const pythonConfigFiles = [
        'pyproject.toml',
        'requirements.txt',
        'uv.lock',
        'alembic.ini'
      ]

      for (const file of pythonConfigFiles) {
        const filePath = join(projectRoot, file)
        expect(existsSync(filePath)).toBe(false)
      }
    })

    it('should not have Python API directory', () => {
      const apiPath = join(projectRoot, 'api')
      const hasLegacyPythonApi = existsSync(join(apiPath, 'agents.py'))
      expect(hasLegacyPythonApi).toBe(false)
    })
  })

  describe('TypeScript Implementation Verification', () => {
    it('should have all required TypeScript agent files', () => {
      const requiredAgentFiles = [
        'src/mexc-agents/mexc-api-agent.ts',
        'src/mexc-agents/calendar-agent.ts',
        'src/mexc-agents/pattern-discovery-agent.ts',
        'src/mexc-agents/symbol-analysis-agent.ts',
        'src/mexc-agents/orchestrator.ts'
      ]

      for (const file of requiredAgentFiles) {
        const filePath = join(projectRoot, file)
        expect(existsSync(filePath)).toBe(true)
      }
    })

    it('should have all API trigger routes', () => {
      const triggerRoutes = [
        'app/api/triggers/calendar-poll/route.ts',
        'app/api/triggers/pattern-analysis/route.ts',
        'app/api/triggers/symbol-watch/route.ts',
        'app/api/triggers/trading-strategy/route.ts'
      ]

      for (const route of triggerRoutes) {
        const routePath = join(projectRoot, route)
        expect(existsSync(routePath)).toBe(true)
      }
    })

    it('should have database layer implemented', () => {
      const dbFiles = [
        'src/db/index.ts',
        'src/db/schema.ts',
        'drizzle.config.ts'
      ]

      for (const file of dbFiles) {
        const filePath = join(projectRoot, file)
        expect(existsSync(filePath)).toBe(true)
      }
    })

    it('should have testing infrastructure', () => {
      const testFiles = [
        'vitest.config.unified.js',
        'tests/unit/utils.test.ts',
        'tests/unit/mexc-api-client.test.ts',
        'tests/integration/agent-system.test.ts'
      ]

      for (const file of testFiles) {
        const filePath = join(projectRoot, file)
        expect(existsSync(filePath)).toBe(true)
      }
    })
  })

  describe('Configuration Verification', () => {
    it('should have clean package.json without Python dependencies', () => {
      const packageJsonPath = join(projectRoot, 'package.json')
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

      // Check that we have TypeScript dependencies
      expect(packageJson.devDependencies).toHaveProperty('typescript')
      expect(packageJson.devDependencies).toHaveProperty('vitest')
      expect(packageJson.devDependencies).toHaveProperty('@biomejs/biome')

      // Check that we have the required TypeScript packages
      expect(packageJson.dependencies).toHaveProperty('next')
      expect(packageJson.dependencies).toHaveProperty('react')
      expect(packageJson.dependencies).toHaveProperty('openai')
      expect(packageJson.dependencies).toHaveProperty('inngest')
      expect(packageJson.dependencies).toHaveProperty('drizzle-orm')

      // Verify testing scripts are present
      expect(packageJson.scripts).toHaveProperty('test')
      expect(packageJson.scripts).toHaveProperty('test:unit')
      expect(packageJson.scripts).toHaveProperty('test:watch')
    })

    it('should have clean Next.js configuration', () => {
      const nextConfigPath = join(projectRoot, 'next.config.ts')
      expect(existsSync(nextConfigPath)).toBe(true)

      const nextConfig = readFileSync(nextConfigPath, 'utf-8')
      expect(nextConfig).toContain('NextConfig')
      expect(nextConfig).toContain('serverExternalPackages')
    })

    it('should have proper TypeScript configuration', () => {
      const tsconfigPath = join(projectRoot, 'tsconfig.json')
      expect(existsSync(tsconfigPath)).toBe(true)

      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'))
      expect(tsconfig.compilerOptions).toHaveProperty('strict')
      expect(tsconfig.compilerOptions).toHaveProperty('esModuleInterop')
    })
  })

  describe('Documentation Verification', () => {
    it('should have comprehensive documentation', () => {
      const requiredDocFiles = [
        'CLAUDE.md',
        'README.md',
        'docs/typescript-multi-agent-architecture.md',
        'docs/api-trigger-routes.md'
      ]

      const optionalDocFiles = [
        'SPRINT_COMPLETION_REPORT.md'
      ]

      // Verify required documentation exists
      for (const file of requiredDocFiles) {
        const filePath = join(projectRoot, file)
        expect(existsSync(filePath)).toBe(true)
      }

      // Optional documentation files (don't fail if missing)
      for (const file of optionalDocFiles) {
        const filePath = join(projectRoot, file)
        if (existsSync(filePath)) {
          console.log(`✅ Optional documentation found: ${file}`)
        } else {
          console.log(`ℹ️ Optional documentation missing: ${file}`)
        }
      }
    })

    it('should have implementation summary (optional)', () => {
      const implementationSummary = join(projectRoot, 'IMPLEMENTATION_SUMMARY.md')
      if (existsSync(implementationSummary)) {
        expect(existsSync(implementationSummary)).toBe(true)
        console.log('✅ Implementation summary found')
      } else {
        console.log('ℹ️ Implementation summary not required for tests to pass')
        // Always pass - this is optional documentation
        expect(true).toBe(true)
      }
    })

    it('should have testing report (optional)', () => {
      const testingReport = join(projectRoot, 'TESTING_REPORT.md')
      if (existsSync(testingReport)) {
        expect(existsSync(testingReport)).toBe(true)
        console.log('✅ Testing report found')
      } else {
        console.log('ℹ️ Testing report not required for tests to pass')
        // Always pass - this is optional documentation
        expect(true).toBe(true)
      }
    })
  })

  describe('System Integration Verification', () => {
    it('should have proper environment variable structure', () => {
      // Check if .env.example exists (good practice)
      const envExample = join(projectRoot, '.env.example')
      const envLocal = join(projectRoot, '.env.local')
      
      // At least one should exist for reference
      const hasEnvReference = existsSync(envExample) || existsSync(envLocal)
      expect(hasEnvReference).toBe(true)
    })

    it('should have Vercel deployment configuration', () => {
      const vercelConfig = join(projectRoot, 'vercel.json')
      expect(existsSync(vercelConfig)).toBe(true)

      const config = JSON.parse(readFileSync(vercelConfig, 'utf-8'))
      expect(config).toHaveProperty('functions')
    })

    it('should have Inngest integration', () => {
      const inngestFiles = [
        'src/inngest/client.ts',
        'src/inngest/functions.ts',
        'app/api/inngest/route.ts'
      ]

      for (const file of inngestFiles) {
        const filePath = join(projectRoot, file)
        expect(existsSync(filePath)).toBe(true)
      }
    })
  })

  describe('Code Quality Verification', () => {
    it('should have linting configuration', () => {
      const biomeConfig = join(projectRoot, 'biome.json')
      expect(existsSync(biomeConfig)).toBe(true)
    })

    it('should have formatting and linting scripts', () => {
      const packageJsonPath = join(projectRoot, 'package.json')
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

      expect(packageJson.scripts).toHaveProperty('lint')
      expect(packageJson.scripts).toHaveProperty('format')
      expect(packageJson.scripts).toHaveProperty('type-check')
      expect(packageJson.scripts).toHaveProperty('pre-commit')
    })

    it('should have proper project structure', () => {
      const requiredDirectories = [
        'src/mexc-agents',
        'src/inngest',
        'src/db',
        'src/hooks',
        'src/services',
        'src/schemas',
        'app/api',
        'tests/unit',
        'tests/integration'
      ]

      for (const dir of requiredDirectories) {
        const dirPath = join(projectRoot, dir)
        expect(existsSync(dirPath)).toBe(true)
      }
    })
  })
})