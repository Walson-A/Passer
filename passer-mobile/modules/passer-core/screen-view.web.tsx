import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';

/**
 * Bench stand-in for `PasserScreenView`: a browser can't decode the PC's H.264 the way the
 * phone does, so the bench draws a still Windows desktop, 16:9, letterboxed like the video.
 * It judges the viewer's layout and states, not the picture.
 */
export function BenchScreenView({ style, ...rest }: ViewProps & { sessionId: string }) {
  return (
    <View {...rest} style={[styles.frame, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.screen}>
        <LinearGradient colors={['#0F3B6E', '#2B6CB0', '#7FB3E6']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.window, styles.editor]}>
          <View style={styles.titleBar}>
            <Text style={styles.title} numberOfLines={1}>
              Compte rendu réunion 24 novembre.docx - Word
            </Text>
          </View>
          <View style={styles.page}>
            {[0.9, 0.75, 0.85, 0.6, 0.8, 0.7, 0.4].map((width, index) => (
              <View key={index} style={[styles.line, { width: `${width * 100}%` }]} />
            ))}
          </View>
        </View>
        <View style={[styles.window, styles.browser]}>
          <View style={styles.titleBar}>
            <Text style={styles.title} numberOfLines={1}>
              Devis rénovation cuisine — Edge
            </Text>
          </View>
          <View style={styles.browserBody} />
        </View>
        <View style={styles.taskbar}>
          {['#2563EB', '#F59E0B', '#10B981', '#E11D48', '#8B5CF6'].map((color) => (
            <View key={color} style={[styles.app, { backgroundColor: color }]} />
          ))}
          <Text style={styles.clock}>14:32</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  screen: { width: '100%', aspectRatio: 16 / 9, maxHeight: '100%', overflow: 'hidden' },
  window: { position: 'absolute', backgroundColor: '#F3F3F3', borderRadius: 4, overflow: 'hidden' },
  editor: { left: '8%', top: '10%', width: '52%', height: '66%' },
  browser: { left: '46%', top: '22%', width: '46%', height: '58%', backgroundColor: '#FFFFFF' },
  titleBar: { height: 12, backgroundColor: '#DDE3EA', paddingHorizontal: 4, justifyContent: 'center' },
  title: { fontSize: 6, color: '#333333' },
  page: { flex: 1, margin: 6, backgroundColor: '#FFFFFF', padding: 6, gap: 4 },
  line: { height: 3, borderRadius: 1, backgroundColor: '#C9CED6' },
  browserBody: { flex: 1, margin: 6, backgroundColor: '#EEF2F7', borderRadius: 2 },
  taskbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '7%',
    backgroundColor: 'rgba(32,32,32,0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  app: { width: 9, height: 9, borderRadius: 2 },
  clock: { position: 'absolute', right: 8, color: '#FFFFFF', fontSize: 6 },
});
