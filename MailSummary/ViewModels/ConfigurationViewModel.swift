import Foundation
import Combine

@MainActor
final class ConfigurationViewModel: ObservableObject {

    // Telegram
    @Published var telegramBotToken = ""
    @Published var telegramChatID   = ""

    // Anthropic
    @Published var anthropicAPIKey = ""

    // Schedule
    @Published var scheduledTime = Calendar.current.date(
        bySettingHour: AppSettings.scheduledHour,
        minute: AppSettings.scheduledMinute,
        second: 0,
        of: Date()
    ) ?? Date()

    // Email accounts
    @Published var emailAccounts: [EmailAccountConfig] = []

    // UI state
    @Published var isTesting          = false
    @Published var testResult: String?
    @Published var errorMessage: String?
    @Published var showAddAccount      = false

    init() { load() }

    // MARK: - Load / Save

    func load() {
        telegramBotToken = KeychainService.telegramBotToken ?? ""
        telegramChatID   = KeychainService.telegramChatID   ?? ""
        anthropicAPIKey  = KeychainService.anthropicAPIKey  ?? ""
        emailAccounts    = AppSettings.emailAccounts

        let comps = Calendar.current.dateComponents([.hour, .minute], from: scheduledTime)
        _ = comps // already set from AppSettings in property initialiser
    }

    func save() {
        do {
            if !telegramBotToken.isEmpty { try KeychainService.saveTelegramBotToken(telegramBotToken) }
            if !telegramChatID.isEmpty   { try KeychainService.saveTelegramChatID(telegramChatID) }
            if !anthropicAPIKey.isEmpty  { try KeychainService.saveAnthropicAPIKey(anthropicAPIKey) }

            let comps = Calendar.current.dateComponents([.hour, .minute], from: scheduledTime)
            AppSettings.scheduledHour   = comps.hour   ?? 8
            AppSettings.scheduledMinute = comps.minute ?? 0
            AppSettings.emailAccounts   = emailAccounts

            if AppSettings.isBackgroundRefreshEnabled {
                BackgroundTaskService.scheduleNextRun()
            }
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Account management

    func addAccount(_ account: EmailAccountConfig, password: String) {
        emailAccounts.append(account)
        try? KeychainService.saveIMAPPassword(password, for: account.id.uuidString)
        AppSettings.emailAccounts = emailAccounts
    }

    func removeAccount(at offsets: IndexSet) {
        for index in offsets {
            let account = emailAccounts[index]
            KeychainService.delete(for: KeychainKey.imapPassword(for: account.id.uuidString))
        }
        emailAccounts.remove(atOffsets: offsets)
        AppSettings.emailAccounts = emailAccounts
    }

    // MARK: - Test Telegram

    func testTelegram() {
        guard !telegramBotToken.isEmpty, !telegramChatID.isEmpty else {
            errorMessage = "Introduce el token y el chat ID antes de probar"
            return
        }
        isTesting  = true
        testResult = nil
        Task {
            do {
                try await TelegramService.testConnection(
                    token: telegramBotToken,
                    chatID: telegramChatID
                )
                testResult  = "✅ Conexión exitosa"
            } catch {
                testResult  = "❌ \(error.localizedDescription)"
            }
            isTesting = false
        }
    }
}
