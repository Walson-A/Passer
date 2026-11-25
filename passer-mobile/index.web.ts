/**
 * Web entry: the bench, never the app. Metro prefers this file to `index.ts`
 * when bundling for the web. See `docs/mobile/bench.md`.
 */
import '@expo/metro-runtime';
import './bench/boot';

import { registerRootComponent } from 'expo';

import { Bench } from './bench/bench';

registerRootComponent(Bench);
