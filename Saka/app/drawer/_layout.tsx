import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../../src/store/authStore';

export default function DrawerLayout() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const adminRouteActive = pathname?.startsWith('/drawer/admin');
  const swipeEnabled = Boolean(user?.is_admin && adminRouteActive);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar hidden={true} />
      <Drawer
        screenOptions={{
          headerShown: false,
          drawerType: 'slide',
          drawerStyle: {
            backgroundColor: '#F5E6D3',
            width: 280,
          },
          overlayColor: 'transparent',
          swipeEnabled,
          orientation: 'landscape',
        }}
      >
        <Drawer.Screen 
          name="home" 
          options={{
            drawerLabel: 'Home',
            title: 'Explore Mountains',
            orientation: 'landscape',
          }}
        />
        <Drawer.Screen 
          name="calendar" 
          options={{
            drawerLabel: 'My Hikes',
            title: 'Hiking Schedule',
            orientation: 'landscape',
          }}
        />
        <Drawer.Screen 
          name="admin/[...admin]" 
          options={{
            drawerLabel: 'Admin Dashboard',
            title: 'Admin',
            orientation: 'landscape',
          }}
        />
        <Drawer.Screen
          name="wildtrack"
          options={{
            drawerLabel: 'WildTrack',
            title: 'WildTrack',
            orientation: 'landscape',
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
