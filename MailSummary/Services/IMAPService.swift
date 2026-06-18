import Foundation
import Network

// Lightweight IMAP client using Network.framework (TLS/plain TCP).
// Supports: LOGIN, SELECT, SEARCH SINCE, FETCH BODY[].
actor IMAPService {

    private let host: String
    private let port: UInt16
    private let useTLS: Bool
    private var connection: NWConnection?
    private var tagCounter = 0
    private var receiveBuffer = ""

    init(host: String, port: UInt16 = 993, useTLS: Bool = true) {
        self.host = host
        self.port = port
        self.useTLS = useTLS
    }

    // MARK: - Public API

    func fetchRecentEmails(
        username: String,
        password: String,
        since: Date = Calendar.current.date(byAdding: .hour, value: -24, to: Date())!
    ) async throws -> [Email] {
        try await connect()
        defer { Task { await disconnect() } }

        try await waitForGreeting()
        try await login(user: username, pass: password)

        let count = try await select(mailbox: "INBOX")
        guard count > 0 else { return [] }

        let uids = try await search(since: since)
        guard !uids.isEmpty else { return [] }

        let emails = try await fetchMessages(uids: uids)
        try await logout()
        return emails
    }

    // MARK: - Connection

    private func connect() async throws {
        let params: NWParameters = useTLS ? .tls : .tcp
        let conn = NWConnection(
            host: NWEndpoint.Host(host),
            port: NWEndpoint.Port(rawValue: port)!,
            using: params
        )
        self.connection = conn

        return try await withCheckedThrowingContinuation { cont in
            conn.stateUpdateHandler = { state in
                switch state {
                case .ready:          cont.resume()
                case .failed(let e): cont.resume(throwing: e)
                case .cancelled:     cont.resume(throwing: IMAPError.connectionCancelled)
                default: break
                }
            }
            conn.start(queue: .global())
        }
    }

    private func disconnect() {
        connection?.cancel()
        connection = nil
    }

    // MARK: - IMAP Commands

    private func waitForGreeting() async throws {
        let line = try await readLine()
        guard line.hasPrefix("* OK") else {
            throw IMAPError.unexpectedResponse(line)
        }
    }

    private func login(user: String, pass: String) async throws {
        let tag = nextTag()
        try await send("\(tag) LOGIN \"\(user)\" \"\(pass)\"\r\n")
        let response = try await readUntilTagged(tag)
        guard response.last?.contains("OK") == true else {
            throw IMAPError.authenticationFailed
        }
    }

    private func select(mailbox: String) async throws -> Int {
        let tag = nextTag()
        try await send("\(tag) SELECT \"\(mailbox)\"\r\n")
        let lines = try await readUntilTagged(tag)
        guard lines.last?.contains("OK") == true else {
            throw IMAPError.unexpectedResponse(lines.last ?? "")
        }
        for line in lines {
            if line.contains("EXISTS"), let n = line.extractFirstInt() { return n }
        }
        return 0
    }

    private func search(since: Date) async throws -> [Int] {
        let formatter = DateFormatter()
        formatter.dateFormat = "d-MMM-yyyy"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        let dateStr = formatter.string(from: since)
        let tag = nextTag()
        try await send("\(tag) SEARCH SINCE \(dateStr)\r\n")
        let lines = try await readUntilTagged(tag)
        guard lines.last?.contains("OK") == true else {
            throw IMAPError.unexpectedResponse(lines.last ?? "")
        }
        for line in lines where line.hasPrefix("* SEARCH") {
            let parts = line.dropFirst(9).split(separator: " ").compactMap { Int($0) }
            return parts
        }
        return []
    }

    private func fetchMessages(uids: [Int]) async throws -> [Email] {
        guard !uids.isEmpty else { return [] }
        let limited = Array(uids.suffix(50))
        let set = limited.map(String.init).joined(separator: ",")
        let tag = nextTag()
        try await send("\(tag) FETCH \(set) (FLAGS ENVELOPE BODY.PEEK[TEXT]<0.2048>)\r\n")
        let lines = try await readUntilTagged(tag)
        return parseEmails(from: lines, uids: limited)
    }

    private func logout() async throws {
        let tag = nextTag()
        try await send("\(tag) LOGOUT\r\n")
        _ = try? await readUntilTagged(tag)
    }

    // MARK: - Network I/O

    private func send(_ text: String) async throws {
        guard let conn = connection else { throw IMAPError.notConnected }
        let data = Data(text.utf8)
        return try await withCheckedThrowingContinuation { cont in
            conn.send(content: data, completion: .contentProcessed { error in
                if let e = error { cont.resume(throwing: e) }
                else { cont.resume() }
            })
        }
    }

    private func readLine() async throws -> String {
        while true {
            if let range = receiveBuffer.range(of: "\r\n") {
                let line = String(receiveBuffer[..<range.lowerBound])
                receiveBuffer.removeSubrange(..<range.upperBound)
                return line
            }
            let chunk = try await receiveChunk()
            receiveBuffer += chunk
        }
    }

    private func readUntilTagged(_ tag: String) async throws -> [String] {
        var lines: [String] = []
        while true {
            let line = try await readLine()
            lines.append(line)
            if line.hasPrefix(tag + " ") { break }
        }
        return lines
    }

    private func receiveChunk() async throws -> String {
        guard let conn = connection else { throw IMAPError.notConnected }
        return try await withCheckedThrowingContinuation { cont in
            conn.receive(minimumIncompleteLength: 1, maximumLength: 65536) { data, _, _, error in
                if let e = error { cont.resume(throwing: e); return }
                let text = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
                cont.resume(returning: text)
            }
        }
    }

    // MARK: - IMAP Response Parsing

    private func parseEmails(from lines: [String], uids: [Int]) -> [Email] {
        var emails: [Email] = []
        var i = 0
        var uidIndex = 0
        while i < lines.count {
            let line = lines[i]
            if line.contains("FETCH") && line.contains("ENVELOPE") {
                let uid = uidIndex < uids.count ? uids[uidIndex] : i
                uidIndex += 1
                if let email = parseEnvelopeLine(line, uid: uid, bodyLines: lines, index: &i) {
                    emails.append(email)
                    continue
                }
            }
            i += 1
        }
        return emails
    }

    private func parseEnvelopeLine(_ line: String, uid: Int, bodyLines: [String], index: inout Int) -> Email? {
        let subject = line.extractIMAPField("subject") ?? "(Sin asunto)"
        let from = line.extractIMAPFrom()
        let dateStr = line.extractIMAPDate()
        let date = dateStr.flatMap { IMAPService.parseIMAPDate($0) } ?? Date()

        var bodyText = ""
        var j = index + 1
        while j < bodyLines.count {
            let l = bodyLines[j]
            if l.hasPrefix("* ") && l.contains("FETCH") { break }
            if l.hasSuffix(")") && bodyText.isEmpty { j += 1; continue }
            bodyText += l + "\n"
            j += 1
        }
        index = j - 1

        return Email(
            id: "\(uid)",
            subject: subject,
            sender: from.name,
            senderEmail: from.email,
            body: bodyText.trimmingCharacters(in: .whitespacesAndNewlines),
            date: date
        )
    }

    private static func parseIMAPDate(_ str: String) -> Date? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        let formats = [
            "EEE, d MMM yyyy HH:mm:ss Z",
            "d MMM yyyy HH:mm:ss Z",
            "EEE, d MMM yyyy HH:mm:ss z"
        ]
        for fmt in formats {
            formatter.dateFormat = fmt
            if let d = formatter.date(from: str) { return d }
        }
        return nil
    }

    private func nextTag() -> String {
        tagCounter += 1
        return "A\(String(format: "%04d", tagCounter))"
    }
}

// MARK: - Errors

enum IMAPError: Error, LocalizedError {
    case notConnected
    case connectionCancelled
    case authenticationFailed
    case unexpectedResponse(String)

    var errorDescription: String? {
        switch self {
        case .notConnected:             return "No hay conexión IMAP activa"
        case .connectionCancelled:      return "Conexión cancelada"
        case .authenticationFailed:     return "Credenciales IMAP incorrectas"
        case .unexpectedResponse(let r): return "Respuesta IMAP inesperada: \(r)"
        }
    }
}

// MARK: - String Helpers

private extension String {
    func extractFirstInt() -> Int? {
        components(separatedBy: .whitespaces).compactMap(Int.init).first
    }

    func extractIMAPField(_ field: String) -> String? {
        let pattern = "(?i)\"\(field)\"\\s+\"([^\"]*)\""
        guard let r = range(of: pattern, options: .regularExpression) else { return nil }
        let match = String(self[r])
        let parts = match.components(separatedBy: "\"")
        return parts.count >= 4 ? parts[3] : nil
    }

    func extractIMAPFrom() -> (name: String, email: String) {
        let pattern = "FROM\\s+\\(\\(\"?([^\"\\)]*?)\"?\\s+NIL\\s+\"?([^\"\\s]+)\"?\\s+\"?([^\"\\s]+)\"?"
        if let r = range(of: pattern, options: .regularExpression) {
            let m = String(self[r])
            let parts = m.components(separatedBy: "\"")
            let name  = parts.count > 1 ? parts[1] : "Desconocido"
            let user  = parts.count > 3 ? parts[3] : ""
            let host  = parts.count > 5 ? parts[5] : ""
            return (name, "\(user)@\(host)")
        }
        return ("Desconocido", "")
    }

    func extractIMAPDate() -> String? {
        let pattern = "\"[A-Za-z]{3},\\s+\\d{1,2}\\s+[A-Za-z]{3}\\s+\\d{4}[^\"]*\""
        guard let r = range(of: pattern, options: .regularExpression) else { return nil }
        return String(self[r]).trimmingCharacters(in: CharacterSet(charactersIn: "\""))
    }
}
