import Foundation

struct ImportantEmailSummary: Codable, Identifiable {
    var id: UUID = UUID()
    let sender: String
    let subject: String
    let keyPoints: String
}

struct EmailSummary: Identifiable, Codable {
    let id: UUID
    let date: Date
    let totalEmails: Int
    let advertisingCount: Int
    let advertisingSenders: [String]
    let importantEmails: [ImportantEmailSummary]
    let telegramMessage: String
    var sentToTelegram: Bool = false

    init(
        id: UUID = UUID(),
        date: Date = Date(),
        totalEmails: Int,
        advertisingCount: Int,
        advertisingSenders: [String],
        importantEmails: [ImportantEmailSummary],
        telegramMessage: String,
        sentToTelegram: Bool = false
    ) {
        self.id = id
        self.date = date
        self.totalEmails = totalEmails
        self.advertisingCount = advertisingCount
        self.advertisingSenders = advertisingSenders
        self.importantEmails = importantEmails
        self.telegramMessage = telegramMessage
        self.sentToTelegram = sentToTelegram
    }
}

extension EmailSummary {
    static let storageKey = "email_summaries_history"

    static func load() -> [EmailSummary] {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let summaries = try? JSONDecoder().decode([EmailSummary].self, from: data) else {
            return []
        }
        return summaries
    }

    static func save(_ summaries: [EmailSummary]) {
        guard let data = try? JSONEncoder().encode(summaries) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }
}
