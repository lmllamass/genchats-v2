import SwiftUI

struct HistoryView: View {
    @EnvironmentObject var vm: MainViewModel
    @State private var selectedSummary: EmailSummary?

    var history: [EmailSummary] { vm.summaryHistory }

    var body: some View {
        NavigationStack {
            Group {
                if history.isEmpty {
                    ContentUnavailableView(
                        "Sin historial",
                        systemImage: "clock.arrow.circlepath",
                        description: Text("Los resúmenes enviados aparecerán aquí")
                    )
                } else {
                    List(history) { summary in
                        Button { selectedSummary = summary } label: {
                            HistoryRow(summary: summary)
                        }
                        .buttonStyle(.plain)
                    }
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Historial")
            .sheet(item: $selectedSummary) { summary in
                SummaryDetailSheet(summary: summary)
            }
        }
    }
}

// MARK: - Row

private struct HistoryRow: View {
    let summary: EmailSummary

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(summary.date, style: .date)
                    .font(.subheadline.weight(.medium))
                Text(summary.date, style: .time)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Label("\(summary.totalEmails)", systemImage: "envelope")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if summary.sentToTelegram {
                    Label("Enviado", systemImage: "checkmark.circle.fill")
                        .font(.caption2)
                        .foregroundStyle(.green)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Detail Sheet

struct SummaryDetailSheet: View {
    let summary: EmailSummary
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Stats
                    HStack(spacing: 24) {
                        Spacer()
                        StatPill(value: "\(summary.totalEmails)", label: "Total", color: .blue)
                        StatPill(value: "\(summary.importantEmails.count)", label: "Importantes", color: .green)
                        StatPill(value: "\(summary.advertisingCount)", label: "Publicidad", color: .orange)
                        Spacer()
                    }
                    .padding(.top)

                    Divider()

                    // Telegram message
                    Text("Mensaje enviado a Telegram")
                        .font(.headline)
                        .padding(.horizontal)

                    Text(summary.telegramMessage)
                        .font(.system(.body, design: .monospaced))
                        .padding()
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .padding(.horizontal)

                    // Copy button
                    Button {
                        UIPasteboard.general.string = summary.telegramMessage
                    } label: {
                        Label("Copiar mensaje", systemImage: "doc.on.doc")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .padding(.horizontal)
                }
                .padding(.bottom)
            }
            .navigationTitle(summary.date.formatted(date: .abbreviated, time: .shortened))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Cerrar") { dismiss() }
                }
            }
        }
    }
}

private struct StatPill: View {
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 2) {
            Text(value).font(.title3.bold()).foregroundStyle(color)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
    }
}
