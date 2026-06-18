import Foundation

struct EmailAccountConfig: Identifiable, Codable {
    var id: UUID = UUID()
    var displayName: String
    var imapServer: String
    var imapPort: Int
    var username: String
    var useSSL: Bool

    static func defaultConfigs() -> [EmailAccountConfig] { [] }
}

struct AppSettings {
    private static let defaults = UserDefaults.standard

    static var scheduledHour: Int {
        get { defaults.integer(forKey: "scheduled_hour").nonZeroOr(8) }
        set { defaults.set(newValue, forKey: "scheduled_hour") }
    }

    static var scheduledMinute: Int {
        get { defaults.integer(forKey: "scheduled_minute") }
        set { defaults.set(newValue, forKey: "scheduled_minute") }
    }

    static var emailAccounts: [EmailAccountConfig] {
        get {
            guard let data = defaults.data(forKey: "email_accounts"),
                  let accounts = try? JSONDecoder().decode([EmailAccountConfig].self, from: data)
            else { return [] }
            return accounts
        }
        set {
            guard let data = try? JSONEncoder().encode(newValue) else { return }
            defaults.set(data, forKey: "email_accounts")
        }
    }

    static var isBackgroundRefreshEnabled: Bool {
        get { defaults.bool(forKey: "bg_refresh_enabled") }
        set { defaults.set(newValue, forKey: "bg_refresh_enabled") }
    }

    static var lastRunDate: Date? {
        get { defaults.object(forKey: "last_run_date") as? Date }
        set { defaults.set(newValue, forKey: "last_run_date") }
    }
}

private extension Int {
    func nonZeroOr(_ fallback: Int) -> Int { self == 0 ? fallback : self }
}
