import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';

export default function DrawerLayout() {
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
          swipeEnabled: true,
        }}
      >
        <Drawer.Screen 
          name="home" 
          options={{
            drawerLabel: 'Home',
            title: 'Explore Mountains',
          }}
        />
        <Drawer.Screen 
          name="calendar" 
          options={{
            drawerLabel: 'My Hikes',
            title: 'Hiking Schedule',
          }}
        />
        <Drawer.Screen 
          name="../admin/admin" 
          options={{
            drawerLabel: 'Admin Dashboard',
            title: 'Admin',
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
