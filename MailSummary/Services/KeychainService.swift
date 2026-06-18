import Foundation
import Security

enum KeychainKey: String {
    case anthropicAPIKey  = "com.mailsummary.anthropic_api_key"
    case telegramBotToken = "com.mailsummary.telegram_bot_token"
    case telegramChatID   = "com.mailsummary.telegram_chat_id"
    // Per-account passwords stored as "com.mailsummary.imap_password.<accountId>"
    static func imapPassword(for accountId: String) -> String {
        "com.mailsummary.imap_password.\(accountId)"
    }
}

enum KeychainError: Error, LocalizedError {
    case unexpectedData
    case unhandledError(status: OSStatus)

    var errorDescription: String? {
        switch self {
        case .unexpectedData: return "Unexpected Keychain data format"
        case .unhandledError(let s): return "Keychain error: \(s)"
        }
    }
}

struct KeychainService {

    static func save(_ value: String, for key: String) throws {
        let data = Data(value.utf8)
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrAccount: key,
            kSecValueData:   data,
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        SecItemDelete(query as CFDictionary)
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.unhandledError(status: status)
        }
    }

    static func retrieve(for key: String) throws -> String? {
        let query: [CFString: Any] = [
            kSecClass:            kSecClassGenericPassword,
            kSecAttrAccount:      key,
            kSecReturnData:       true,
            kSecMatchLimit:       kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status != errSecItemNotFound else { return nil }
        guard status == errSecSuccess else {
            throw KeychainError.unhandledError(status: status)
        }
        guard let data = item as? Data, let value = String(data: data, encoding: .utf8) else {
            throw KeychainError.unexpectedData
        }
        return value
    }

    static func delete(for key: String) {
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrAccount: key
        ]
        SecItemDelete(query as CFDictionary)
    }

    // Convenience wrappers
    static var anthropicAPIKey: String? {
        try? retrieve(for: KeychainKey.anthropicAPIKey.rawValue)
    }
    static func saveAnthropicAPIKey(_ key: String) throws {
        try save(key, for: KeychainKey.anthropicAPIKey.rawValue)
    }

    static var telegramBotToken: String? {
        try? retrieve(for: KeychainKey.telegramBotToken.rawValue)
    }
    static func saveTelegramBotToken(_ token: String) throws {
        try save(token, for: KeychainKey.telegramBotToken.rawValue)
    }

    static var telegramChatID: String? {
        try? retrieve(for: KeychainKey.telegramChatID.rawValue)
    }
    static func saveTelegramChatID(_ id: String) throws {
        try save(id, for: KeychainKey.telegramChatID.rawValue)
    }

    static func imapPassword(for accountId: String) -> String? {
        try? retrieve(for: KeychainKey.imapPassword(for: accountId))
    }
    static func saveIMAPPassword(_ password: String, for accountId: String) throws {
        try save(password, for: KeychainKey.imapPassword(for: accountId))
    }
}
