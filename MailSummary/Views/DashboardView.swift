import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var vm: MainViewModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Status card
                    StatusCard(vm: vm)

                    // Run now button
                    Button(action: { vm.runManually() }) {
                        Label(
                            vm.isRunning ? "Procesando…" : "Ejecutar ahora",
                            systemImage: vm.isRunning ? "hourglass" : "play.circle.fill"
                        )
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(vm.isRunning ? Color.gray : Color.accentColor)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(vm.isRunning)
                    .padding(.horizontal)

                    if let error = vm.errorMessage {
                        ErrorBanner(message: error)
                    }

                    // Last summary preview
                    if let summary = vm.lastSummary {
                        LastSummaryCard(summary: summary)
                    } else {
                        EmptyStateView()
                    }
                }
                .padding(.top)
            }
            .navigationTitle("MailSummary")
            .navigationBarTitleDisplayMode(.large)
        }
    }
}

// MARK: - Sub-views

private struct StatusCard: View {
    let vm: MainViewModel

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: "clock.fill")
                .font(.title2)
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 4) {
                Text("Último envío")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(vm.lastRunText)
                    .font(.subheadline.weight(.medium))

                if let status = vm.statusMessage {
                    Text(status)
                        .font(.caption)
                        .foregroundStyle(.accentColor)
                }
            }
            Spacer()

            if vm.isRunning {
                ProgressView()
            }
        }
        .padding()
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}

private struct LastSummaryCard: View {
    let summary: EmailSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Último resumen", systemImage: "doc.text.fill")
                    .font(.headline)
                Spacer()
                Text(summary.date, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Divider()

            HStack(spacing: 24) {
                StatItem(value: "\(summary.totalEmails)", label: "Total")
                StatItem(value: "\(summary.importantEmails.count)", label: "Importantes")
                StatItem(value: "\(summary.advertisingCount)", label: "Publicidad")
            }

            if !summary.importantEmails.isEmpty {
                Divider()
                ForEach(summary.importantEmails.prefix(3)) { email in
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "envelope.fill")
                            .foregroundStyle(.accentColor)
                            .font(.caption)
                            .padding(.top, 2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(email.subject)
                                .font(.subheadline.weight(.medium))
                                .lineLimit(1)
                            Text(email.sender)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                if summary.importantEmails.count > 3 {
                    Text("+ \(summary.importantEmails.count - 3) más…")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}

private struct StatItem: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.title2.bold())
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
}

private struct ErrorBanner: View {
    let message: String

    var body: some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
            Text(message)
                .font(.caption)
                .foregroundStyle(.red)
        }
        .padding(.horizontal)
    }
}

private struct EmptyStateView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "envelope.open")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("Sin resúmenes todavía")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text("Configura tus cuentas y pulsa «Ejecutar ahora»")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(40)
    }
}
