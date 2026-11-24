import { Redirect } from 'expo-router';

/** Unknown `passer://` links land on the home screen instead of a dead end. */
export default function NotFound() {
  return <Redirect href="/" />;
}
