import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  StyleSheet,
  Image,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuthStore } from '../store/authStore';
import * as ScreenOrientation from 'expo-screen-orientation';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');

interface Viewpoint {
  id: string;
  name: string;
  x: number;
  y: number;
}

interface Mountain {
  id: string;
  name: string;
  viewpoints: Viewpoint[];
}

interface MountainData extends Mountain {
  videoSource?: any;
  imageSource?: any;
  description: string;
  elevation: string;
  difficulty: 'Easy' | 'Moderate' | 'Hard' | 'Expert';
}

// Static mountain data with video
const MOUNTAINS: MountainData[] = [
  {
    id: '1',
    name: 'Mt. Madja-as',
    description: 'The highest peak in Antique, known for its mystical cloud formations and stunning views of the Sibalom Natural Park.',
    elevation: '2,117 m',
    difficulty: 'Hard',
    videoSource: require('../../assets/Mt.Majaas.mp4'),
    viewpoints: [
      { id: 'v1', name: 'Camp 1', x: 25, y: 65 },
      { id: 'v2', name: 'Summit', x: 50, y: 25 },
      { id: 'v3', name: 'Lake View', x: 70, y: 55 },
    ],
  },
  {
    id: '2',
    name: 'Mt. Guiting-Guiting',
    description: 'Famous for its knife-edge ridge and technical rock formations. A challenging climb for experienced hikers.',
    elevation: '2,058 m',
    difficulty: 'Expert',
    imageSource: require('../../assets/images/Mt. Guiting-Guiting.jpg'),
    viewpoints: [
      { id: 'v4', name: 'Base Camp', x: 30, y: 75 },
      { id: 'v5', name: 'Kiss the Wall', x: 55, y: 40 },
    ],
  },
  {
    id: '3',
    name: 'Mt. Pulag',
    description: 'The third highest mountain in the Philippines, famous for its "sea of clouds" sunrise views.',
    elevation: '2,926 m',
    difficulty: 'Moderate',
    imageSource: require('../../assets/images/Mt. Pulag.jpg'),
    viewpoints: [
      { id: 'v6', name: 'Ambangeg Trail', x: 35, y: 60 },
      { id: 'v7', name: 'Summit', x: 50, y: 20 },
      { id: 'v8', name: 'Camp 2', x: 65, y: 45 },
    ],
  },
  {
    id: '4',
    name: 'Mt. Apo',
    description: 'The highest mountain in the Philippines. An active volcano with hot springs and diverse ecosystems.',
    elevation: '2,954 m',
    difficulty: 'Hard',
    imageSource: require('../../assets/images/Mt. Apo.jpg'),
    viewpoints: [
      { id: 'v9', name: 'Lake Venado', x: 40, y: 50 },
      { id: 'v10', name: 'Boulders', x: 55, y: 30 },
      { id: 'v11', name: 'Summit Crater', x: 45, y: 25 },
    ],
  },
  {
    id: '5',
    name: 'Mt. Mayon',
    description: 'The most perfectly cone-shaped volcano in the world. A challenging hike with breathtaking views.',
    elevation: '2,463 m',
    difficulty: 'Hard',
    imageSource: require('../../assets/images/Mt. Mayon.jpg'),
    viewpoints: [
      { id: 'v12', name: 'Base Camp', x: 30, y: 70 },
      { id: 'v13', name: 'Crater Rim', x: 50, y: 35 },
    ],
  },
  {
    id: '6',
    name: 'Mt. Batulao',
    description: 'A beginner-friendly mountain with rolling hills and scenic views of Batangas. Perfect for first-timers.',
    elevation: '811 m',
    difficulty: 'Easy',
    imageSource: require('../../assets/images/Mt.Batulao.jpg'),
    viewpoints: [
      { id: 'v14', name: 'Old Trail', x: 25, y: 55 },
      { id: 'v15', name: 'New Trail', x: 75, y: 60 },
      { id: 'v16', name: 'Summit View', x: 50, y: 30 },
    ],
  },
  {
    id: '7',
    name: 'Mt. Maculot',
    description: 'Known for its famous Rockies viewpoint overlooking Taal Lake. A popular day hike near Manila.',
    elevation: '930 m',
    difficulty: 'Easy',
    imageSource: require('../../assets/images/Mt. Maculot.jpg'),
    viewpoints: [
      { id: 'v17', name: 'Rockies', x: 60, y: 40 },
      { id: 'v18', name: 'Summit', x: 40, y: 35 },
      { id: 'v19', name: 'Grotto', x: 25, y: 65 },
    ],
  },
  {
    id: '8',
    name: 'Mt. Ulap',
    description: 'Famous for its scenic grassland ridges and pine tree forests. The famous Gungal Rock is here.',
    elevation: '2,086 m',
    difficulty: 'Moderate',
    imageSource: require('../../assets/images/Mt. Ulap.jpg'),
    viewpoints: [
      { id: 'v20', name: 'Ambanao Ridge', x: 35, y: 50 },
      { id: 'v21', name: 'Gungal Rock', x: 55, y: 45 },
      { id: 'v22', name: 'Mt. Ulap Summit', x: 45, y: 25 },
    ],
  },
  {
    id: '9',
    name: 'Mt. Pinatubo',
    description: 'A dormant volcano famous for its stunning crater lake formed after the 1991 eruption.',
    elevation: '1,486 m',
    difficulty: 'Moderate',
    imageSource: require('../../assets/images/Mt. Pinatubo.jpg'),
    viewpoints: [
      { id: 'v23', name: 'Crater Lake', x: 50, y: 40 },
      { id: 'v24', name: 'Lahar Valley', x: 30, y: 70 },
    ],
  },
  {
    id: '10',
    name: 'Mt. Kanlaon',
    description: 'The highest peak in Negros and one of the most active volcanoes in the Philippines.',
    elevation: '2,465 m',
    difficulty: 'Hard',
    imageSource: require('../../assets/images/Mt. Kanlaon.jpg'),
    viewpoints: [
      { id: 'v25', name: 'Sulphur Vent', x: 40, y: 55 },
      { id: 'v26', name: 'Summit Crater', x: 50, y: 30 },
      { id: 'v27', name: 'Margaja Valley', x: 65, y: 60 },
    ],
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const [dimensions, setDimensions] = useState(Dimensions.get('screen'));
  const [menuVisible, setMenuVisible] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;

  const isPortrait = dimensions.height > dimensions.width;

  useEffect(() => {
    // Allow all orientations programmatically
    ScreenOrientation.unlockAsync();
    
    const subscription = Dimensions.addEventListener('change', ({ screen }) => {
      setDimensions(screen);
    });
    return () => {
      subscription?.remove();
      // Lock back to default on unmount
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT);
    };
  }, []);

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  // Video Player Component - Always mounted, controlled by isActive
  const VideoViewPlayer = ({ source, isActive }: { source: any; isActive: boolean }) => {
    const player = useVideoPlayer(source, (player) => {
      player.loop = true;
      player.muted = true;
      player.staysActiveInBackground = true;
    });

    // Handle play/pause based on active state
    useEffect(() => {
      if (isActive) {
        player.play();
      } else {
        player.pause();
      }
    }, [isActive, player]);

    return (
      <VideoView
        style={[styles.fullScreenVideo, !isActive && styles.hiddenVideo]}
        player={player}
        nativeControls={false}
        contentFit="cover"
      />
    );
  };

  const renderMountainScreen = (mountain: MountainData, index: number) => {
    const isActive = index === activeIndex;
    const { width, height } = dimensions;
    
    return (
      <View 
        key={mountain.id} 
        style={[styles.fullScreenContainer, { width, height }]}
      >
        {/* Full Screen Video or Image Background */}
        <View style={styles.videoWrapper}>
          {mountain.videoSource ? (
            <VideoViewPlayer source={mountain.videoSource} isActive={isActive} />
          ) : mountain.imageSource ? (
            <Image 
              source={mountain.imageSource} 
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.fullScreenImagePlaceholder}>
              <Ionicons name="image-outline" size={80} color="#8B7355" />
            </View>
          )}
        </View>
        
        {/* Dark Gradient Overlay for text readability */}
        <View style={styles.fullScreenGradient} />

        {/* Floating Mountain Info - Bottom */}
        <View style={[styles.floatingInfoContainer, isPortrait && styles.floatingInfoContainerPortrait]}>
          <Text style={[styles.floatingMountainName, isPortrait && styles.floatingMountainNamePortrait]}>{mountain.name}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.immersiveContainer}>
      {/* Full Screen Horizontal Scroll */}
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(event) => {
          const newIndex = Math.round(event.nativeEvent.contentOffset.x / dimensions.width);
          setActiveIndex(newIndex);
        }}
        decelerationRate="fast"
        key={`${dimensions.width}x${dimensions.height}`}
      >
        {MOUNTAINS.map((mountain, index) => renderMountainScreen(mountain, index))}
      </Animated.ScrollView>

      {/* Floating Transparent Header - Orientation Aware */}
      <View style={[styles.transparentHeader, isPortrait && styles.transparentHeaderPortrait]}>
        <View>
          <Text style={styles.transparentTitle}>Explore</Text>
          <Text style={styles.transparentSubtitle}>
            Welcome, {user?.name || 'Hiker'}
          </Text>
        </View>
        <TouchableOpacity onPress={openMenu} style={styles.transparentMenu}>
          <Ionicons name="menu" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={closeMenu}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPressOut={closeMenu}>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Menu</Text>
            <TouchableOpacity style={styles.menuItem} onPress={() => { closeMenu(); router.push('./calendar'); }}>
              <Text style={styles.menuItemText}>My Hikes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { closeMenu(); router.push('./wildtrack'); }}>
              <Text style={styles.menuItemText}>WildTrack</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={closeMenu}>
              <Text style={styles.menuItemText}>Explore Mountains</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { closeMenu(); signOut(); }}>
              <Text style={styles.menuItemText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Floating Pagination - Right of Mountain Name */}
      <View style={[styles.floatingPagination, isPortrait && styles.floatingPaginationPortrait]}>
        {MOUNTAINS.map((_, index) => (
          <View
            key={index}
            style={[
              styles.floatingDot,
              index === activeIndex ? styles.floatingDotActive : styles.floatingDotInactive
            ]}
          />
        ))}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  immersiveContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  // Full Screen Mountain View
  fullScreenContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  videoWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hiddenVideo: {
    opacity: 0,
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
  },
  fullScreenImagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#2C3E50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  
  // Floating Viewpoints
  floatingViewpoint: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 20,
  },
  viewpointDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#2C3E50',
  },
  viewpointLabelFloat: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  viewpointTextFloat: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  
  // Floating Info at Bottom
  floatingInfoContainer: {
    position: 'absolute',
    bottom: 20,
    left: 24,
    zIndex: 30,
    maxWidth: '70%',
  },
  floatingInfoContainerPortrait: {
    bottom: 25,
  },
  floatingMountainName: {
    fontSize: 58,
    fontWeight: '900',
    color: '#FFF',
    lineHeight: 62,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  floatingMountainNamePortrait: {
    fontSize: 68,
  },
  floatingElevation: {
    fontSize: 14,
    color: '#FFF',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  floatingDifficultyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  floatingDifficultyText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Transparent Floating Header
  transparentHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    zIndex: 100,
  },
  transparentHeaderPortrait: {
    paddingTop: 60,
  },
  transparentTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  transparentSubtitle: {
    fontSize: 14,
    color: '#FFF',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  transparentLogout: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
  },
  transparentMenu: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuContent: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  menuTitle: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  menuItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  menuItemText: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Floating Pagination
  floatingPagination: {
    position: 'absolute',
    bottom: 20,
    right: 24,
    flexDirection: 'row',
    zIndex: 100,
    gap: 6,
    alignSelf: 'flex-start',
  },
  floatingPaginationPortrait: {
    bottom: 25,
  },
  floatingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  floatingDotActive: {
    backgroundColor: '#FFF',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  floatingDotInactive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  
  // Floating Navigation Buttons
  floatingNavContainer: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    zIndex: 100,
  },
  floatingNavContainerPortrait: {
    bottom: 50,
  },
  floatingNavButtonPortrait: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  floatingNavTextPortrait: {
    fontSize: 13,
  },
  floatingNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    gap: 8,
  },
  floatingNavText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
