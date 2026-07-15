import { http, HttpResponse } from 'msw'

const BASE_URL = 'http://localhost:8000'

export const handlers = [
  http.post(`${BASE_URL}/auth/login`, async ({ request }) => {
    const body = await request.json() as { username: string; password: string }
    if (body.username === 'admin' && body.password === 'changeme') {
      return HttpResponse.json({
        access_token: 'test-token',
        token_type: 'bearer',
        role: 'admin',
        project_id: 'proj-1',
      })
    }
    return HttpResponse.json({ detail: 'Invalid credentials' }, { status: 401 })
  }),

  http.get(`${BASE_URL}/members`, () => {
    return HttpResponse.json({
      items: [
        { id: 'member-1', name: 'Alice', is_active: true, created_at: '2026-01-01T00:00:00Z' },
        { id: 'member-2', name: 'Bob', is_active: true, created_at: '2026-01-01T00:00:00Z' },
      ],
      total: 2,
      page: 1,
      page_size: 20,
    })
  }),

  http.get(`${BASE_URL}/categories`, () => {
    return HttpResponse.json({
      items: [
        { id: 'cat-1', name: 'Wine', color: '#722F37', created_at: '2026-01-01T00:00:00Z' },
        { id: 'cat-2', name: 'Meals', color: '#4CAF50', created_at: '2026-01-01T00:00:00Z' },
      ],
      total: 2,
      page: 1,
      page_size: 20,
    })
  }),

  http.get(`${BASE_URL}/tickets`, () => {
    return HttpResponse.json({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    })
  }),

  http.get(`${BASE_URL}/projects/public-list`, () => {
    return HttpResponse.json({
      items: [
        { id: 'proj-1', name: 'Portugal-2026', bg_color: '#006600', text_color: '#FFFFFF', accent_color: '#FFD700', status: 'open' },
        { id: 'proj-2', name: 'France-2026', bg_color: '#003189', text_color: '#FFFFFF', accent_color: '#ED2939', status: 'open' },
      ],
    })
  }),

  http.get(`${BASE_URL}/projects`, () => {
    return HttpResponse.json({
      items: [
        {
          id: 'proj-1',
          name: 'Portugal-2026',
          default_language: 'pt',
          bg_color: '#006600',
          text_color: '#FFFFFF',
          accent_color: '#FFD700',
          status: 'open',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      total: 1,
    })
  }),

  http.get(`${BASE_URL}/projects/:id/members`, () => {
    return HttpResponse.json({
      items: [
        { id: 'member-1', name: 'Alice', is_active: true, joined_at: '2026-01-01T00:00:00Z' },
      ],
      total: 1,
    })
  }),

  http.post(`${BASE_URL}/projects/:id/members`, () => {
    return HttpResponse.json(
      { member_id: 'member-2', project_id: 'proj-1', joined_at: '2026-01-01T00:00:00Z' },
      { status: 201 },
    )
  }),

  http.delete(`${BASE_URL}/projects/:id/members/:memberId`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${BASE_URL}/balances`, () => {
    return HttpResponse.json({ balances: [], as_of: '2026-01-01T00:00:00Z' })
  }),

  http.get(`${BASE_URL}/offset-rules`, () => {
    return HttpResponse.json({ items: [] })
  }),
]
