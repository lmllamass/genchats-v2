import SwiftUI

struct ConfigurationView: View {
    @EnvironmentObject var vm: ConfigurationViewModel
    @State private var showAddAccount = false
    @State private var saved = false

    var body: some View {
        NavigationStack {
            Form {
                // MARK: Telegram
                Section {
                    SecureField("Token del bot (1234567890:ABC…)", text: $vm.telegramBotToken)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)

                    TextField("Chat ID (-100123456789)", text: $vm.telegramChatID)
                        .keyboardType(.numbersAndPunctuation)
                        .autocorrectionDisabled()

                    if let result = vm.testResult {
                        Text(result)
                            .font(.caption)
                            .foregroundStyle(result.hasPrefix("✅") ? .green : .red)
                    }

                    Button {
                        vm.save()
                        vm.testTelegram()
                    } label: {
                        HStack {
                            Text("Probar conexión Telegram")
                            Spacer()
                            if vm.isTesting { ProgressView() }
                        }
                    }
                    .disabled(vm.isTesting)
                } header: {
                    Label("Telegram", systemImage: "paperplane.fill")
                } footer: {
                    Text("Obtén el token con @BotFather en Telegram. El Chat ID puedes obtenerlo con @userinfobot.")
                }

                // MARK: Anthropic
                Section {
                    SecureField("sk-ant-api03-…", text: $vm.anthropicAPIKey)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                } header: {
                    Label("Anthropic API", systemImage: "brain")
                } footer: {
                    Text("Clave API de Anthropic para generar los resúmenes con Claude.")
                }

                // MARK: Schedule
                Section {
                    DatePicker(
                        "Hora diaria de envío",
                        selection: $vm.scheduledTime,
                        displayedComponents: .hourAndMinute
                    )

                    Toggle("Activar envío automático", isOn: Binding(
                        get: { AppSettings.isBackgroundRefreshEnabled },
                        set: {
                            AppSettings.isBackgroundRefreshEnabled = $0
                            if $0 { BackgroundTaskService.scheduleNextRun() }
                            else  { BackgroundTaskService.cancelAll() }
                        }
                    ))
                } header: {
                    Label("Automatización", systemImage: "clock.badge.checkmark")
                } footer: {
                    Text("iOS puede retrasar las tareas en segundo plano según el uso de la batería y otros factores.")
                }

                // MARK: Email Accounts
                Section {
                    ForEach(vm.emailAccounts) { account in
                        AccountRow(account: account)
                    }
                    .onDelete { vm.removeAccount(at: $0) }

                    Button {
                        showAddAccount = true
                    } label: {
                        Label("Añadir cuenta IMAP", systemImage: "plus.circle")
                    }
                } header: {
                    Label("Cuentas de correo", systemImage: "envelope")
                } footer: {
                    Text("Introduce los datos IMAP de cada cuenta. Las contraseñas se guardan en el Keychain.")
                }

                // MARK: Save
                Section {
                    if let error = vm.errorMessage {
                        Text(error)
                            .foregroundStyle(.red)
                            .font(.caption)
                    }

                    Button {
                        vm.save()
                        saved = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { saved = false }
                    } label: {
                        HStack {
                            Spacer()
                            if saved {
                                Label("Guardado", systemImage: "checkmark.circle.fill")
                                    .foregroundStyle(.green)
                            } else {
                                Text("Guardar configuración")
                                    .bold()
                            }
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Configuración")
            .sheet(isPresented: $showAddAccount) {
                AddAccountSheet { account, password in
                    vm.addAccount(account, password: password)
                }
            }
        }
    }
}

// MARK: - Account Row

private struct AccountRow: View {
    let account: EmailAccountConfig

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(account.displayName.isEmpty ? account.username : account.displayName)
                .font(.subheadline.weight(.medium))
            Text("\(account.imapServer):\(account.imapPort)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Add Account Sheet

struct AddAccountSheet: View {
    var onAdd: (EmailAccountConfig, String) -> Void
    @Environment(\.dismiss) var dismiss

    @State private var displayName = ""
    @State private var imapServer  = ""
    @State private var imapPort    = "993"
    @State private var username    = ""
    @State private var password    = ""
    @State private var useSSL      = true

    private var isValid: Bool {
        !imapServer.isEmpty && !username.isEmpty && !password.isEmpty && Int(imapPort) != nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Datos de la cuenta") {
                    TextField("Nombre (ej. Gmail personal)", text: $displayName)
                    TextField("Servidor IMAP (ej. imap.gmail.com)", text: $imapServer)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    TextField("Puerto", text: $imapPort)
                        .keyboardType(.numberPad)
                    Toggle("Usar SSL/TLS", isOn: $useSSL)
                }
                Section("Credenciales") {
                    TextField("Usuario / Email", text: $username)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                    SecureField("Contraseña / App Password", text: $password)
                }
                Section {
                    Text("Para Gmail, usa una **contraseña de aplicación** (Google Account → Seguridad → Contraseñas de aplicaciones). Para Outlook, activa IMAP en la configuración de la cuenta.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Nueva cuenta")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Añadir") {
                        let account = EmailAccountConfig(
                            displayName: displayName.isEmpty ? username : displayName,
                            imapServer:  imapServer,
                            imapPort:    Int(imapPort) ?? 993,
                            username:    username,
                            useSSL:      useSSL
                        )
                        onAdd(account, password)
                        dismiss()
                    }
                    .disabled(!isValid)
                }
            }
        }
    }
}
