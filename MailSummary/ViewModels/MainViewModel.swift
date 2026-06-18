import Foundation
import Combine

@MainActor
final class MainViewModel: ObservableObject {

    @Published var isRunning   = false
    @Published var lastSummary: EmailSummary?
    @Published var errorMessage: String?
    @Published var statusMessage: String?

    init() {
        lastSummary = EmailSummary.load().first
    }

    // Called from UI "Run Now" button or from background task
    func runSummaryPipeline() async throws {
        isRunning     = true
        errorMessage  = nil
        statusMessage = "Conectando a las cuentas de correo…"
        defer { isRunning = false }

        do {
            statusMessage = "Leyendo correos de las últimas 24 h…"
            let summary = try await MailOrchestrator.run()
            lastSummary   = summary
            statusMessage = "Resumen enviado a Telegram ✓"
        } catch {
            errorMessage  = error.localizedDescription
            statusMessage = nil
            throw error
        }
    }

    func runManually() {
        Task { try? await runSummaryPipeline() }
    }

    var summaryHistory: [EmailSummary] {
        EmailSummary.load()
    }

    var lastRunText: String {
        guard let date = AppSettings.lastRunDate else { return "Nunca ejecutado" }
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
