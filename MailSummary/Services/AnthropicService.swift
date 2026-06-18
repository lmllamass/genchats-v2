import Foundation

struct AnthropicService {

    private static let apiURL = URL(string: "https://api.anthropic.com/v1/messages")!
    private static let model  = "claude-sonnet-4-20250514"

    // MARK: - Public

    static func generateSummary(
        importantEmails: [Email],
        advertisingEmails: [Email]
    ) async throws -> String {
        guard let apiKey = KeychainService.anthropicAPIKey, !apiKey.isEmpty else {
            throw AnthropicError.missingAPIKey
        }

        let prompt = buildPrompt(important: importantEmails, advertising: advertisingEmails)
        return try await callAPI(prompt: prompt, apiKey: apiKey)
    }

    // MARK: - Prompt

    private static func buildPrompt(important: [Email], advertising: [Email]) -> String {
        var parts: [String] = []
        parts.append("Eres un asistente que genera resúmenes claros y concisos de correos electrónicos.")
        parts.append("Analiza los siguientes correos recibidos en las últimas 24 horas y genera un resumen estructurado en español.")
        parts.append("")
        parts.append("## INSTRUCCIONES DE FORMATO")
        parts.append("- Usa formato Markdown compatible con Telegram")
        parts.append("- Sección 1: bloque compacto de publicidad/newsletters (solo total y remitentes)")
        parts.append("- Sección 2: resumen individual de cada correo importante (remitente, asunto, puntos clave)")
        parts.append("- Sé conciso: máximo 3 puntos clave por correo importante")
        parts.append("- Tono: profesional y directo")
        parts.append("")

        if !advertising.isEmpty {
            parts.append("## CORREOS PUBLICITARIOS / NEWSLETTERS (\(advertising.count))")
            for email in advertising {
                parts.append("- De: \(email.sender) <\(email.senderEmail)> | Asunto: \(email.subject)")
            }
            parts.append("")
        }

        if !important.isEmpty {
            parts.append("## CORREOS IMPORTANTES (\(important.count))")
            for (i, email) in important.enumerated() {
                parts.append("--- Correo \(i + 1) ---")
                parts.append("De: \(email.sender) <\(email.senderEmail)>")
                parts.append("Asunto: \(email.subject)")
                parts.append("Fecha: \(email.date.formatted())")
                parts.append("Contenido (extracto):")
                parts.append(String(email.body.prefix(800)))
                parts.append("")
            }
        }

        if important.isEmpty && advertising.isEmpty {
            parts.append("No se recibieron correos en las últimas 24 horas.")
        }

        parts.append("")
        parts.append("Genera ahora el resumen formateado para Telegram.")
        return parts.joined(separator: "\n")
    }

    // MARK: - API Call

    private static func callAPI(prompt: String, apiKey: String) async throws -> String {
        var request = URLRequest(url: apiURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.timeoutInterval = 60

        let body: [String: Any] = [
            "model": model,
            "max_tokens": 1500,
            "messages": [
                ["role": "user", "content": prompt]
            ]
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw AnthropicError.invalidResponse
        }
        guard http.statusCode == 200 else {
            let msg = String(data: data, encoding: .utf8) ?? "Sin detalle"
            throw AnthropicError.apiError(statusCode: http.statusCode, message: msg)
        }

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let content = (json["content"] as? [[String: Any]])?.first,
              let text = content["text"] as? String else {
            throw AnthropicError.parsingError
        }
        return text
    }
}

// MARK: - Errors

enum AnthropicError: Error, LocalizedError {
    case missingAPIKey
    case invalidResponse
    case apiError(statusCode: Int, message: String)
    case parsingError

    var errorDescription: String? {
        switch self {
        case .missingAPIKey:
            return "API key de Anthropic no configurada"
        case .invalidResponse:
            return "Respuesta inválida del servidor"
        case .apiError(let code, let msg):
            return "Error API \(code): \(msg)"
        case .parsingError:
            return "Error al procesar la respuesta de la API"
        }
    }
}
