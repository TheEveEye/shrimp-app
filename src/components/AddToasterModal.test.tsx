import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddToasterModal from './AddToasterModal'

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    accessToken: 'test-token',
    character: { id: 9001, name: 'Test Pilot', portrait: 'https://example.test/portrait.png' },
  }),
}))

vi.mock('./ToastProvider', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo) => {
    const url = typeof input === 'string' ? input : input.url
    if (url.includes('/api/characters/linked')) {
      return Promise.resolve({ ok: true, json: async () => ({ characters: [] }) })
    }
    if (url.includes('/online')) {
      return Promise.resolve({ ok: true, json: async () => ({ online: true }) })
    }
    if (url.includes('/affiliation')) {
      return Promise.resolve({ ok: true, json: async () => ({ alliance_icon_url: null }) })
    }
    return Promise.resolve({ ok: true, json: async () => ({}) })
  }) as unknown as typeof fetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('AddToasterModal', () => {
  it('requires a character and tier before enabling Add', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()

    render(<AddToasterModal open onClose={onClose} onAdd={onAdd} attachedIds={[]} />)

    const addButton = screen.getByRole('button', { name: 'Add' })
    expect(addButton).toBeDisabled()

    const selectButton = screen.getByRole('button', { name: /select a character/i })
    await user.click(selectButton)

    const option = screen.getByRole('option', { name: /test pilot/i })
    await user.click(option)
    expect(addButton).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'T2' }))
    expect(addButton).toBeEnabled()
  })
})
