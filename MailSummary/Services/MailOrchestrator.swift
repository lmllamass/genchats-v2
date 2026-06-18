import Foundation

// Orchestrates: fetch → classify → summarise → send → store
struct MailOrchestrator {

    static func run() async throws -> EmailSummary {
        let accounts = AppSettings.emailAccounts
        guard !accounts.isEmpty else { throw OrchestratorError.noAccountsConfigured }

        // 1. Fetch emails from all accounts
        var allEmails: [Email] = []
        let since = Calendar.current.date(byAdding: .hour, value: -24, to: Date()) ?? Date()

        for account in accounts {
            guard let password = KeychainService.imapPassword(for: account.id.uuidString) else {
                continue
            }
            let imap = IMAPService(host: account.imapServer, port: UInt16(account.imapPort), useTLS: account.useSSL)
            let fetched = try await imap.fetchRecentEmails(
                username: account.username,
                password: password,
                since: since
            )
            allEmails.append(contentsOf: fetched)
        }

        // 2. Classify
        var advertising = allEmails.filter { $0.likelyAdvertising }
        var important   = allEmails.filter { !$0.likelyAdvertising }

        // Mark advertising flag
        for i in 0..<allEmails.count where allEmails[i].likelyAdvertising {
            advertising[advertising.firstIndex(where: { $0.id == allEmails[i].id }) ?? 0].isAdvertising = true
        }

        // 3. Generate AI summary
        let summaryText = try await AnthropicService.generateSummary(
            importantEmails: important,
            advertisingEmails: advertising
        )

        // 4. Send to Telegram
        try await TelegramService.sendMessage(summaryText)

        // 5. Build and persist EmailSummary
        let importantSummaries = important.map {
            ImportantEmailSummary(sender: $0.sender, subject: $0.subject, keyPoints: "")
        }
        let summary = EmailSummary(
            totalEmails: allEmails.count,
            advertisingCount: advertising.count,
            advertisingSenders: advertising.map { $0.sender },
            importantEmails: importantSummaries,
            telegramMessage: summaryText,
            sentToTelegram: true
        )

        var history = EmailSummary.load()
        history.insert(summary, at: 0)
        if history.count > 30 { history = Array(history.prefix(30)) }
        EmailSummary.save(history)

        AppSettings.lastRunDate = Date()
        return summary
    }
}

enum OrchestratorError: Error, LocalizedError {
    case noAccountsConfigured

    var errorDescription: String? {
        "No hay cuentas de correo configuradas. Añade al menos una en Configuración."
    }
}
