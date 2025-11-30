# Node Happ Decryptor

Node.js (ESM) модуль для шифрования и дешифрования ссылок Happ с использованием RSA-шифрования (PKCS1v15).

## Возможности

- **RSA Encryption/Decryption**: Использует стандарт `RSA_PKCS1_PADDING`.
- **Link Parsing**: Поддерживает парсинг форматов `happ://crypt/...`, `happ://crypt2/...`, `happ://crypt3/...`.
- **Smart Decryption**: Реализует логику автоматического перебора версий. Если дешифровка указанной версией не удалась, модуль пытается использовать доступные ключи в порядке: указанная версия → `crypt` → `crypt2` → `crypt3`.
- **Flexible Key Loading**: Поддерживает загрузку ключей как через прямой ввод PEM-строк, так и через указание путей к файлам.
- **ESM**: Реализован как стандартный ECMAScript модуль.

## Установка

```bash
npm i node-happ-decryptor
```

## Использование

### Дешифрование

При инициализации необходимо передать объект с приватными ключами. Версия ключа (`crypt`, `crypt2`, `crypt3`) определяется ключом свойства в объекте.

```javascript
import HappProcessor from 'node-happ-decryptor';

// Конфигурация: ключи могут быть переданы как пути к файлам или как содержимое PEM
const privateKeys = {
    crypt3: './keys/private_crypt3.pem',       // Путь к файлу
    crypt: '-----BEGIN RSA PRIVATE KEY-----...' // Строка PEM
};

const processor = new HappProcessor(privateKeys);
const link = 'happ://crypt3/OSNoL4qDcgEdum...';

try {
    const result = processor.decrypt(link);
    
    console.log('Decrypted Data:', result.decryptedData);
    console.log('Key Version Used:', result.usedKey);
    console.log('Link Version:', result.version);
} catch (err) {
    console.error('Decryption failed:', err.message);
}
```

### Шифрование

Для шифрования требуется объект с публичными ключами.

```javascript
import HappProcessor from 'node-happ-decryptor';

const publicKeys = {
    crypt3: './keys/public_crypt3.pem'
};

// Первый аргумент (privateKeys) можно оставить пустым, если требуется только шифрование
const processor = new HappProcessor({}, publicKeys);

try {
    const result = processor.encrypt('my secret data', 'crypt3');
    
    console.log('Generated Link:', result.link);
} catch (err) {
    console.error(err.message);
}
```

## Логика дешифрования

Модуль использует механизм отката (fallback) при выборе ключа. Если ссылка содержит указание на версию `happ://crypt/...`, но соответствующий ключ отсутствует или не подходит, дешифратор выполнит попытки в следующей последовательности:
1. Версия, указанная в ссылке.
2. `crypt`
3. `crypt2`
4. `crypt3`

Результат возвращается при первом успешном совпадении.

## API

### `new HappProcessor(privateKeys, publicKeys)`
Конструктор класса.
- **privateKeys**: Объект `{ [version]: pathOrString }`. Используется для дешифрования.
- **publicKeys**: Объект `{ [version]: pathOrString }`. Используется для шифрования.

### `.decrypt(link)`
Дешифрует входящую строку.
- **link**: Строка формата `happ://...`.
- **Возвращает**: Объект `{ version, usedKey, decryptedData }`.
- **Исключения**: Выбрасывает `Error`, если формат неверен или подходящий ключ не найден.

### `.encrypt(data, version)`
Шифрует данные указанным ключом.
- **data**: Строка данных.
- **version**: Версия ключа (должна присутствовать в `publicKeys`).
- **Возвращает**: Объект `{ version, encryptedData, link }`.

## Автор

[t.me/OpexDev](https://t.me/OpexDev)