import { useLocalSearchParams } from 'expo-router';
import MountainTop from '../src/screens/MountainTop';

export default function MountainTopRoute() {
  const { mountainId } = useLocalSearchParams();
  return <MountainTop mountainId={mountainId as string} />;
}
