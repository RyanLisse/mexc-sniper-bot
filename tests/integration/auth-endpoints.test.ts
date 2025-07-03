import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'child_process'

const PORT = 3103
const BASE_URL = `http://localhost:${PORT}`
let server: ReturnType<typeof spawn>

async function startServer() {
  return new Promise<void>((resolve) => {
    server = spawn('npx', ['next', 'dev', '-p', PORT.toString()])
    server.stdout.on('data', (data) => {
      if (data.toString().includes('Ready')) {
        resolve()
      }
    })
  })
}

async function stopServer() {
  if (server) server.kill('SIGINT')
}

beforeAll(async () => {
  await startServer()
}, 30000)

afterAll(async () => {
  await stopServer()
})

describe('Auth API endpoints return 500', () => {
  it('GET /api/auth/session', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/session`)
    expect(res.status).toBe(500)
  })

  it('POST /api/auth/signout', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/signout`, { method: 'POST' })
    expect(res.status).toBe(500)
  })

  it('GET /api/auth/callback', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/callback?code=test`)
    expect(res.status).toBe(500)
  })

  it('GET /api/auth/supabase-session', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/supabase-session`)
    expect(res.status).toBe(500)
  })
})
