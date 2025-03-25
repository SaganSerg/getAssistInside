DROP database getAssistInside;
DROP database getAssistInsideSessions;
-- посмотреть базы данный SHOW databases;
-- поcмотреть таблицы в базе данных USE chiptuning; SHOW tables;
-- посмотреть структуру таблицы DESC называние_таблицы 
-- SELECT quantity_discount_order_left FROM quantity_discount WHERE discount_id = ? ORDER BY quantity_discount_id DESC LIMIT 1
-- ALTER TABLE device ADD device_common_id INT UNSIGNED NOT NULL;
-- ALTER TABLE table_name AUTO_INCREMENT = 1;
-- DROP TABLE sometable;
CREATE DATABASE getAssistInside CHARACTER SET utf8mb4 COLLATE = utf8mb4_unicode_ci;
CREATE USER 'admin_getAssistInside'@'localhost' IDENTIFIED BY 'Vagon_3611'; -- RekbyfhElfhbkCkjyf
GRANT SELECT, INSERT, UPDATE, DELETE  ON getAssistInside.* TO 'admin_getAssistInside'@'localhost';

ALTER USER 'admin_getAssistInside'@'localhost' IDENTIFIED WITH mysql_native_password BY 'Vagon_3611'; -- RekbyfhElfhbkCkjyf

USE getAssistInside;

CREATE TABLE barcodes
(
  barcodes_id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
  barcodes_value VARCHAR(15) NOT NULL UNIQUE
  /* 
  была проблема с тем, чтобы по штрих-коду нельзя было узнать никаких данных. Надо уточнить в чем была проблема.
  И нужно ли ее решать вообще
  */
)
ENGINE=INNODB;
/* 
INSERT INTO barcodes (barcodes_value) VALUES (5);
INSERT INTO barcodes (barcodes_value) VALUES (LAST_INSERT_ID() + 1);
*/
-- ALTER TABLE barcodes AUTO_INCREMENT = 1;
CREATE TABLE qrcodes
(
  qrcodes_id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
  -- qrcodes_value VARCHAR(2953) NOT NULL UNIQUE
  -- Specified key was too long; max key length is 3072 bytes
  -- такая ошибка была потому, что у нас использоватлся utf8mb4, а он 4 байта, вот и получилось 3072/4 = 768
  -- qrcodes_value VARCHAR(768) NOT NULL UNIQUE
  qrcodes_value VARCHAR(2953) CHARACTER SET latin1 NOT NULL UNIQUE
)
ENGINE=INNODB;
/* 
INSERT INTO qrcodes (qrcodes_value) VALUES (1);
INSERT INTO qrcodes (qrcodes_value) VALUES (LAST_INSERT_ID() + 1);
*/
-- ALTER TABLE qrcodes AUTO_INCREMENT = 1;
CREATE TABLE users
(
  users_id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
  users_login VARCHAR(60) NOT NULL UNIQUE,

  users_name VARCHAR(60) NOT NULL,
  users_surname VARCHAR(60) NOT NULL,
  users_job_title VARCHAR(120) NOT NULL,
  users_company VARCHAR(120) NOT NULL,
  users_role VARCHAR (120) NOT NULL, -- 'user' 'supervisor'
  users_hashed_password BLOB NOT NULL,
  users_salt BLOB NOT NULL,
  
  time_ TIMESTAMP DEFAULT(NOW()),
  delete_ SMALLINT DEFAULT 0
)
ENGINE=INNODB;
/* INSERT INTO users (users_login, users_name, users_syrname, users_job_title, users_company, users_hashed_password, users_salt) VALUES (
'vasa', 'Василий', 'Иванов', 'инженер', 'apple', '', '')
*/

CREATE TABLE tokens -- здесь хранятся id токенов, для того чтобы можно было отслеживать "живые" токены
/* каждый раз когда приходит запрос с токеном из него извлекается id. По которому мы смотрим когда с этим токеном последний раз приходил запрос. И если это время ПРИЕМЛЕМОЕ (предполагалось, что это 10 минут), то мы обновляем tokens_extension_time */
(
  tokens_id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
  tokens_create_time TIMESTAMP NOT NULL, -- это временная метка, которая создается в момент создания токена
  tokens_extension_time TIMESTAMP NOT NULL, -- это временная метка создается в момент "продления" токена

  time_ TIMESTAMP DEFAULT(NOW())
)
ENGINE=INNODB;

CREATE TABLE accessblockebylogin -- здесь храниться id aккаунта с которого должно быть ограничено доступ при попытке войти по логину и паролю
-- это нужно для того, чтобы предотвратить попытки взлома будфорсем
(
  accessblockebylogin_id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
  accessblockebylogin_count TINYINT NOT NULL,
  users_id INT UNSIGNED NOT NULL UNIQUE,
  accessblockebylogin_time TIMESTAMP NOT NULL,

  time_ TIMESTAMP DEFAULT(NOW()),

  FOREIGN KEY (users_id) REFERENCES users(users_id)
)
ENGINE=INNODB;
CREATE TABLE accessblockebyip -- здесь храниться ip с которого должно быть ограничено доступ при попытке войти по логину и паролю
-- это нужно для того, чтобы предотвратить попытки взлома будфорсем
/* 
При каждом запросе на аутентификацию по логин-пароль сначала выявляется ip-щник с которого был запрос. 

Потом проходит проверка данного ip-шника о том, не состоит ли он в таблице заблокированных т.е. проверяется сам факт нахождения в таблице а так же accessblockebyip_count на предмет НЕ превышения лимита. если лимит превышен то мы проверяем временную метку для данной записи и если она была посталена не ранее установленного срока то мы не проверяем корректность логин-пароль, а тупо возвращаем сообщение о том, что достпуп временно заблокирован из-за неоднократный ошибочных попыток.

*/
(
  accessblockebyip_id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
  accessblockebyip_value VARCHAR(39) NOT NULL UNIQUE, -- это значение ip-ка
  accessblockebyip_count TINYINT NOT NULL, -- это счетчик. Здесь указывается количество попыток ввода логин-пароль с данного ip
  accessblockebyip_time TIMESTAMP NOT NULL, -- временная метка изменения записи (значение изменяется при любом изменении записи)

  time_ TIMESTAMP DEFAULT(NOW())
)
ENGINE=INNODB;

CREATE TABLE devices 
(
  devices_id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
  devices_bar VARCHAR(15) UNIQUE, -- уточнить формат
  devices_gr VARCHAR(2953) CHARACTER SET latin1 UNIQUE, -- уточнить формат
  devices_type VARCHAR(4), -- уточнить формат
  devices_role ENUM('MASTER', 'SLAVE', 'NOTHING'), -- уточнить формат
  devices_mac  CHAR(17) UNIQUE,
  devices_prodtime VARCHAR(30), -- уточнить формат
  devices_fwversion VARCHAR(30), -- уточнить формат
  devices_user_id INT UNSIGNED NOT NULL,

  time_ TIMESTAMP DEFAULT(NOW()),

  FOREIGN KEY (devices_bar) REFERENCES barcodes(barcodes_value),
  FOREIGN KEY (devices_gr) REFERENCES qrcodes(qrcodes_value),
  FOREIGN KEY (devices_user_id) REFERENCES users(users_id)
)
ENGINE=INNODB;

CREATE TABLE deleteddevices
(
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

  time_ TIMESTAMP DEFAULT(NOW()), -- это дата удаления записи об устройстве

  FOREIGN KEY (deleteddevices_devices_bar) REFERENCES barcodes(barcodes_value),
  FOREIGN KEY (deleteddevices_devices_gr) REFERENCES qrcodes(qrcodes_value),
  FOREIGN KEY (deleteddevices_devices_user_id) REFERENCES users(users_id),
  FOREIGN KEY (deleteddevices_user_id) REFERENCES users(users_id)
)
ENGINE=INNODB;
-- utc_timestamp() -- возвращает текущую метку времени
-- current_timestamp() -- возвращает тукущую метку времени
-- надо будет периодически очищать в ручную, а то слишком большой станет


CREATE TABLE experiment
(
  id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
  something VARCHAR(15) NOT NULL UNIQUE,
  otherthing VARCHAR(15) NOT NULL UNIQUE
)
ENGINE=INNODB;

CREATE TABLE experiment2
(
  id INT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
  something VARCHAR(15) UNIQUE,
  otherthing VARCHAR(15) UNIQUE
)
ENGINE=INNODB;



CREATE DATABASE getAssistInsideSessions;
CREATE USER 'admin_getAssistInsideSessions'@'localhost' IDENTIFIED BY 'Vagon_3611';
GRANT SELECT, INSERT, UPDATE, DELETE  ON sessions.* TO 'admin_getAssistInsideSessions'@'localhost';
ALTER USER 'admin_getAssistInsideSessions'@'localhost' IDENTIFIED WITH mysql_native_password BY 'Vagon_3611';

USE sessions;

CREATE TABLE `sessions` 
(
  `session_id` varchar(128) COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` mediumtext COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB;

-- данная таблица заведена для того, чтобы быстро починить сервак. По хорошему она должна называться getAssistInsideSessions и в конфигах JS нужно будет исправить.
CREATE DATABASE getAssistInsideSessions;
CREATE USER 'admin_getAssistInsideSessions'@'localhost' IDENTIFIED BY 'Vagon_3611';
GRANT SELECT, INSERT, UPDATE, DELETE  ON sessions.* TO 'admin_getAssistInsideSessions'@'localhost';
ALTER USER 'admin_getAssistInsideSessions'@'localhost' IDENTIFIED WITH mysql_native_password BY 'Vagon_3611';

USE sessions;

CREATE TABLE `sessions` 
(
  `session_id` varchar(128) COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` mediumtext COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB;
