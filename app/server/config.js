const oneHour = 60 * 60 // в секундах
const oneMinutesMMSecond = 60 * 1000 // в миллисекундах
const oneHourMMSecond = oneHour * 1000 // в миллисекундах
const oneDaySecond = oneHour * 24 // в секундах
const oneDayMMSecond = oneDaySecond * 1000 // в миллисекундах

module.exports = { 
    credentials: require(`./.credentials.${process.env.NODE_ENV || 'development'}`), 
    // это БД с данными
    host: 'localhost', 
    user: 'admin_getAssistInside', 
    password: 'Vagon_3611',
    database: 'getAssistInside',

    
    cleanBlokLogin: oneMinutesMMSecond * 5, // 5 минут // время на которое ограничивается попытки аутентификации пользователя после неудачных попыток
    numberOfAttempts: 5, // количество неудачных попыток ввода пароля для данного логини, после которого включается таймаут на новую попытку входа в систему

    tokenExpire: oneDaySecond, // 1 день -- срок истечения токена
    
    // это БД с сессиями
    sessionHost: 'localhost',
    sessionUser: 'admin_sessions',
    sessionPassword: 'Vagon_3611',
    sessionDatabase: 'sessions',
    longTokenExpire: oneDaySecond * 90, // 90 дней

    
    emailTokenExpire: oneDaySecond * 3, // 3 дня
    domen: 'localhost',
    yourEmail: 'sagan.sergei.mih@yandex.ru', // здесь должен быть реальный адрес с которого делается отправка, 
    httpProtocol: 'http',
    sessionCookiesExpirationMM: oneDayMMSecond * 1,  // 1 день
    // cleanConnectionsTime: oneDayMMSecond * 1, // 1 day
    cleanConnectionsTime: oneMinutesMMSecond * 2, // 
    
    // отправка почты
    smtpKey: 'wgsfizmubelvmdly', // это ключ для сервера отправки почты в данном случае на яндексе
    smtpHost: 'smtp.yandex.ru',
    smtpPort: 465,
    smtpUser: 'sagan.sergei.mih',

    // это строка, которая подставляется, если не известен user-agent
    unknownUserAgent: 'unknown'
}
