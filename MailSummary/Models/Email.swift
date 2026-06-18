import Foundation

struct Email: Identifiable, Codable {
    let id: String
    let subject: String
    let sender: String
    let senderEmail: String
    let body: String
    let date: Date
    var isAdvertising: Bool = false

    var snippet: String {
        let cleaned = body
            .components(separatedBy: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        let limit = cleaned.index(cleaned.startIndex, offsetBy: min(200, cleaned.count))
        return String(cleaned[..<limit])
    }
}

extension Email {
    static let advertisingKeywords: [String] = [
        "unsubscribe", "darse de baja", "newsletter", "oferta", "descuento",
        "promoción", "promo", "sale", "% off", "deal", "noreply", "no-reply",
        "donotreply", "marketing", "publicidad", "suscripción", "suscripcion",
        "campaign", "campaña", "shop", "tienda", "comprar", "buy now",
        "click here", "haz clic", "limited time", "tiempo limitado",
        "free shipping", "envío gratis", "best seller", "new arrival"
    ]

    var likelyAdvertising: Bool {
        let lowerSubject = subject.lowercased()
        let lowerSender = senderEmail.lowercased()
        let lowerBody = body.prefix(500).lowercased()
        return Email.advertisingKeywords.contains { keyword in
            lowerSubject.contains(keyword) ||
            lowerSender.contains(keyword) ||
            lowerBody.contains(keyword)
        }
    }
}
