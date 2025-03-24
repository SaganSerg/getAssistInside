const express = require('express'),
    expressHandlebars = require('express-handlebars'),
    passport = require('passport'),
    LocalStrategy = require('passport-local'),
    crypto = require('crypto'),
    session = require('express-session'),
    MySQLStore = require('express-mysql-session')(session),
    bodyParser = require('body-parser'),
    db = require('./db'),
    jwt = require('jsonwebtoken'),
    nodemailer = require('nodemailer'),
    cookieParser = require('cookie-parser'),
    handlers = require('./lib/handlers'),
    morgan = require('morgan'),
    fs = require('fs'),
    cluster = require('cluster')
// https = require('https') // это может быть использовано, в случае если нужен https без nginx 

// const urlResetPass = 'reset' // это url я вынес в переменную, потому что он используется в двух местах

/* это нужно использовать если нужен будет https без nginx */
// const options = {
//     key: fs.readFileSync(__dirname + '/ssl/blueprint.pem'),
//     cert: fs.readFileSync(__dirname + '/ssl/blueprint.crt'),
// }

const { credentials,
    sessionHost,
    sessionUser,
    sessionPassword,
    sessionDatabase,
    longTokenExpire,

    emailTokenExpire,
    yourEmail,
    domen,
    httpProtocol,
    sessionCookiesExpirationMM,
    cleanConnectionsTime,
    smtpKey,
    smtpHost,
    smtpPort,
    smtpUser,

    tokenExpire,
    cleanBlokLogin,
    numberOfAttempts
} = require('./config')

const sessionStore = new MySQLStore(
    {
        host: sessionHost,
        port: 3306,
        user: sessionUser,
        password: sessionPassword,
        database: sessionDatabase,
        expiration: sessionCookiesExpirationMM, /* 
        указывая срок истечения кука явно, для того, чтобы это же точно время можно было использовать для удаления из таблицы с коннектами
        */
    }
)
// YYYY-MM-DD НН:MI:SS
const getTimeForMySQL = (timeStamp) => {
    const getTwoSimbols = (x) => {
        return x > 9 ? x : '0' + x
    }
    const time = new Date(Number(timeStamp))
    const hours = getTwoSimbols(time.getHours())
    const minutes = getTwoSimbols(time.getMinutes())
    const seconds = getTwoSimbols(time.getSeconds())
    const month = getTwoSimbols(time.getMonth() + 1)
    const date = getTwoSimbols(time.getDate())
    return `${time.getFullYear()}-${month}-${date} ${hours}:${minutes}:${seconds}`

}
const getTokenFunction = (params, tokenSecret) => { // pframs -- это объект в котором, элементами являются данные, котороые будут зашифрованы в данной случае { username, usersId, connectionId }
    let message = ''
    if (typeof params !== 'object') {
        message += 'params is not object\n'
    }
    if (typeof tokenSecret !== 'string') {
        message += 'tokenSecren is no string'
    }
    if (message) return console.log(message)
    return (tokenExpire) => {
        if (typeof tokenExpire !== 'number') {
            return console.log('tokenExpire is not number')
        }
        return jwt.sign(params, tokenSecret, { expiresIn: tokenExpire })
    }
}
// const deleteExpiredConnections = (db) => {
//     const now = new Date()

//     db.run('UPDATE connections SET delete_ = 1 WHERE delete_ = 0 AND time_ < ?)', [getTimeForMySQL(now.setDate(now.getDate() - 1))], (err, rows) => {
//         if (err) return { result: false, err }
//         return rows.length
//     })
// }
// const setConnections = (db, userAgent, usersId) => {
//     db.run('INSERT INTO connections (user_agent, users_id) VALUES (?, ?)',
//         [userAgent, usersId], (err, rows) => {
//             if (err) return { result: false, err }
//             console.log('данные в базу внесены')
//             return { result: true, connectionsId: rows.lastID }
//         })
// }

// const setConnectionsForWeb = (db, userAgent, usersId, res) => {
//     const recordDBResult = setConnections(db, userAgent, usersId)
//     console.log(recordDBResult)
//     if (recordDBResult.result) return setCookiesIdConnections(res, recordDBResult.connectionsId)
//     return false
// }
const deleteConnection = (db, connectionsId) => {
    db.run('UPDATE connections SET delete_ = 1 WHERE id = ?', [connectionsId], (err, rows) => {
        if (err) return { result: false, err }
        return { result: true }
    })
}

// const usernameForWeb = (req, res) => {
//     let username
//     if (req.user) {
//         username = req.user.username
//         if (req.signedCookies.connectionId === undefined) {
//             setConnectionsForWeb(db, req.headers['User-Agent'], req.user.username, res)
//         }
//     } else {
//         username = 'Не актуализирован'
//     }
//     return username
// }

const forSignupAPI = (req, res, next, db, usersId) => {
    const userAgent = req.headers['user-agent'] ?? 'Unknown'
    db.run('INSERT INTO connections (user_agent, users_id) VALUES (?, ?)',
        [userAgent, usersId], (err, rows) => {
            if (err) return res.status(500).json({ request: 'error', message: err.message })

            // const   username = req.body.username, 
            //         connectionId = rows.insertId
            // const getToken = (tokenExpire) => {
            //     return jwt.sign({ username, usersId, connectionId }, credentials.tokenSecret, { expiresIn: tokenExpire })
            // } // еще не доделан
            // const username = req.body.username
            // const connectionId = rows.insertId
            const params = { username: req.body.username, usersId, connectionId: rows.insertId }
            // const token = jwt.sign({ username, usersId, connectionId }, credentials.tokenSecret, { expiresIn: tokenExpire })
            // const longToken = jwt.sign({ username, usersId, connectionId }, credentials.longTokenSecret, { expiresIn: longTokenExpire })
            res.status(200).json({
                request: 'good',
                message: 'You are registered',
                token: getTokenFunction(params, credentials.tokenSecret)(tokenExpire),
                longToken: getTokenFunction(params, credentials.longTokenSecret)(longTokenExpire)
            })
        }
    )
}
const forResAPI = (req, res, next, db, userId, username) => {
    const userAgent = req.headers['user-agent'] ?? 'Unknown'
    db.run('INSERT INTO connections (user_agent, users_id) VALUES (?, ?)',
        [userAgent, userId], (err, rows) => {
            if (err) return res.status(500).json({ request: 'error', message: err.message })
            const params = { username, userId, connectionId: rows.insertId }
            res.status(200).json({
                request: 'good',
                message: 'You are registered',
                token: getTokenFunction(params, credentials.tokenSecret)(tokenExpire),
                longToken: getTokenFunction(params, credentials.longTokenSecret)(longTokenExpire)
            })
        }
    )
}
const forGETRenderOther = (page) => {
    return (req, res, next) => {
        res.render(page, {
            username: (function (req, res) {
                let username
                if (req.user) {
                    username = req.user.username
                    db.run('SELECT * FROM users WHERE username = ?', [username], (err, rows) => {
                        if (err) return next()
                        if (rows.length !== 1) return next()
                        if (!req.signedCookies.connectionId) {
                            (function (db, userAgent, usersId) {
                                db.run('INSERT INTO connections (user_agent, users_id) VALUES (?, ?)', [userAgent, usersId], (err, rows) => {
                                    if (err) return next(err)
                                        (function (res, connectionsId) {
                                            return res.cookie('connectionId', connectionsId, { signed: true, maxAge: sessionCookiesExpirationMM })
                                        })
                                })
                            })
                        }
                    })
                }
            })
        })
    }
}
/* 
req.headers

{
  host: 'localhost:3000',
  'user-agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
  accept: '',
  'accept-language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3',
  'accept-encoding': 'gzip, deflate, br',
  connection: 'keep-alive',
  cookie: 'connect.sid=s%3A-YzSZTXLGrtnePTQoFOEKMn3k5a4OiCu.OM2THYFtcJT7XsYlNWXd2o39hcKkZPM6uwMdYzl24a0',
  'upgrade-insecure-requests': '1',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  pragma: 'no-cache',
  'cache-control': 'no-cache'
}

*/

const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: true,
    auth: {
        user: smtpUser,
        pass: smtpKey,
    },
});
// transporter.verify(function (error, success) {
//     if (error) {
//       console.log(error);
//     } else {
//       console.log("Server is ready to take our messages");
//     }
//   });
// Middleware для проверки токена
const authenticateToken = (req, res, next) => { // эта фукнция и фукнция authenticateLongToken очень похожи --- отличаются только req.body.token и credentials.tokenSecret. поэтому лучше эти функции получать через одну функцию
    const token = req?.body?.token;
    if (!token) {
        return res.status(401).json({ code: 1, descr: 'Неавторизован: отсутсвует токен' }); // надо согласовть
    }

    jwt.verify(token, credentials.tokenSecret, (err, decoded) => {
        if (err) {
            return res.status(403).json({ code: 1, descr: 'Неавторизован: ошибочный токен' }); // надо согласовать
        }
        const now = new Date()
        const nowMinus10Minutes = getTimeForMySQL(now.setMinutes(now.getUTCMinutes() - 10))
        db.run('SELECT * FROM tokens WHERE tokens_id = ? AND tokens_extension_time > ?', [decoded?.tokenId, nowMinus10Minutes], (err, selectTokensRow) => {
            if (err) return res.status(500).json({ code: 1, descr: 'Что-то пошло не так' }) // надо согласовать
            if (!selectTokensRow.length) return res.status(403).json({ code: 1, descr: 'Неавторизован: ошибочный токен' }); // надо согласовать
            req.user = decoded;
            // console.log(decoded) // { username: 'vasa', iat: 1707980883, exp: 1710572883 } я еще добавил другое свойство 
            // { login, userId: selectUsersRow[0].users_id, tokenId: insertTokensRow.insertId }
            next();
        })

    });
};
const tokenExtension = (req, res, next) => {
    db.run('UPDATE tokens SET tokens_extension_time = ? WHERE tokens_id = ?', [getTimeForMySQL(new Date()), req?.user?.tokenId], (err, updateTokensRow) => {
        if (err) return res.status(500).json({ code: 1, descr: 'Что-то пошло не так' }) // надо согласовать
        next()
    })
}
const authenticateLongToken = (req, res, next) => {
    const token = req.body.longToken;
    if (!token) {
        return res.status(401).json({ request: 'error', message: 'Unauthorized: Token missing' });
    }

    jwt.verify(token, credentials.longTokenSecret, (err, decoded) => {
        if (err) {
            return res.status(403).json({ request: 'error', message: 'Unauthorized: Invalid token' });
        }

        req.user = decoded;
        // console.log(decoded) // { username: 'vasa', iat: 1707980883, exp: 1710572883 } я еще добавил другое свойство 
        next();
    });
}
// db.run('INSERT INTO experiment (something, otherthing) VALUES (1, 3)', [], (err, row) => {
//     console.log('err', err)
//     console.log('row', row)
// })
// __dirname --- это текущая папка
const app = express()
const port = process.env.PORT ?? 3000
switch (app.get('env')) {
    case 'development':
        app.use(require('morgan')('dev'));
        break;
    case 'production':
        const stream = fs.createWriteStream(__dirname + '/access.log', // файл access.log создается сам
            { flags: 'a' })
        app.use(morgan('combined', { stream }))
        break
}
const eppressHandlebarObj = expressHandlebars.create({
    defaultLayout: 'main'
})
const projectSymbolName = Symbol('Project name');
// getTimeForMySQL(now.setDate(now.getDate() - 1))
// getMilliseconds()
// getTimeForMySQL(now.setMinutes(now.getMinutes() - 1))

// let updateIntervalId = setInterval(() => {
//     const now = new Date()
//     db.run('UPDATE connections SET delete_ = 1 WHERE delete_ = 0 AND time_ < ?', [getTimeForMySQL(now.setMilliseconds(now.getMilliseconds() - cleanConnectionsTime))], (err, rows) => {
//         if (err) return console.log('err cleanConnecitonsTime')
//     })
// }, cleanConnectionsTime)


(() => {
    const timeOfCleanTokens = tokenExpire * 1000
    let deleteOldToken = setInterval(() => {
        const now = new Date()
        const time = getTimeForMySQL(now.setMilliseconds(now.getMilliseconds() - timeOfCleanTokens))
        db.run('DELETE FROM tokens WHERE tokens_create_time < ?', [time], (err, rows) => {
            if (err) return console.log('err delete old tokens')
        })
    }, timeOfCleanTokens)
})()

app.use((req, res, next) => {
    if (cluster.isWorker)
        console.log(`Worker ${cluster.worker.id} received request`)
    next()
})
app.use((req, res, next) => { // генерируем объкт с кастомными данными в объекте req, это будет нужно для того чтобы передавать что-то свое
    req[projectSymbolName] = {},
        next()
})
// app.use((req, res, next) => { // пока не удаляю, но надо будет кдалить
//     deleteExpiredConnections(db)
//     next()
// })
/*
Это пример его использования 
app.use((req, res, next) => {
    req[projectSymbolName]['cookiesAgree'] = (req.cookies.agree === 'yes')
    next()
})
*/
app.use(cookieParser(credentials.cookieSecret))

app.use(express.json())

app.engine('handlebars', eppressHandlebarObj.engine)

app.set('view engine', 'handlebars')

// db.run('INSERT INTO accessblockebylogin (accessblockebylogin_count, users_id, accessblockebylogin_time) VALUES (1, 1, "2025-01-30 10:20:11") ON DUPLICATE KEY UPDATE accessblockebylogin_time = "2026-01-30 10:20:11", accessblockebylogin_count = accessblockebylogin_count + 1', [], (err, row) => {
//     console.log(row)
// })

/* 
INSERT INTO accessblockebylogin (accessblockebylogin_count, users_id, accessblockebylogin_time) VALUES (1, 1, "2025-01-30 10:20:11") ON DUPLICATE KEY UPDATE accessblockebylogin_time = "2026-01-30 10:20:11
после insert
`OkPacket {
  fieldCount: 0,
  affectedRows: 1,
  insertId: 2,
  serverStatus: 2,
  warningCount: 0,
  message: '',
  protocol41: true,
  changedRows: 0
}

после update

OkPacket {
  fieldCount: 0,
  affectedRows: 2,
  insertId: 2,
  serverStatus: 2,
  warningCount: 0,
  message: '',
  protocol41: true,
  changedRows: 0
}

если в результате update значение не меняется в изменяемом поле, то возвращается 

*/

const strategy = new LocalStrategy(function verify(username, password, cb) {
    db.run('SELECT * FROM users WHERE users_login = ?', [username], function (err, user) {
        if (err) { return cb(err); }
        if (0 === user.length) { return cb(null, false, { message: 'Incorrect username or password.' }); }
        crypto.pbkdf2(password, user[0].users_salt, 310000, 32, 'sha256', function (err, hashedPassword) {
            if (err) { return cb(err); }
            if (!crypto.timingSafeEqual(user[0].users_hashed_password, hashedPassword)) {
                const now = getTimeForMySQL(new Date())
                return db.run('INSERT INTO accessblockebylogin (accessblockebylogin_count, users_id, accessblockebylogin_time) VALUES (1, ?, ?) ON DUPLICATE KEY UPDATE accessblockebylogin_time = ?, accessblockebylogin_count = accessblockebylogin_count + 1', [user[0].users_id, now, now], (err, row) => {
                    if (err) { return cb(err); }
                    return cb(null, false, { message: 'Incorrect username or password.' });
                })
            }
            return cb(null, user[0])
        });
    });
});
passport.use(strategy)
// passport.use(new LocalStrategy(function verify(username, password, cb) {
//     db.run('SELECT * FROM users WHERE username = ?', [username], function (err, row) {
//         if (err) { return cb(err); }
//         if (row.length === 0) { return cb(null, false, { message: 'Incorrect username or password.' }); }

//         crypto.pbkdf2(password, row.salt, 310000, 32, 'sha256', function (err, hashedPassword) {
//             if (err) { return cb(err); }
//             if (!crypto.timingSafeEqual(row.hashed_password, hashedPassword)) {
//                 return cb(null, false, { message: 'Incorrect username or password.' });
//             }
//             return cb(null, row);
//         });
//     });
// }));
passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
        cb(null, { id: user.id, username: user.username });
    });
});

passport.deserializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, user);
    });
});
app.enable('trust proxy') // пока не пользуюсь proxy поэтому пока выключаю
app.use(session({
    secret: credentials.cookieSecret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
}));
// app.use(passport.authenticate('session')); // c этим все работало
app.use(bodyParser.urlencoded({ extended: true }))

// app.get('/', passport.authenticate('session'), handlers.homeGet)
app.get('/', (req, res) => {
    res.type('text/plain')
    res.send('Hi')
})
// app.get('/login', passport.authenticate('session'), handlers.loginGet)
// app.post('/login/password', passport.authenticate('local', {
//     successRedirect: '/',
//     failureRedirect: '/login'
// }));
// let username = req.user ? req.user.username : 'Не актуализирован'
// app.post('/login/password', passport.authenticate('local', { failureRedirect: '/login' }), handlers.loginPasswordPost)
/* 
Это то что в req.user
Похоже полностью повторяет то, что хранистя в БД
{
  id: 54,
  username: 'Jora',
  hashed_password: <Buffer 9a e5 60 61 8e 84 b5 c6 af af 54 eb df 82 f3 e4 a4 c0 f5 ca f2 0d 8b e5 64 e2 ad b1 fd 3f 13 eb>,
  salt: <Buffer b2 66 bc 58 99 3c 30 bd 40 5a 9b ef 40 06 c2 6d>,
  email: 'websagan@gmail.com',
  email_verified: 0,
  time_: 2024-03-13T15:10:14.000Z,
  delete_: 0
}
*/
// app.post('/logout', passport.authenticate('session'), handlers.logoutPost)

// app.get('/signup', passport.authenticate('session'), handlers.signupGet)
/* 
Вот что сохраняется в БД в таблице sessions

при регистрации пользователя из браузера в таблице сохраняется вот что:
поле session_id значение ftD4GbkuWRR1wuLqmFK3EMaGe-hl_Hx0
поле expires значение 1712824333
поле data значение {"cookie":{"originalMaxAge":null,"expires":null,"httpOnly":true,"path":"/"},"passport":{"user":{"username":"Jora"}}}

когда же мы выходим из сессии т.е нажимаем вызываем запрос post /logout то в БД видим вот это
поле session_id значение g-v8Zk4HWkZLhpDQtZIb6SNBmQLEGSuH
поле expires значение 1712824434
поле data значение {"cookie":{"originalMaxAge":null,"expires":null,"httpOnly":true,"path":"/"}} 
Вывод: когда пользователь выходит из логирования то в таблице перезаписывается запись, в ней меняется все, но в поле data запись немного похожа, но отсутсвует поле passport

Когда же мы снова залогиниваемя то в таблице вот что хранится:
поле session_id значение 65SC6siekbNzPyD-d5Pf0KPlh4N1Rgh3
поле expires значение 1712824477
поле data значение {"cookie":{"originalMaxAge":null,"expires":null,"httpOnly":true,"path":"/"},"passport":{"user":{"id":56,"username":"Jora"}}}
Вывод: когда пользователь снова залогинивается, то запись снова перезаписывается, перезаписываются все поля, а в поле data  немного похожа, но в поле passport.user добавилось свойство id

Главный вывод, котороый делаю -- один пользователь с одного браузера помечается одной записью. 

*/
/* 
router.post('/signup', function(req, res, next) {
  var salt = crypto.randomBytes(16);
  crypto.pbkdf2(req.body.password, salt, 310000, 32, 'sha256', function(err, hashedPassword) {
    if (err) { return next(err); }
    db.run('INSERT INTO users (username, hashed_password, salt) VALUES (?, ?, ?)', [
      req.body.username,
      hashedPassword,
      salt
    ], function(err) {
      if (err) { return next(err); }
      var user = {
        id: this.lastID,
        username: req.body.username
      };
      req.login(user, function(err) {
        if (err) { return next(err); }
        res.redirect('/');
      });
    });
  });
});

*/
// app.post('/signup', passport.authenticate('session'), handlers.signupPost)
/* 
rows INSERT

OkPacket {
  fieldCount: 0,
  affectedRows: 1,
  insertId: 43,
  serverStatus: 2,
  warningCount: 0,
  message: '',
  protocol41: true,
  changedRows: 0
}

*/
/* 
rows UPDATE

OkPacket {
  fieldCount: 0,
  affectedRows: 1,
  insertId: 0, // это не тот id под которым запись находится в БД // похоже такой id возвращает update если в изменяемом поле ничего не меняется но надо проверить НЕ ПРОВЕРЯЛ!!!
  serverStatus: 2,
  warningCount: 0,
  message: '(Rows matched: 1  Changed: 1  Warnings: 0',
  protocol41: true,
  changedRows: 1
}
*/
/* 
login: form.elements.login.value,
            password: form.elements.password.value,
            name: form.elements.name.value,
            surname: form.elements.surname.value,
            jobtitle: form.elements.jobtitle.value,
            company: form.elements.company.value 

*/
/* 
req.ip, req.protocol 
req.secure
Здесь будут подробности соединения между клиентом и сервером, а не между прокси и сервером
req.ips -- исходный ip клиента
*/
app.post('/testRequest', (req, res, next) => {
    return res.status(200).json(req.body)
})
// это получение qr-кодов
app.post('/ejkhkejhkejmjhjhsuyeuyuysjhjguydkbnbvcvczwemvlhhuyupou', (req, res, next) => {
    const add = Number(req?.body?.add)
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    function toBase(num, chars) {
        if (num === 0) return '0';
        let result = '';
        while (num > 0) {
            result = chars[num % chars.length] + result;
            num = Math.floor(num / chars.length);
        }
        return result;
    }
    db.run('SELECT MAX(qrcodes_id) FROM qrcodes', [], (err, selectQrcodesRow) => {
        /* 
        selectQrcodesRow
        [ RowDataPacket { 'MAX(qrcodes_id)': 1 } ] 
        
        [ RowDataPacket { 'MAX(qrcodes_id)': null } ] -- если записей нет
        */
        if (err) return res.status(500).json({ code: 'error', descr: 'Что-то пошло не так' })
        let SQLrequest = "INSERT INTO qrcodes (qrcodes_value) VALUES "
        const SQLrequestValues = []
        for (let i = 0, id = Number(selectQrcodesRow[0]['MAX(qrcodes_id)']) + 1; i < add; i++, id++) {
            const sixtwonumber = toBase(id, chars)
            SQLrequest += '(?)'
            if (i < (add - 1)) SQLrequest += ', '
            SQLrequestValues.push(sixtwonumber)

        }
        db.run(SQLrequest, SQLrequestValues, (err, insertQrcodesRow) => {
            if (err) return res.status(500).json({ code: 1, descr: err.message })
            return res.status(200).json({ code: 0, descr: 'OK' })
        })
    })
})
// это для получения bar-кода
app.post('/weewqewqdsdsadsacxcxzcytrytryghgfnbnbvnbvfgdgfdrewrd', (req, res, next) => {
    const add = Number(req?.body?.add)
    db.run('SELECT MAX(barcodes_id) FROM barcodes', [], (err, selectBarcodesRow) => {
        if (err) return res.status(500).json({ code: 1, descr: err.message })
        let SQLrequest = "INSERT INTO barcodes (barcodes_value) VALUES "
        const SQLrequestValues = []
        for (let i = 0, id = Number(selectBarcodesRow[0]['MAX(barcodes_id)']) + 1; i < add; i++, id++) {
            SQLrequest += '(?)'
            if (i < (add - 1)) SQLrequest += ', '
            SQLrequestValues.push(id)
        }
        db.run(SQLrequest, SQLrequestValues, (err, insertBarcodesRow) => {
            if (err) return res.status(500).json({ code: 1, descr: err.message })
            return res.status(200).json({ code: 1, descr: 'OK' })
        })
    })
})

// регистрация пользователя 
app.post('/ytrwerewpoyhgjkjsgskhgqrazxcvbnmjhdfgtyiuoplhjgdnb', function (req, res, next) {
    const login = req?.body?.login
    const name = req?.body?.name
    const surname = req?.body?.surname
    const jobtitle = req?.body?.jobtitle
    const company = req?.body?.company
    const role = req?.body?.role
    if (login.length > 15) return res.status(400).json({ request: 'error', message: 'Login is too long' })
    if (name.length > 15) return res.status(400).json({ request: 'error', message: 'Name is too long' })
    if (surname.length > 15) return res.status(400).json({ request: 'error', message: 'Surname is too long' })
    if (jobtitle.length > 30) return res.status(400).json({ request: 'error', message: 'Job title is too long' })
    if (company.length > 30) return res.status(400).json({ request: 'error', message: 'Company is too long' })
    // 'user' 'supervisor'
    console.log(role)
    if (!(role == 'supervisor' || role == 'user')) return res.status(400).json({ request: 'error', message: 'the role name is wrong' })
    db.run('SELECT * FROM users WHERE users_login = ?', [login], (err, row) => {
        if (err) return res.status(500).json({ request: 'error', message: err.message });
        // console.log('here it works')
        if (row.length != 0) return res.status(200).json({ request: 'bad', message: 'This login already exists' })
        var salt = crypto.randomBytes(16);
        crypto.pbkdf2(req.body.password, salt, 310000, 32, 'sha256', function (err, hashedPassword) {
            if (err) return res.status(500).json({ request: 'error', message: err.message })
            db.run('INSERT INTO users (users_login, users_name, users_surname, users_job_title, users_company, users_role, users_hashed_password, users_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
                login,
                name,
                surname,
                jobtitle,
                company,
                role,
                hashedPassword,
                salt
            ], function (err, rows) {
                if (err) return res.status(500).json({ request: 'error', message: err.message })
                res.status(200).json({ request: 'good', message: 'You are registered' })
            });
        });
    })
})

function preparationBeforeAuthentication(req, res, next) {
    (() => {
        // [getTimeForMySQL(now.setMilliseconds(now.getMilliseconds() - cleanConnectionsTime))]
        const now = new Date()
        db.run('DELETE FROM accessblockebylogin WHERE accessblockebylogin_time < ?', [getTimeForMySQL(now.setMilliseconds(now.getMilliseconds() - cleanBlokLogin))], (err) => {
            if (err) return res.status(500).json({ code: 'error', descr: err.message }) // надо будет согласовать 
            const { login, password } = req.body
            if (!password) return res.status(401).json({ code: 1, descr: "Поле пароля пустое", token: '' })
            db.run('SELECT * FROM accessblockebylogin WHERE users_id = (SELECT users_id FROM users WHERE users_login = ?)', [login], (err, selectAccessblockebyloginRow) => {
                if (selectAccessblockebyloginRow.length && selectAccessblockebyloginRow[0].accessblockebylogin_count >= numberOfAttempts) {
                    return res.status(403).json({ code: 1, descr: "Было несколько неудачных попыток аутентификации. Доступ к вашему аккаунту временно заблокирован." })
                }
                req.body.username = login
                next()
            })
        })
    })()
}

function userVerificationTokenAcquisition(req, res, next) {
    const login = req.body.username
    db.run('SELECT * FROM users WHERE users_login = ?', [login], (err, selectUsersRow) => {
        // code и descr
        // console.log('after select')
        if (err) return res.status(500).json({ code: 1, descr: 'Что-то пошло не так' }) // ответ нужно будет согласовать
        const now = getTimeForMySQL(new Date())
        db.run('INSERT INTO tokens (tokens_create_time, tokens_extension_time) VALUES (?, ?)', [now, now], (err, insertTokensRow) => {
            if (err) return res.status(500).json({ code: 'error', descr: err.message }) // ответ нужно будет согласовать
            const params = { login, userId: selectUsersRow[0].users_id, tokenId: insertTokensRow.insertId, role: selectUsersRow[0].users_role }
            res.status(200).json({
                code: 0,
                descr: 'OK',
                token: getTokenFunction(params, credentials.tokenSecret)(tokenExpire)
            }) // ответ нужно будетт согласовать
        })
    })
}
app.post('/flash/login',
    (req, res, next) => {
        (() => {
            // [getTimeForMySQL(now.setMilliseconds(now.getMilliseconds() - cleanConnectionsTime))]
            const now = new Date()
            db.run('DELETE FROM accessblockebylogin WHERE accessblockebylogin_time < ?', [getTimeForMySQL(now.setMilliseconds(now.getMilliseconds() - cleanBlokLogin))], (err) => {
                if (err) return res.status(500).json({ code: 1, descr: 'Что-то пошло не так' }) // надо будет согласовать 
                const { login, password } = req.body
                if (!password) return res.status(401).json({ code: 1, descr: "Поле пароль --- пустое", token: '' })
                db.run('SELECT * FROM accessblockebylogin WHERE users_id = (SELECT users_id FROM users WHERE users_login = ?)', [login], (err, selectAccessblockebyloginRow) => {
                    if (selectAccessblockebyloginRow.length && selectAccessblockebyloginRow[0].accessblockebylogin_count >= numberOfAttempts) {
                        return res.status(403).json({ code: 1, descr: "Было несколько неудачных попыток аутентификации. Доступ к вашему аккаунту временно заблокирован." })
                    }
                    req.body.username = login
                    next()
                })
            })
        })()
    },
    passport.authenticate('local', {
        failureRedirect: '/flash/loginfailer'
    }),
    (req, res, next) => {
        const login = req.body.username
        db.run('SELECT * FROM users WHERE users_login = ?', [login], (err, selectUsersRow) => {
            // code и descr
            // console.log('after select')
            if (err) return res.status(500).json({ code: 1, descr: "Что-то пошло не так" }) // ответ нужно будет согласовать
            const now = getTimeForMySQL(new Date())
            db.run('INSERT INTO tokens (tokens_create_time, tokens_extension_time) VALUES (?, ?)', [now, now], (err, insertTokensRow) => {
                if (err) return res.status(500).json({ code: 1, descr: "Что-то пошло не так" }) // ответ нужно будет согласовать
                const params = { login, userId: selectUsersRow[0].users_id, tokenId: insertTokensRow.insertId, role: selectUsersRow[0].users_role }
                res.status(200).json({
                    code: 0,
                    descr: 'OK',
                    token: getTokenFunction(params, credentials.tokenSecret)(tokenExpire)
                }) // ответ нужно будетт согласовать
            })
        })
    }
)

app.get('/flash/loginfailer', (req, res, next) => {
    return res.status(401).json({ code: 1, descr: 'Либо логин, либо пароль неверный', token: '' }); // ответ нужно будет согласовать
})

function closeSession(req, res, next) {
    const tokensID = req?.user?.tokenId
    if (!tokensID) return res.status(400).json({ code: 1, descr: 'Что-то пошло не так' })
    db.run('DELETE FROM tokens WHERE tokens_id = ?', [tokensID], (err, deleteTokensRow) => {
        if (err) return res.status(500).json({ code: 1, descr: 'Что-то пошло не так' }) // ответ нужно будет согласовать
        return res.status(200).json({ code: 0, descr: 'ok' })
    })
}

app.post('/flash/closeSession', authenticateToken, (req, res, next) => {
    const tokensID = req?.user?.tokenId
    if (!tokensID) return res.status(400).json({ code: 1, descr: 'Что-то пошло не так' })
    db.run('DELETE FROM tokens WHERE tokens_id = ?', [tokensID], (err, deleteTokensRow) => {
        if (err) return res.status(500).json({ code: 1, descr: 'Что-то пошло не так' }) // ответ нужно будет согласовать
        return res.status(200).json({ code: 0, descr: 'ОК' })
    })
})
/* 
DELETE 
если удалять нечего 
OkPacket {
  fieldCount: 0,
  affectedRows: 0,
  insertId: 0,
  serverStatus: 2,
  warningCount: 0,
  message: '',
  protocol41: true,
  changedRows: 0
}
если удалять есть что
OkPacket {
  fieldCount: 0,
  affectedRows: 1,
  insertId: 0,
  serverStatus: 2,
  warningCount: 0,
  message: '',
  protocol41: true,
  changedRows: 0
}

*/
app.post('/flash/getNewID', authenticateToken, tokenExtension, (req, res, next) => {
    // token, barcode, qrcode, type, role, 
    let { barcode, qrcode, type, role } = req.body
    if (!barcode || !qrcode || !type || !role) return res.status(400).json({ code: 1, descr: 'Неправильная структура запроса' }) // ответ согласовать
    // нужно будет провести проверку barcode, qrcode, type, role на соответсвие ЭТО НУЖНО СДЕЛАТЬ ОБЯЗАТЕЛЬНО!!!!
    barcode = Number(barcode)
    if (!['MASTER', 'SLAVE', 'NOTHING'].some(x => x === role)) return res.status(400).json({ code: 1, descr: 'Роль имеет неправильное название' })
    if (type.length > 4) return res.status(400).json({ code: 1, descr: 'Структура типа непривальная' })
    db.run('SELECT * FROM barcodes WHERE barcodes_id = ?', [barcode], (err, selectBarcodesRow) => {
        if (err) return res.status(500).json({ code: 1, descr: "Что-то пошло не так" }) // ответ нужно будет согласовать
        if (!selectBarcodesRow.length) return res.status(400).json({ code: 1, descr: 'Такого штрих-кода нет в базе' }) // ответ нужно будет согласовать
        db.run('SELECT * FROM qrcodes WHERE qrcodes_id = ?', [qrcode], (err, selectQrcodesRow) => {
            if (err) return res.status(500).json({ code: 1, descr: 'Что-то пошло не так' }) // ответ нужно будет согласовать
            if (!selectQrcodesRow.length) return res.status(400).json({ code: 1, descr: 'Такого qr-кода нет в базе' }) // ответ нужно будет согласовать
            db.run('SELECT * FROM devices WHERE devices_bar = ?', [barcode], (err, selectDevicesBarRow) => {
                if (err) return res.status(500).json({ code: 1, descr: 'Что-то пошло не так' }) // ответ нужно будет согласовать
                if (selectDevicesBarRow.length) return res.status(400).json({ code: 1, descr: 'Данный qr-код уже зарегестрирован' }) // ответ нужно согласовать
                db.run('SELECT * FROM devices WHERE devices_gr = ?', [qrcode], (err, selectDevicesQrRow) => {
                    if (err) return res.status(500).json({ code: 1, descr: "Что-то пошло не так" }) // ответ нужно будет согласовать
                    if (selectDevicesQrRow.length) return res.status(400).json({ code: 1, descr: 'Данный qr-код уже зарегестрирован' }) // ответ нужно согласовать
                    // req.user { login, userId: selectUsersRow[0].users_id, tokenId: insertTokensRow.insertId, role: selectUsersRow[0].users_role }
                    console.log(req.user)
                    db.run("INSERT INTO devices (devices_bar, devices_gr, devices_type, devices_role, devices_user_id) VALUES (?, ?, ?, ?, ?)", [barcode, qrcode, type, role, req.user.userId], (err, insertDevicesRow) => {
                        // ER_DUP_ENTRY -- такое сообщение если оба данных дублируются
                        // ER_DUP_ENTRY -- такое сообщине если только одно поле с данным дублируется
                        if (err?.code === "ER_DUP_ENTRY") return res.status(400).json({ code: 1, descr: 'Датчик с таким qr-кодом или штрих-кодом уже был зарегистрирован' }) // надо проверить как работает
                        if (err) return res.status(500).json({ code: 1, descr: 'Что-то пошло не так' }) // ответ нужно будет согласовать
                        return res.status(200).json({ code: 0, descr: 'OK', id: insertDevicesRow.insertId })
                    })
                })
            })
        })
    })
})

app.post('/flash/setMAC', authenticateToken, tokenExtension, (req, res, next) => {
    let { id, mac } = req.body
    if (!id || !mac) return res.status(400).json({ code: 1, descr: 'Неправильная структура запроса' }) // ответ согласовать
    id = Number(id)
    // ожидается структура mac с разделителями двоеточия
    if (!/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(mac)) return res.status(400).json({ code: 1, descr: 'MAC-адрес имеет неверную структуру' })
    db.run('SELECT * FROM devices WHERE devices_mac = ?', [mac], (err, selectDevicesMacRow) => {
        if (err) return res.status(500).json({ code: 1, descr: "Что-то пошло не так" }) // ответ нужно будет согласовать
        if (selectDevicesMacRow.length) return res.status(400).json({ code: 1, descr: 'Данный mac-адрес уже был зарегестрирован' }) // ответ нужно согласовать
        db.run('SELECT * FROM devices WHERE devices_id = ?', [id], (err, selectDevicesIdRow) => {
            if (err) return res.status(500).json({ code: 1, descr: "Что-то пошло не так" }) // ответ нужно будет согласовать
            if (selectDevicesIdRow[0].devices_user_id !== req.user?.userId) return res.status(400).json({ code: 1, descr: 'Данный пользовател не регисрировал данный девайс' }) // ответ нужно будет согласовать
            db.run('UPDATE devices SET devices_mac = ? WHERE devices_id = ?', [mac, id], (err, updateDevicesMacRow) => {
                if (err?.code === "ER_DUP_ENTRY") return res.status(400).json({ code: 1, descr: 'Датчик с таким mac-адресом уже был зарегестрироват ранее' }) // надо проверить как работает
                if (err) return res.status(500).json({ code: 1, descr: 'Что-то пошло не так' }) // ответ нужно будет согласовать
                return res.status(200).json({ code: 0, descr: 'OK' })
            })
        })

    })
})

app.post('/flash/prodReport', authenticateToken, tokenExtension, (req, res, next) => {
    // oken, id, prodTime и fwVersion
    // let {id, prodTime, fwVersion} = req?.body
    const body = req?.body
    const id = Number(body?.id)
    const prodTime = body?.prodTime
    const fwVersion = body?.fwVersion
    if (!id || !prodTime || !fwVersion) return res.status(400).json({ code: 1, descr: 'Неправильная структура запроса' }) // ответ согласовать
    // надо проверить формат полученных данных
    db.run('SELECT * FROM devices WHERE devices_id = ?', [id], (err, selectDevicesIdRow) => {
        if (err) return res.status(500).json({ code: 'error', descr: err.message }) // ответ нужно будет согласовать
        if (selectDevicesIdRow[0].devices_user_id !== req.user?.userId) return res.status(400).json({ code: 1, descr: 'Данный пользовател не регисрировал данный девайс' }) // ответ нужно будет согласовать
        db.run("UPDATE devices SET devices_prodtime = ?, devices_fwversion = ? WHERE devices_id = ?", [prodTime, fwVersion, id], (err, updateDevices) => {
            if (err) return res.status(500).json({ code: 1, descr: "Что-то пошло не так" }) // ответ нужно будет согласовать
            return res.status(200).json({ code: 0, descr: 'OK' }) // ответ нужно будет согласовать
        })
    })
})

app.post('/reset/login', preparationBeforeAuthentication, passport.authenticate('local', {
    failureRedirect: '/reset/loginfailer'
}), userVerificationTokenAcquisition)

app.get('/reset/loginfailer', (req, res, next) => {
    return res.status(401).json({ code: 1, descr: 'Неправильный логин или пароль', token: '' }); // ответ нужно будет согласовать
})

app.post('/reset/closeSession', authenticateToken, closeSession)

app.post('/reset/deleteID', authenticateToken, tokenExtension, (req, res, next) => {
    // role body.user.role
    const body = req?.body

    if (req.user?.role !== 'supervisor') return res.status(400).json({ code: 1, descr: 'У Вас нет прав на это действие' })

    const field = body?.field
    const value = body?.value
    if (!field || !value) return res.status(400).json({ code: 1, descr: 'Неправильная структура запроса' }) // ответ согласовать

    const dataList = [{ request: 'barcode', db: 'devices_bar' }, { request: 'qrcode', db: 'devices_gr' }, { request: 'mac', db: 'devices_mac' }, { request: 'id', db: 'devices_id' }]
    let dbName = ''
    let requestName = ''
    if (!dataList.some(element => {
        dbName = element.db
        requestName = element.request
        return field === element.request
    })) return res.status(400).json({ code: 1, descr: 'Структура запроса неправильная' }) // ответ согласовать
    db.run(`SELECT * FROM devices WHERE ${dbName} = ?`, [value], (err, selectDevicesRow) => {
        if (err) return res.status(500).json({ code: 1, descr:  "Что-то пошло не так"}) // ответ нужно будет согласовать
        if (!selectDevicesRow.length) return res.status(400).json({ code: 1, descr: 'Устройство с таким параметрам не зарегистрировано' }) // ответ согласовать
        /* 
        selectQrcodesRow
        [ RowDataPacket { 'MAX(qrcodes_id)': 1 } ] 
        
        [ RowDataPacket { 'MAX(qrcodes_id)': null } ] -- если записей нет
        */
        // selectDevicesRow[0]
        /*
        deleteddevices_id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,

  deleteddevices_devices_id INT UNSIGNED NOT NULL,

  deleteddevices_devices_bar VARCHAR(15), -- уточнить формат
  deleteddevices_devices_gr VARCHAR(2953) CHARACTER SET latin1, -- уточнить формат
  deleteddevices_devices_type VARCHAR(4) , -- уточнить формат
  deleteddevices_devices_role ENUM('MASTER', 'SLAVE', 'NOTHING'), -- уточнить формат
  deleteddevices_devices_mac  CHAR(17),
  deleteddevices_devices_prodtime VARCHAR(30), -- уточнить формат
  deleteddevices_devices_fwversion VARCHAR(30), -- уточнить формат
  
  deleteddevices_devices_user_id INT UNSIGNED NOT NULL, -- это тот пользователь который ЗАВЕЛ учетную запись для данного устройства
  deleteddevices_devices_time TIMESTAMP, -- это дата регистрации устройства
  deleteddevices_user_id INT UNSIGNED NOT NULL, -- это тот ползователь, который удалил эту запись
*/
        /* 
        req.user = decoded;
                    // console.log(decoded) // { username: 'vasa', iat: 1707980883, exp: 1710572883 } я еще добавил другое свойство 
                    // { login, userId: selectUsersRow[0].users_id, tokenId: insertTokensRow.insertId }
        */
        const devicesDataArr = [
            { value: selectDevicesRow[0].devices_id, dbName: 'deleteddevices_devices_id' },
            { value: selectDevicesRow[0].devices_bar, dbName: 'deleteddevices_devices_bar' },
            { value: selectDevicesRow[0].devices_gr, dbName: 'deleteddevices_devices_gr' },
            { value: selectDevicesRow[0].devices_type, dbName: 'deleteddevices_devices_type' },
            { value: selectDevicesRow[0].devices_role, dbName: 'deleteddevices_devices_role' },
            { value: selectDevicesRow[0].devices_mac, dbName: 'deleteddevices_devices_mac' },
            { value: selectDevicesRow[0].devices_prodtime, dbName: 'deleteddevices_devices_prodtime' },
            { value: selectDevicesRow[0].devices_fwversion, dbName: 'deleteddevices_devices_fwversion' },
            { value: selectDevicesRow[0].devices_user_id, dbName: 'deleteddevices_devices_user_id' },
            { value: selectDevicesRow[0].time_, dbName: 'deleteddevices_devices_time' },
            { value: req.user.userId, dbName: 'deleteddevices_user_id' }
        ].filter(elem => elem.value)

        let sqlRequestFirstPart = ``
        let sqlRequestValues = ``
        const sqlRequestValuesArr = []
        for (let i = 0; i < devicesDataArr.length; i++) {
            sqlRequestValuesArr.push(devicesDataArr[i].value)
            if (i !== 0) {
                sqlRequestFirstPart += ', '
                sqlRequestValues += ', '
            }
            sqlRequestFirstPart += devicesDataArr[i].dbName
            sqlRequestValues += '?'
        }
        db.run(`INSERT INTO deleteddevices (${sqlRequestFirstPart}) VALUES (${sqlRequestValues})`, sqlRequestValuesArr, (err, insertDeleteddevices) => {
            if (err) return res.status(500).json({ code: 1, descr: 'Что-то пошло не так' }) // ответ нужно будет согласовать
            db.run(`DELETE FROM devices WHERE ${dbName} = ?`, [value], (err, deleteDevicesRow) => {
                if (err) {
                    db.run(`DELETE FROM deleteddevices WHERE deleteddevices_id = ?`, [insertDeleteddevices.insertId], () => { })
                    return res.status(500).json({ code: 1, descr: 'Что-то пошло не так' }) // ответ нужно будет согласовать
                }
                const jsonResponse = { code: 0, descr: 'ОК', needErase: 'no' } // ответ нужно будет согласовать
                if (selectDevicesRow[0].devices_mac) jsonResponse.needErase = 'yes'
                return res.status(200).json(jsonResponse)
            })
        })
    })
})

/*
app.post('/api/signup', function (req, res, next) {
    const username = req.body.username
    db.run('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) return res.status(500).json({ request: 'error', message: err.message });
        if (row.length != 0) return res.status(200).json({ request: 'bad', message: 'This login already exists' })
        var salt = crypto.randomBytes(16);
        crypto.pbkdf2(req.body.password, salt, 310000, 32, 'sha256', function (err, hashedPassword) {
            if (err) return res.status(500).json({ request: 'error', message: err.message })
            db.run('INSERT INTO users (username, hashed_password, salt, email) VALUES (?, ?, ?, ?)', [
                username,
                hashedPassword,
                salt,
                req.body.email
            ], function (err, rows) {
                if (err) return res.status(500).json({ request: 'error', message: err.message })
                // const token = jwt.sign({ username }, credentials.tokenSecret, { expiresIn: tokenExpire })
                // const longToken = jwt.sign({ username }, credentials.longTokenSecret, { expiresIn: longTokenExpire })
                // res.status(200).json({ request: 'good', message: 'You are registered', token, longToken });
                return forSignupAPI(req, res, next, db, rows.insertId)
            });
        });
    })
})
*/

/*
app.post('/api/login/password', passport.authenticate('local', {
    failureRedirect: '/api/loginfailer'
}), (req, res, next) => {
    const username = req.body.username
    db.run('SELECT * FROM users WHERE username = ?', [username], (err, rows) => {
        if (err) return res.status(500).json({ request: 'error', message: err.message })
        return forSignupAPI(req, res, next, db, rows[0].id)
    })

    // const token = jwt.sign({ username }, credentials.tokenSecret, { expiresIn: tokenExpire })
    // const longToken = jwt.sign({ username }, credentials.longTokenSecret, { expiresIn: longTokenExpire })
    // res.status(200).json({ request: 'good', message: 'You are registered', token, longToken });
});
// app.post('/api/test', passport.authenticate('jwt', { session: false }), (req, res) => {
//     const login = req.user.login;
//     res.status(200).json({ login });
// });
app.get('/api/loginfailer', (req, res, next) => {
    res.status(200).json({ request: 'bad', message: 'Not right login of pass' });
})
*/

/*
app.post('/api/logout', authenticateToken, (req, res, next) => { // по данному урлу мы не можем сделать токен не действительным, мы просто удаляем запись об подключенных устройствах
    // req.user -- здесь хранятся данные после расшифровки из токена
    db.run('UPDATE connections SET delete_ = 1 WHERE id = ?', [req.user.connectionId], (err, rows) => {
        if (err) return next(err)
        res.status(200).json({ request: 'good', message: 'Your gadget is not on air' })
    })
})
*/

/*
app.post('/api/refreshtoken', authenticateLongToken, (req, res, next) => { // от клиента должен приходить параметер longToken.
    const { username, connectionId, usersId } = req.user
    const params = { username, connectionId, usersId }
    // const getToken = (tokenExpire) => {
    //     return jwt.sign({ username, usersId, connectionId }, credentials.tokenSecret, { expiresIn: tokenExpire })
    // }
    // const token = jwt.sign({ username, usersId, connectionId }, credentials.tokenSecret, { expiresIn: tokenExpire })
    // const longToken = jwt.sign({ username, usersId, connectionId }, credentials.longTokenSecret, { expiresIn: longTokenExpire })
    // res.status(200).json({ 
    //     request: 'good', 
    //     message: 'You are registered', 
    //     token: getToken(tokenExpire), 
    //     longToken: getToken(longTokenExpire)  
    // })
    // const getToken = getTokenFunction({ username, connectionId,  usersId }, )
    res.status(200).json({
        request: 'good',
        message: 'You are registered',
        // token: getToken(tokenExpire), 
        // longToken: getToken(longTokenExpire)  
        token: getTokenFunction(params, credentials.tokenSecret)(tokenExpire),
        longToken: getTokenFunction(params, credentials.longTokenSecret)(longTokenExpire)
    })
})

*/

/*
app.post('/api/test', authenticateToken, (req, res) => { // это реально тестовая вещь
    // const username = req.user.username;
    // res.status(200).json({ username });
    const user = req.user
    res.status(200).json(user)
})
*/

// usersId, connectionId: rows.insertId

/*
app.post('/api/sendemailpass', (req, res, next) => { // в данном запросе мы не ждем токен, потому что  это восстановление пароля и пользователь не помнить ничего кроме логина
    
    // по данному запросу мы не проводим регистрацию пользователя в подключенных, потому что он еще не авторизован
    
    const { username } = req.body


    db.run('SELECT email FROM users WHERE username = ?', [username], (err, rows) => {
        if (err) return res.status(500).json({ request: 'error', message: err.message });
        if (rows.length !== 1) return res.status(500).json({ request: 'error', message: 'Username is error' })

        // const resetToken = jwt.sign({ username }, credentials.emailTokenSecret, { expiresIn: emailTokenExpire })
        // const resetToken = getTokenFunction({ username }, credentials.emailTokenSecret)(emailTokenExpire)
        const url = `${httpProtocol}://${domen}:${port}/api/${urlResetPass}/${getTokenFunction({ username }, credentials.emailTokenSecret)(emailTokenExpire)}`
        // в строке выше мы передали функции getTokenFunction объект с одним свойством username, но в случае необходимости можем передать и еще какие-нибудь
        const mailOptions = {
            from: yourEmail,
            to: rows[0].email,
            subject: 'Password Reset',
            text: `To reset your password, click on the following link: ${url}`, // теги не работают надо как-то по другому
            html: `<!doctype html>
            <html>
              <head>
                <meta charset="utf-8">
                <style>
                    h1 {
                        color: red;
                    }
                </style>
              </head>
              <body>
                <h1>Hi</h1>
                <p>To reset your password, click on : <a href='${url}'>the following link</a></p>
              </body>
            </html>`,
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error) // Greeting never received Приветствие так и не получено
                console.log(`${yourEmail} --- yourEmail`)
                console.log(`${rows[0].email} --- rows[0].email`)
                return res.status(500).json({ request: 'error', message: 'Failed to send password reset email' });
            }
            res.status(200).json({ request: 'good', message: 'Password reset email sent successfully' });
        });
    })
})

*/

/*
app.get(`/api/${urlResetPass}/:token`, (req, res, next) => {
    const { token } = req.params;
    jwt.verify(token, credentials.emailTokenSecret, (err, decoded) => {
        if (err) return res.status(400).json({ request: 'error', message: 'Invalid or expired reset token' });
        const params = decoded

        params.layout = null // это добавлен параметер сообщающий, что в шаблоне не нужно использовать шаблон
        params.token = token
        return res.render('reset-pass', params)
    })
})
*/

/*
app.post('/api/reset-pass', (req, res, next) => {
    const { token, password } = req.body
    console.log('this token', token)
    console.log(password)
    jwt.verify(token, credentials.emailTokenSecret, (err, decoded) => {
        if (err) return res.status(400).json({ request: 'error', message: 'Invalid or expired reset token' });
        const { username } = decoded
        const salt = crypto.randomBytes(16);
        crypto.pbkdf2(password, salt, 310000, 32, 'sha256', function (err, hashedPassword) {
            if (err) return res.status(500).render('error')
            db.run('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
                if (err) return res.status(500).render('error')
                if (row.length !== 1) return res.status(500).render('error')
                const id = row[0].id
                db.run('UPDATE users SET hashed_password = ?, salt = ? WHERE id = ?', [
                    hashedPassword,
                    salt,
                    id
                ], function (err, row) {
                    if (err) return res.status(500).render('error')


                    // const token = jwt.sign({ username }, credentials.tokenSecret, { expiresIn: tokenExpire })
                    // const longToken = jwt.sign({ username }, credentials.longTokenSecret, { expiresIn: longTokenExpire })

                    // res.status(200).json({ request: 'good', message: 'You are registered', token, longToken });

                    // res.status(200).json({ 
                    //     request: 'good', 
                    //     message: 'You are registered', 
                    //     token:      getTokenFunction(params, credentials.tokenSecret)(tokenExpire), 
                    //     longToken:  getTokenFunction(params, credentials.longTokenSecret)(longTokenExpire) 
                    // })
                    return forResAPI(req, res, next, db, id, username) // это неправильно, что я сделал здесь возврат json. Здесь надо возращать страничку с сообщением о том что все хорошо.
                })
            })

        })
    })
})
    */


// app.post('/api/experiment-db', (req, res, next) => {
//     const { data } = req.body
//     db.run('UPDATE experiment SET data = ? WHERE id = 2', [data], (err, row) => {
//         console.log(row)
//     })
// })
// app.post('/api/test', authenticateToken, (req, res) => {
//     const login = req.user.login;
//     res.status(200).json({ login });
// });

// это тестовый участок кода
// app.post('/modapi/response', (req, res, next) => {
//     console.log(req.body)
//     res.json({ "lkjlkj": 12 })
// })
app.get('/testform', (req, res, next) => res.render('testform'))
// пишу адрес странички чтобы удобней было копировать http://localhost:3000/testform
// https://localhost/testform
// это конец тестового участка кода
// app.get('/fail', (req, res) => {
//     throw new Error('Nope!')
// })
// app.get('/epic-fail', (req, res) => {
//     process.nextTick(() => {
//         throw new Error('Kaboom!')
//     })
//     res.send('embarrased')
// })
// custom 404 page
app.use((req, res) => {
    res.type('text/plain')
    res.status(404)
    res.send('404 - Not Found')
})
// custom 500 page
app.use((err, req, res, next) => {
    console.error(err.message, err.stack)
    res.type('text/plain')
    res.status(500)
    res.send('500 - Server Error')
})

// export NODE_ENV=production
// npm install -g forever
// forever start app.js
// forever restart app.js
// forever stop app.js
// rm -r -- удаление директории со все содержимым

process.on('uncaughtException', err => {
    console.error('UNCAUGHT EXCEPTION\n', err.stack);
    // сюда нужно вставить действия которые нужно закончить до того, как сервер ляжет
    process.exit(1)
})
function startServer(port) {
    app.listen(port, '127.0.0.1', () => console.log(
        `Express started on http://localhost:${port}; ` +
        ` ${app.get('env')} ` +
        `press Ctrl-C to terminate.`))
    /* Этот закомментированный код может быть использован в случае, если потребуется https без nginx */
    // https.createServer(options, app).listen(port, () => {
    //     console.log(`Express started in ${app.get('env')} mode ` +
    //         `on port + ${port}. On httpS https://localhost:${port}`)
    // })
}
if (require.main === module) {
    // application run directly; start app server
    startServer(process.env.PORT || 3000)
} else {
    // application imported as a module via "require": export
    // function to create server
    module.exports = startServer
}