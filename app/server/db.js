const mysql = require('mysql')
const { host, user, password, database } = require('./config')
const db = {
    run(query, paramArr, fun) { // запрос должен быть выполнен в виде строки с интерполяцией переменных в виде элементов массива paramArr
        const innerFun = function (err, rows, fields) {
            fun(err, rows)
        }
        const connection = mysql.createConnection({
            host,
            user,
            password,
            database
        })
        connection.connect()
        connection.query(query, paramArr, innerFun)
        connection.end()
    }
}
module.exports = db;