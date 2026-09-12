import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { BenchLogKind } from '@/platform/web-bench';

import { pairingRoute } from './fixtures';
import { LOG_MESSAGE_SOURCE, type BenchLogEntry } from './log';
import {
  DEVICE_CHOICES,
  DEVICES,
  IPHONE_CLIPBOARDS,
  LANGUAGES,
  loadState,
  PC_CLIPBOARDS,
  REGIMES,
  saveState,
  SCHEMES,
  UPDATES,
  type BenchState,
  type Choice,
} from './state';

type Route = { label: string; path: string; modal: boolean };

const ROUTE_GROUPS: { title: string; routes: Route[] }[] = [
  {
    title: 'Premier lancement',
    routes: [
      { label: 'Bienvenue', path: '/welcome', modal: false },
      { label: 'Scanner le QR code', path: '/scan', modal: true },
      { label: 'Coller le lien', path: '/manual', modal: true },
      { label: 'Appairage', path: pairingRoute(), modal: false },
    ],
  },
  {
    title: 'Au quotidien',
    routes: [
      { label: 'Accueil', path: '/', modal: false },
      { label: 'Récents', path: '/recent', modal: true },
      { label: 'Réglages', path: '/settings', modal: true },
    ],
  },
  {
    title: 'Depuis un widget',
    routes: [
      { label: 'Envoyer le presse-papiers', path: '/action/send-clipboard', modal: false },
      { label: 'Récupérer du PC', path: '/action/pull', modal: false },
      { label: 'Envoyer la dernière capture', path: '/action/send-screenshot', modal: false },
      { label: 'Envoyer puis supprimer la capture', path: '/action/send-and-delete-screenshot', modal: false },
      { label: 'Envoyer une photo', path: '/action/send-photo', modal: false },
      { label: 'Envoyer un fichier', path: '/action/send-file', modal: false },
    ],
  },
];

const ROUTES = ROUTE_GROUPS.flatMap((group) => group.routes);

/** Choices the phone applies live. Any other change relaunches it. */
const LIVE = new Set<keyof BenchState>(['scheme', 'iphoneClipboard', 'pcClipboard']);

const LOG_LABELS: Record<BenchLogKind, string> = {
  haptic: 'Haptique',
  voiceover: 'VoiceOver',
  clipboard: 'Presse-papiers',
  pc: 'PC',
  photos: 'Photos',
  share: 'Partage',
  updates: 'Mises à jour',
};

const RAIL_WIDTH = 252;
const BEZEL = 11;

const INK = {
  page: '#0B0B0C',
  rail: '#121214',
  line: 'rgba(255,255,255,0.07)',
  text: '#ECECE8',
  muted: '#8E8E89',
  faint: '#5F5F5B',
  chip: 'rgba(255,255,255,0.06)',
  active: '#F3F3F0',
  activeText: '#0F0F0F',
};

/** Modal routes need Home underneath, so the phone starts on Home and presents them. */
function frameSource(route: string): string {
  if (ROUTES.find((item) => item.path === route)?.modal) return `/?bench=phone&open=${encodeURIComponent(route)}`;
  return `${route}${route.includes('?') ? '&' : '?'}bench=phone`;
}

function clock(at: number): string {
  return new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * The bench's desk. The phone sits in an iframe the size of the device, so its
 * window, its sheets and its safe areas are the phone's, not the browser's.
 * Screens are on the left; regimes, fixtures and the log on the right.
 */
export function Desk() {
  const [state, setState] = useState(loadState);
  const [generation, setGeneration] = useState(0);
  const [log, setLog] = useState<BenchLogEntry[]>([]);
  const { width, height } = useWindowDimensions();
  const device = DEVICES[state.device];

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: unknown; entry?: BenchLogEntry } | null;
      if (event.origin !== window.location.origin || data?.source !== LOG_MESSAGE_SOURCE || !data.entry) return;
      const entry = data.entry;
      setLog((current) => [entry, ...current].slice(0, 120));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const relaunch = () => {
    setLog([]);
    setGeneration((value) => value + 1);
  };

  const update = (patch: Partial<BenchState>) => {
    const next = { ...state, ...patch };
    saveState(next);
    setState(next);
    if ((Object.keys(patch) as (keyof BenchState)[]).some((key) => !LIVE.has(key))) relaunch();
  };

  const outerWidth = device.width + BEZEL * 2;
  const outerHeight = device.height + BEZEL * 2;
  const scale = Math.max(0.3, Math.min(1, (width - RAIL_WIDTH * 2 - 56) / outerWidth, (height - 76) / outerHeight));

  return (
    <View style={styles.page}>
      <ScrollView style={styles.rail} contentContainerStyle={styles.railContent}>
        <Text style={styles.brand}>Passer · banc</Text>
        <Text style={styles.brandNote}>Les vrais écrans de l’app, face à un faux PC.</Text>
        {ROUTE_GROUPS.map((group) => (
          <Section key={group.title} title={group.title}>
            {group.routes.map((route) => {
              const active = route.path === state.route;
              return (
                <Pressable
                  key={route.path}
                  onPress={() => update({ route: route.path })}
                  style={[styles.link, active && styles.linkActive]}
                >
                  <Text style={[styles.linkText, active && styles.linkTextActive]}>{route.label}</Text>
                </Pressable>
              );
            })}
          </Section>
        ))}
        <Section title="À savoir">
          <Text style={styles.note}>
            Seuls le PC, le trousseau, la photothèque, le bouton Coller d’iOS et les retours haptiques sont simulés. Le reste est le
            code de l’app.
          </Text>
          <Text style={styles.note}>
            Le navigateur n’a pas SF Pro et approche les ombres d’iOS : la mise en page et les états se jugent ici, les volumes sur
            l’iPhone.
          </Text>
        </Section>
      </ScrollView>

      <View style={styles.stage}>
        <View style={{ width: outerWidth * scale, height: outerHeight * scale }}>
          <View
            style={[
              styles.bezel,
              {
                width: outerWidth,
                height: outerHeight,
                borderRadius: device.cornerRadius ? device.cornerRadius + BEZEL : 36,
                transform: [{ scale }],
              },
            ]}
          >
            <iframe
              key={generation}
              title="Passer"
              src={frameSource(state.route)}
              style={{
                width: device.width,
                height: device.height,
                border: 0,
                display: 'block',
                borderRadius: device.cornerRadius,
                backgroundColor: '#000000',
              }}
            />
          </View>
        </View>
        <View style={styles.legend}>
          <Text style={styles.legendText}>
            {`${device.label} · ${device.width} × ${device.height} pt · ${Math.round(scale * 100)} %`}
          </Text>
          <Pressable onPress={relaunch} hitSlop={8}>
            <Text style={styles.legendAction}>Relancer l’app</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={[styles.rail, styles.railRight]} contentContainerStyle={styles.railContent}>
        <Section title="Régime">
          <Choices choices={REGIMES} value={state.regime} onChange={(regime) => update({ regime })} stacked />
        </Section>
        <Section title="Appareil">
          <Choices choices={DEVICE_CHOICES} value={state.device} onChange={(value) => update({ device: value })} />
        </Section>
        <Section title="Apparence">
          <Choices choices={SCHEMES} value={state.scheme} onChange={(scheme) => update({ scheme })} />
        </Section>
        <Section title="Langue de l’iPhone">
          <Choices choices={LANGUAGES} value={state.language} onChange={(language) => update({ language })} />
        </Section>
        <Section title="Presse-papiers de l’iPhone">
          <Choices
            choices={IPHONE_CLIPBOARDS}
            value={state.iphoneClipboard}
            onChange={(iphoneClipboard) => update({ iphoneClipboard })}
          />
        </Section>
        <Section title="Presse-papiers du PC">
          <Choices choices={PC_CLIPBOARDS} value={state.pcClipboard} onChange={(pcClipboard) => update({ pcClipboard })} />
        </Section>
        <Section title="Serveur de mises à jour">
          <Choices choices={UPDATES} value={state.update} onChange={(value) => update({ update: value })} />
        </Section>
        <Section title="Journal">
          {log.length === 0 ? (
            <Text style={styles.note}>Les retours haptiques, les annonces VoiceOver et ce que reçoit le PC s’affichent ici.</Text>
          ) : null}
          {log.map((entry, index) => (
            <View key={`${entry.at}-${index}`} style={styles.logRow}>
              <Text style={styles.logMeta}>{`${clock(entry.at)} · ${LOG_LABELS[entry.kind]}`}</Text>
              <Text style={styles.logText}>{entry.message}</Text>
            </View>
          ))}
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Choices<T extends string>({
  choices,
  value,
  onChange,
  stacked = false,
}: {
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  stacked?: boolean;
}) {
  return (
    <View style={stacked ? styles.stack : styles.chips}>
      {choices.map((choice) => {
        const active = choice.value === value;
        return (
          <Pressable
            key={choice.value}
            onPress={() => onChange(choice.value)}
            style={[stacked ? styles.row : styles.chip, active && styles.chosen]}
          >
            <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>{choice.label}</Text>
            {choice.help ? <Text style={[styles.choiceHelp, active && styles.choiceHelpActive]}>{choice.help}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, flexDirection: 'row', backgroundColor: INK.page },
  rail: { width: RAIL_WIDTH, flexGrow: 0, flexShrink: 0, backgroundColor: INK.rail, borderRightWidth: 1, borderRightColor: INK.line },
  railRight: { borderRightWidth: 0, borderLeftWidth: 1, borderLeftColor: INK.line },
  railContent: { padding: 20, paddingBottom: 40 },
  brand: { color: INK.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  brandNote: { color: INK.muted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  section: { marginTop: 24, gap: 6 },
  sectionTitle: { color: INK.faint, fontSize: 10, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 2 },
  link: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 9 },
  linkActive: { backgroundColor: INK.active },
  linkText: { color: INK.text, fontSize: 14 },
  linkTextActive: { color: INK.activeText, fontWeight: '600' },
  note: { color: INK.muted, fontSize: 12, lineHeight: 18 },
  stage: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 14, overflow: 'hidden' },
  bezel: {
    position: 'absolute',
    top: 0,
    left: 0,
    padding: BEZEL,
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    transformOrigin: 'top left',
    boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  legendText: { color: INK.faint, fontSize: 12, fontVariant: ['tabular-nums'] },
  legendAction: { color: INK.muted, fontSize: 12, textDecorationLine: 'underline' },
  stack: { gap: 3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 9 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: INK.chip },
  chosen: { backgroundColor: INK.active },
  choiceLabel: { color: INK.text, fontSize: 13 },
  choiceLabelActive: { color: INK.activeText, fontWeight: '600' },
  choiceHelp: { color: INK.faint, fontSize: 11, marginTop: 1 },
  choiceHelpActive: { color: '#55554F' },
  logRow: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: INK.line, gap: 2 },
  logMeta: { color: INK.faint, fontSize: 10, fontVariant: ['tabular-nums'] },
  logText: { color: INK.text, fontSize: 12, lineHeight: 17 },
});
