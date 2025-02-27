const handlers = require('./../handlers')

test('home page renders actualization user', () => {
    const req = {}
    const res = { render: jest.fn() }
    handlers.homeGet(req, res)
    expect(res.render.mock.calls.length).toBe(1)
    expect(res.render.mock.calls[0][0]).toBe('home')
})