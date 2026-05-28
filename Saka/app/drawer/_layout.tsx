import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import type { DrawerNavigationOptions } from '@react-navigation/drawer';

type LandscapeDrawerOptions = DrawerNavigationOptions & {
  orientation?: 'portrait' | 'landscape';
};

const drawerScreenOptions: LandscapeDrawerOptions = {
  headerShown: false,
  drawerType: 'slide',
  drawerStyle: {
    backgroundColor: '#F5E6D3',
    width: 280,
  },
  overlayColor: 'transparent',
  swipeEnabled: false,
  orientation: 'landscape',
};

const homeScreenOptions: LandscapeDrawerOptions = {
  drawerLabel: 'Home',
  title: 'Explore Mountains',
  orientation: 'landscape',
};

const calendarScreenOptions: LandscapeDrawerOptions = {
  drawerLabel: 'My Hikes',
  title: 'Hiking Schedule',
  orientation: 'landscape',
};

const adminScreenOptions: LandscapeDrawerOptions = {
  drawerLabel: 'Admin Dashboard',
  title: 'Admin',
  orientation: 'landscape',
};

const wildtrackScreenOptions: LandscapeDrawerOptions = {
  drawerLabel: 'WildTrack',
  title: 'WildTrack',
  orientation: 'landscape',
};

export default function DrawerLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar hidden={true} />
      <Drawer screenOptions={drawerScreenOptions}>
        <Drawer.Screen name="home" options={homeScreenOptions} />
        <Drawer.Screen name="calendar" options={calendarScreenOptions} />
        <Drawer.Screen name="admin/[...admin]" options={adminScreenOptions} />
        <Drawer.Screen name="wildtrack" options={wildtrackScreenOptions} />
      </Drawer>
    </GestureHandlerRootView>
  );
}
