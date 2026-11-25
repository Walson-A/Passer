# Screens and states

Every screen of the phone app, with what it shows in each state. Captures come from the bench (`?bench=phone&motion=off`, iPhone 16, 393 × 852, French) on 2026-11-24, in `captures/`. They show layout and states, not iOS fonts or native controls: the tab bar, the paste control and sheets are the bench's stand-ins (see [bench.md](bench.md)), and the Android look is drawn inside the iPhone frame.

## First launch

| Screen | What it shows | Captures |
|---|---|---|
| Welcome (`welcome.tsx`) | What Passer does, then the one way in, in three steps: open *Devices › Add a device* on the PC, scan, compare the six digits. *Scan the code*, *I have an invitation link*, and a quiet *No PC yet? Start with this phone* that creates a group here. | [dark](captures/01-bienvenue.jpg) · [Android, light](captures/33-bienvenue-android-clair.jpg) |
| Scan (`scan.tsx`) | The camera's viewfinder. A `passer-core://join` code opens Join; a `passer://pair` code sets up the direct connection. Camera permission asked and refused states. | not capturable in the bench (no camera) |
| Paste a link (`manual.tsx`) | The same two kinds of link, pasted. | [sheet](captures/32-coller-un-lien.jpg) |
| Join (`join.tsx`) | Joining → the code to compare, in two groups of three, with *It's the same code* / *It's different*. Different stops the phone's node and says to choose *It's different* on the PC, which removes it. Failure: expired or used invitation, already in a group, no answer, each in a sentence with *Scan a new code*. | [joining](captures/02-rejoindre-connexion.jpg) · [code](captures/03-rejoindre-code.jpg) |

## Send (tab)

| State | What it shows | Captures |
|---|---|---|
| Ready | *Send to*: the destination drawn with its wallpaper, whether it answers, *Change* when there are several. *What you copied*: what is on the clipboard and the paste control. Photo, File, and *Its clipboard* with the lock *It asks first*. Recent. | [dark](captures/04-envoyer-sombre.jpg) · [light](captures/05-envoyer-clair.jpg) · [Android](captures/06-envoyer-android.jpg) · [English](captures/30-envoyer-anglais.jpg) |
| Loading | The screen's shape, never an empty screen. | [loading](captures/07-envoyer-chargement.jpg) |
| Load failed | *Your devices didn't load*, the raw detail, *Try again*. | [error](captures/15-erreur-chargement.jpg) |
| Alone in the group | *Add your PC*, and the way to do it. | [alone](captures/16-seul-dans-le-groupe.jpg) |
| Destination not reachable | Why it may be, *Try again*; commands paused until it answers. | [asleep](captures/13-pc-injoignable.jpg) |
| Sending files | Originals of any size as a stream, progress across the batch, *Cancel transfer* between files. | [stream](captures/35-envoi-en-flux.jpg) |
| Waiting for an approval | *Waiting for DESKTOP-…*: its user must allow it. | [waiting](captures/11-attente-approbation.jpg) |
| Landed | Where it landed, felt (haptic) and announced. | [clipboard fetched](captures/12-presse-papiers-recupere.jpg) |
| Refused | A sentence first: *DESKTOP-… said no*, no answer, or *Too large for now* and why (a PC without streams, no direct connection). | [too large](captures/14-trop-lourd.jpg) |
| Only what it offers | The commands follow what the destination lets this phone ask for (an iPad doesn't share its clipboard); with nothing at all, a sentence says so. | [iPad](captures/37-fiche-ipad-clair.jpg) |
| Received from another device | *DESKTOP-… sent you text*: it is on the clipboard. A file comes with *Share*. | [text](captures/10-recu-texte.jpg) |
| Large text | Accessibility size: everything wraps, nothing is cut. | [huge](captures/31-envoyer-texte-accessibilite.jpg) |
| Send to… (`target.tsx`) | Every other device, with whether it answers; the choice is kept. | [sheet](captures/22-envoyer-a.jpg) |

## Devices (tab)

| Screen | What it shows | Captures |
|---|---|---|
| List (`(tabs)/devices/index.tsx`) | Every device, managers first, with its drawing, *Reachable* / *Not reachable* and its role; this phone last. *Add a device* for a phone that manages devices, otherwise which device can. *Stop remote activity*, end-to-end encryption and the preview network, explained on demand. | [dark](captures/17-appareils.jpg) · [Android, light, manages](captures/18-appareils-android-gere.jpg) |
| A device (`(tabs)/devices/[id].tsx`) | The device drawn large (the desktop Showroom's stage, at a phone's scale), whether it answers or when it last did, the commands it offers, its role, system, Passer version and id, *What it shares* (its shared files, each with *Get* and its progress; only for a device offering `file.list` and `file.get`, and a build with streams), and *Recent exchanges* (what was asked, never what was sent). Removal, for a phone that manages devices, with an inline confirmation saying what it does. | [PC](captures/19-fiche-pc.jpg) · [what it shares](captures/38-fiche-pc-partage-clair.jpg) · [exchanges](captures/36-fiche-pc-echanges.jpg) · [iPad](captures/37-fiche-ipad-clair.jpg) · [this phone](captures/20-fiche-ce-telephone.jpg) · [removal](captures/21-fiche-retrait.jpg) |
| Add a device (`invite.tsx`) | First what the new device may do (send and receive, or also manage devices), then the one-time QR, *Expires in m:ss*, *Expired → New code*, the warning that it lets a device in, *Copy link* (*Copied*), *Share the link*. | [role](captures/23-inviter-role.jpg) · [code](captures/24-inviter-code.jpg) |
| A device joined here | The code to compare with the new device; *Remove it* if it differs. | [sheet](captures/25-appareil-rejoint.jpg) |

## Activity (tab)

| State | What it shows | Captures |
|---|---|---|
| Filled | By day: what, to or from which device, where it landed, size, when. A received file opens the share sheet. *Clear* asks first. | [dark](captures/26-activite.jpg) |
| Empty | What will appear, and that it stays on the phone. | [light](captures/27-activite-vide-clair.jpg) |

## Everywhere

| Screen | What it shows | Captures |
|---|---|---|
| Permission request (`approval-prompt.tsx`) | Over any screen, one at a time: who (the device, or the AI agent and its device, with the short id), what (the capability's title, in the app's language when it is one of Passer's), *This request only* and how long it may run, a ring counting down from when it arrived. *Deny* / *Allow once*; no answer is no. A sheet on iOS, a dialog on Android. | [iPhone](captures/08-demande-iphone.jpg) · [Android, light](captures/09-demande-android-clair.jpg) |
| Settings (`settings.tsx`) | This phone's name, haptics, the direct connection (set up, scan again, remove), Shortcuts, Local Network, clearing activity, updates. *Photos go to* only with a direct connection, the only way to the PC clipboard for an image. | [direct connection](captures/28-reglages-connexion-directe.jpg) · [light](captures/29-reglages-clair.jpg) |
