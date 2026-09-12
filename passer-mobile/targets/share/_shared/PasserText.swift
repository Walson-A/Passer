import Foundation

/// The words used outside the app, in the app's language. They repeat the app's
/// own strings (`src/i18n/strings.ts`), so a message reads the same everywhere.
enum PasserText {
  static var french: Bool { PasserShared.isFrench }

  /// A PC name never breaks across lines: a Windows name such as `DESKTOP-4F7KQ2M` would split at its hyphen.
  static func unbreakable(_ name: String) -> String {
    name.replacingOccurrences(of: "-", with: "\u{2011}")
  }

  static func sent(to name: String) -> String {
    french ? "Envoyé à \(unbreakable(name))" : "Sent to \(unbreakable(name))"
  }

  static func received(from name: String) -> String {
    french ? "Reçu de \(unbreakable(name))" : "Received from \(unbreakable(name))"
  }

  static func photos(_ count: Int) -> String { "\(count) photos" }

  static func files(_ count: Int) -> String { french ? "\(count) fichiers" : "\(count) files" }

  static var pcClipboardEmpty: String {
    french ? "Le presse-papiers du PC est vide" : "The PC clipboard is empty"
  }

  static func failure(_ failure: PasserFailure, pcName: String?) -> String {
    let name = unbreakable(pcName ?? (french ? "votre PC" : "your PC"))
    switch failure {
    case .notPaired:
      return french ? "Ouvrez Passer pour associer votre PC." : "Open Passer to pair your PC."
    case .unreachable:
      return french
        ? "Impossible de joindre \(name). Vérifiez que le PC est allumé avec Passer ouvert, sur le même Wi-Fi."
        : "Couldn't reach \(name). Check that the PC is on with Passer open, on the same Wi-Fi."
    case .unauthorized:
      return french
        ? "\(name) n'accepte plus cet iPhone. Associez-le de nouveau dans Passer."
        : "\(name) no longer accepts this iPhone. Pair it again in Passer."
    case .wrongPC:
      return french ? "Un autre PC a répondu à l'adresse de \(name)." : "Another PC answered at \(name)'s address."
    case .notPasser:
      return french ? "Ce n'est pas Passer qui a répondu à cette adresse." : "Something other than Passer answered at that address."
    case .rejected, .pcFailed, .badResponse:
      return french ? "Non envoyé : \(name) n'a pas pu terminer. Réessayez." : "Didn't send: \(name) couldn't finish. Try again."
    case .cancelled:
      return french ? "Annulé" : "Cancelled"
    }
  }
}
