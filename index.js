import crypto from 'node:crypto';
import fs from 'node:fs';

const LINK_REGEX = /^happ:\/\/(crypt|crypt2|crypt3|crypt4)\/(.+)$/;
const FALLBACK_ORDER = ['crypt', 'crypt2', 'crypt3', 'crypt4'];

export default class HappProcessor {
    constructor(privateKeys = {}, publicKeys = {}) {
        this.privateKeys = {};
        this.publicKeys = {};

        for (const [version, keyOrPath] of Object.entries(privateKeys)) {
            this.privateKeys[version] = this._resolveKey(keyOrPath);
        }

        for (const [version, keyOrPath] of Object.entries(publicKeys)) {
            this.publicKeys[version] = this._resolveKey(keyOrPath);
        }
    }

    _resolveKey(input) {
        if (!input) return null;
        const trimmed = input.trim();
        if (trimmed.startsWith('-----BEGIN')) {
            return trimmed;
        }
        try {
            return fs.readFileSync(input, 'utf8');
        } catch (err) {
            throw new Error(`Failed to load key from path or invalid PEM: ${input}`);
        }
    }

    decrypt(link) {
        if (!link) throw new Error('empty link');

        const match = link.match(LINK_REGEX);
        if (!match) throw new Error('invalid link format');

        const [, version, encryptedB64] = match;
        const encryptedBuffer = Buffer.from(encryptedB64, 'base64');
        const versionsToTry = new Set([version, ...FALLBACK_ORDER]);
        
        const errors = [];

        for (const keyVersion of versionsToTry) {
            const privateKey = this.privateKeys[keyVersion];
            if (!privateKey) continue;

            // ПОПЫТКА 1: Стандартная
            try {
                const decryptedBuffer = crypto.privateDecrypt(
                    {
                        key: privateKey,
                        padding: crypto.constants.RSA_PKCS1_PADDING
                    },
                    encryptedBuffer
                );
                
                return this._successResult(version, keyVersion, decryptedBuffer);
            } catch (err) {
                // Игнорируем ошибку и молча идем пробовать ручной метод.
                // Если ключ был неверный, ручной метод тоже упадет, это нормально.
            }

            // ПОПЫТКА 2: Fallback (Ручной режим через NO_PADDING)
            try {
                const rawDecrypted = crypto.privateDecrypt(
                    {
                        key: privateKey,
                        padding: crypto.constants.RSA_NO_PADDING 
                    },
                    encryptedBuffer
                );

                let separatorIndex = -1;
                // Ищем разделитель 0x00. Данные RSA PKCS#1 v1.5 всегда начинаются с 00 02 ... 00
                for (let i = 2; i < rawDecrypted.length; i++) {
                    if (rawDecrypted[i] === 0x00) {
                        separatorIndex = i;
                        break;
                    }
                }

                if (separatorIndex === -1) {
                    throw new Error('Manual decrypt: Invalid padding structure');
                }

                const dataBuffer = rawDecrypted.subarray(separatorIndex + 1);
                return this._successResult(version, keyVersion, dataBuffer);

            } catch (err) {
                errors.push(`[Key: ${keyVersion}] Failed both methods. Last error: ${err.message}`);
                continue;
            }
        }

        throw new Error(`Decryption failed. Details:\n${errors.join('\n')}`);
    }

    _successResult(version, usedKey, buffer) {
        return {
            version: version,
            usedKey: usedKey,
            decryptedData: buffer.toString('utf8')
        };
    }

    encrypt(data, version) {
        if (!data) throw new Error('data is empty');
        if (!version) throw new Error('version cannot be empty');

        const publicKey = this.publicKeys[version];
        if (!publicKey) {
            throw new Error(`public key for version ${version} not found`);
        }

        try {
            const buffer = Buffer.from(data, 'utf8');
            const encryptedBuffer = crypto.publicEncrypt(
                {
                    key: publicKey,
                    padding: crypto.constants.RSA_PKCS1_PADDING
                },
                buffer
            );

            const encryptedB64 = encryptedBuffer.toString('base64');

            return {
                version,
                encryptedData: encryptedB64,
                link: `happ://${version}/${encryptedB64}`
            };
        } catch (err) {
            throw new Error(`Encryption failed: ${err.message}`);
        }
    }
}

