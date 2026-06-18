import Foundation

struct TelegramService {

    private static let apiBase = "https://api.telegram.org/bot"

    // MARK: - Public

    static func sendMessage(_ text: String) async throws {
        guard let token = KeychainService.telegramBotToken, !token.isEmpty else {
            throw TelegramError.missingToken
        }
        guard let chatID = KeychainService.telegramChatID, !chatID.isEmpty else {
            throw TelegramError.missingChatID
        }
        try await post(token: token, chatID: chatID, text: text)
    }

    static func testConnection(token: String, chatID: String) async throws {
        try await post(token: token, chatID: chatID, text: "✅ *MailSummary conectado correctamente*\nEste bot enviará tu resumen diario de correos.")
    }

    // MARK: - Private

    private static func post(token: String, chatID: String, text: String) async throws {
        guard let url = URL(string: "\(apiBase)\(token)/sendMessage") else {
            throw TelegramError.invalidToken
        }

        let body: [String: Any] = [
            "chat_id":    chatID,
            "text":       text,
            "parse_mode": "Markdown"
        ]

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody  = try JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 30

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw TelegramError.invalidResponse
        }
        guard http.statusCode == 200 else {
            let detail = parseTelegramError(data)
            throw TelegramError.apiError(statusCode: http.statusCode, message: detail)
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let ok = json["ok"] as? Bool, ok else {
            let detail = parseTelegramError(data)
            throw TelegramError.apiError(statusCode: 200, message: detail)
        }
    }

    private static func parseTelegramError(_ data: Data) -> String {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let desc = json["description"] as? String else {
            return String(data: data, encoding: .utf8) ?? "Error desconocido"
        }
        return desc
    }
}

// MARK: - Errors

enum TelegramError: Error, LocalizedError {
    case missingToken
    case missingChatID
    case invalidToken
    case invalidResponse
    case apiError(statusCode: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .missingToken:   return "Token del bot de Telegram no configurado"
        case .missingChatID:  return "Chat ID de Telegram no configurado"
        case .invalidToken:   return "Token de Telegram inválido"
        case .invalidResponse: return "Respuesta inválida de Telegram"
        case .apiError(let code, let msg): return "Error Telegram \(code): \(msg)"
        }
    }
}
