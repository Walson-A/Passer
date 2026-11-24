import Foundation

/// The share sheet's words, in the app's language. Where the app says the same thing,
/// the copy is the app's (`src/i18n/strings.ts`): keep them in step.
enum ShareText {
  private static var french: Bool { PasserShared.isFrench }

  static var cancel: String { french ? "Annuler" : "Cancel" }
  static var close: String { french ? "Fermer" : "Close" }
  static var retry: String { french ? "Réessayer" : "Try again" }
  static var noPC: String { french ? "Aucun PC associé" : "No paired PC" }

  static var searching: String { french ? "Recherche du PC" : "Looking for the PC" }
  static func connected(_ address: String) -> String { french ? "Connecté · \(address)" : "Connected · \(address)" }
  static var unreachable: String { french ? "Injoignable" : "Unreachable" }

  static var preparing: String { french ? "Préparation" : "Getting ready" }
  static var sending: String { french ? "Envoi" : "Sending" }
  static var toClipboard: String { french ? "Vers le presse-papiers du PC" : "To the PC clipboard" }
  static var toPassboard: String { french ? "Vers le Passboard" : "To the Passboard" }

  static var clipboardTitle: String { french ? "Presse-papiers" : "Clipboard" }
  static var clipboardBody: String {
    french
      ? "Arrive dans le presse-papiers du PC, prête pour Ctrl+V. Remplace son contenu."
      : "Lands on the PC clipboard, ready for Ctrl+V. Replaces what's there."
  }
  static var clipboardOnlyOne: String {
    french
      ? "Le presse-papiers ne contient qu’une photo à la fois : seule la première est envoyée."
      : "The clipboard holds one photo at a time, so only the first one is sent."
  }
  static var passboardTitle: String { "Passboard" }
  static var passboardBody: String {
    french ? "Enregistrée dans Bureau › Passer › Passboard › Images." : "Saved to Desktop › Passer › Passboard › Images."
  }

  static func photos(_ count: Int) -> String { PasserText.photos(count) }
  static func files(_ count: Int) -> String { PasserText.files(count) }

  static var nothingToSend: String {
    french ? "Passer ne sait pas envoyer ce contenu." : "Passer can't send this."
  }
}
