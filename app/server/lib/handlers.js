const db = require('./../db'),
    crypto = require('crypto'),
    { sessionCookiesExpirationMM, unknownUserAgent } = require('./../config')


const setCookies = (err, rows) => {
    if (err) return next(err)
    return res.cookie('connectionId', rows.lastID, { signed: true, maxAge: sessionCookiesExpirationMM })
}
// const writeConnections = (err, rows) => {
//     if (err) return next(err)
//     if (rows.length !== 1) return next()
//     return db.run('INSERT INTO connections (user_agent, users_id) VALUES (?, ?)', [req.headers['user-agent'], rows[0].id], setCookies)
// }
const forGETRender = (page) => {
    return (req, res, next) => {
        const now = new Date()
        res.render(page, {
            username: (function (req, res) {
                let username
                if (req.user) {
                    username = req.user.username
                    if (!req.signedCookies.connectionId) {
                        db.run('SELECT * FROM users WHERE username = ?', [req.user.username], (err, rows) => {
                            if (err) return next(err)
                            if (rows.length !== 1) return next()
                                (function (db, userAgent, usersId, res) {
                                    (function (db, userAgent, usersId) {
                                        db.run('INSERT INTO connections (user_agent, users_id) VALUES (?, ?)', [userAgent, usersId], setCookies)
                                    })(db, userAgent, usersId)
                                })(db, req.headers['user-agent'], rows[0].id, res)
                        })
                    }
                } else {
                    username = 'Не актуализирован'
                }
                return username
            })(req, res)
        })
    }
}
const forSignup = (req, res, next, db, userAgent, usersId) => {
    db.run('INSERT INTO connections (user_agent, users_id) VALUES (?, ?)',
        [userAgent, usersId], (err, rows) => {
            if (err) return next()
            setCookiesIdConnections(res, rows.insertId)
            res.redirect('/');
        }
    )
}
const setCookiesIdConnections = (res, connectionsId) => {
    return res.cookie('connectionId', connectionsId, { signed: true, maxAge: sessionCookiesExpirationMM })
}

exports.homeGet = forGETRender('home')
exports.loginGet = forGETRender('login')
exports.signupGet = forGETRender('signup')
exports.loginPasswordPost = (req, res, next) => {
    const userId = req.user.id
    if (!userId) return next()
    return forSignup(req, res, next, db, req.headers['user-agent'] ?? unknownUserAgent, userId)
}
exports.signupPost = (req, res, next) => {
    const username = req.body.username
    db.run('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) return res.status(500).render('error')
        if (1 == row.length) return res.render('notunic')
        if (2 <= row.length) return res.status(500).render('error')
        const salt = crypto.randomBytes(16)
        crypto.pbkdf2(req.body.password, salt, 310000, 32, 'sha256', function (err, hashedPassword) {
            if (err) return res.status(500).render('error')
            db.run('INSERT INTO users (username, hashed_password, salt, email) VALUES (?, ?, ?, ?)', [
                username,
                hashedPassword,
                salt,
                req.body.email
            ], function (err, rows) {
                if (err) return res.status(500).render('error')
                var user = {
                    id: this.lastID,
                    username
                };
                req.login(user, function (err) {
                    if (err) { return next(err); }
                    return forSignup(req, res, next, db, req.headers['user-agent'], rows.insertId)
                });
            })
        })
    })
}
exports.logoutPost = (req, res, next) => {
    req.logout(function (err) {
        if (err) { return next(err); }
        console.log(JSON.stringify(req.signedCookies))
        db.run('UPDATE connections SET delete_ = 1 WHERE id = ?', [req.signedCookies.connectionId], (err, rows) => {
            if (err) return next(err)
            res.clearCookie('connectionId')
            res.redirect('/');
        })
        // deleteConnection(db, Number(req.signedCookies.connectionId))
        // res.clearCookie('connectionId')
        // res.redirect('/');
    })
}