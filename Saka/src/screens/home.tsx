import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Dimensions,
  Animated,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuthStore } from '../store/authStore';
import * as ScreenOrientation from 'expo-screen-orientation';
import ProfileCard from '../components/ProfileCard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');

interface Viewpoint {
  id: string;
  name: string;
  x: number;
  y: number;
  latitude?: number;
  longitude?: number;
  elevation?: string;
  notes?: string;
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
  funnyWarning?: string;
}

// Static mountain data with video
const MOUNTAINS: MountainData[] = [
  {
    id: '1',
    name: 'Mt. Madja-as',
    description: 'The highest peak in Antique, known for its mystical cloud formations and stunning views of the Sibalom Natural Park.',
    elevation: '2,117 m',
    difficulty: 'Hard',
    funnyWarning: '⚠️ Warning: Cloud formations may make you feel like a god. Side effects include poetry and crying.',
    videoSource: require('../../assets/Mt.Majaas.mp4'),
    viewpoints: [
      { id: 'v1', name: 'Camp 1', x: 25, y: 65, latitude: 11.3717, longitude: 122.1088 },
      { id: 'v2', name: 'Summit', x: 50, y: 25, latitude: 11.3892, longitude: 122.1629 },
      { id: 'v3', name: 'Lake View', x: 70, y: 55, latitude: 11.3781, longitude: 122.1556 },
    ],
  },
  {
    id: '2',
    name: 'Mt. Guiting-Guiting',
    description: 'Famous for its knife-edge ridge and technical rock formations. A challenging climb for experienced hikers.',
    elevation: '2,058 m',
    difficulty: 'Expert',
    funnyWarning: '⚠️ Warning: The knife-edge ridge has made grown men whisper "I should have just gone to the mall."',
    imageSource: require('../../assets/images/Mt. Guiting-Guiting.jpg'),
    viewpoints: [
      { id: 'v4', name: 'Bontoc Trailhead', x: 30, y: 75, latitude: 11.7350, longitude: 121.8350, elevation: '~500m', notes: 'Start point, guides required' },
      { id: 'v5', name: 'Lower Ridge Camp', x: 40, y: 65, latitude: 11.7420, longitude: 121.8420, elevation: '~1,200m', notes: 'First camp, 4-5 hours' },
      { id: 'v6', name: 'Mid Ridge Section', x: 50, y: 50, latitude: 11.7483, longitude: 121.8483, elevation: '~1,600m', notes: 'Knife-edge ridge, technical' },
      { id: 'v7', name: 'Kiss The Wall', x: 55, y: 40, latitude: 11.7550, longitude: 121.8550, elevation: '~1,850m', notes: 'Famous rock feature' },
      { id: 'v8', name: 'Summit Camp', x: 60, y: 30, latitude: 11.7600, longitude: 121.8600, elevation: '~2,000m', notes: 'Final camp before summit' },
      { id: 'v9', name: 'Mt. Guiting-Guiting Summit', x: 65, y: 20, latitude: 11.7650, longitude: 121.8650, elevation: '~2,058m', notes: 'Technical peak, rope assist' },
    ],
  },
  {
    id: '3',
    name: 'Mt. Pulag',
    description: 'The third highest mountain in the Philippines, famous for its "sea of clouds" sunrise views.',
    elevation: '2,926 m',
    difficulty: 'Moderate',
    funnyWarning: '⚠️ Warning: Sea of clouds looks amazing in photos. In real life, you\'re just very cold and very wet.',
    imageSource: require('../../assets/images/Mt. Pulag.jpg'),
    viewpoints: [
      { id: 'v10', name: 'Ambangeg Trailhead', x: 35, y: 60, latitude: 16.5900, longitude: 121.0200, elevation: '~1,500m', notes: 'Main route, permits at ranger station' },
      { id: 'v11', name: 'First Campsite', x: 40, y: 50, latitude: 16.5930, longitude: 121.0240, elevation: '~1,800m', notes: '2-3 hours from trailhead' },
      { id: 'v12', name: 'Pagoo Ridge', x: 45, y: 40, latitude: 16.5970, longitude: 121.0290, elevation: '~2,300m', notes: 'Open ridgeline with views' },
      { id: 'v13', name: 'Eddet Camp', x: 50, y: 30, latitude: 16.6000, longitude: 121.0320, elevation: '~2,600m', notes: 'Famous sea of clouds spot' },
      { id: 'v14', name: 'Summit Ridge', x: 55, y: 20, latitude: 16.6011, longitude: 121.0306, elevation: '~2,900m', notes: 'Final push to summit' },
      { id: 'v15', name: 'Mt. Pulag Summit', x: 60, y: 15, latitude: 16.6020, longitude: 121.0315, elevation: '~2,926m', notes: 'Monument peak, 360° views' },
    ],
  },
  {
    id: '4',
    name: 'Mt. Apo',
    description: 'The highest mountain in the Philippines. An active volcano with hot springs and diverse ecosystems.',
    elevation: '2,954 m',
    difficulty: 'Hard',
    funnyWarning: '⚠️ Warning: It\'s literally a volcano. If it erupts, your emergency plan is "run faster than lava."',
    imageSource: require('../../assets/images/Mt. Apo.jpg'),
    viewpoints: [
      { id: 'v16', name: 'Kapatagan Trailhead', x: 35, y: 70, latitude: 6.9700, longitude: 125.3300, elevation: '~600m', notes: 'Main jump-off, gov permits required' },
      { id: 'v17', name: 'Lake Venado Camp', x: 40, y: 60, latitude: 6.9800, longitude: 125.3350, elevation: '~1,500m', notes: 'Alpine lake, 5-6 hours' },
      { id: 'v18', name: 'Rainforest Junction', x: 45, y: 50, latitude: 6.9850, longitude: 125.3400, elevation: '~1,800m', notes: 'Rich biodiversity zone' },
      { id: 'v19', name: 'Crater Rim Trail', x: 55, y: 40, latitude: 6.9950, longitude: 125.3475, elevation: '~2,500m', notes: 'Crater views and geothermal features' },
      { id: 'v20', name: 'Boulders Camp', x: 60, y: 30, latitude: 7.0000, longitude: 125.3520, elevation: '~2,800m', notes: 'Rocky alpine landscape' },
      { id: 'v21', name: 'Mt. Apo Summit', x: 68, y: 18, latitude: 7.0060, longitude: 125.3561, elevation: '~2,954m', notes: 'Highest peak in Philippines, active volcano' },
    ],
  },
  {
    id: '5',
    name: 'Mt. Mayon',
    description: 'The most perfectly cone-shaped volcano in the world. A challenging hike with breathtaking views.',
    elevation: '2,463 m',
    difficulty: 'Hard',
    funnyWarning: '⚠️ Warning: "Perfect cone" does not mean easy climb. Your knees will have notes.',
    imageSource: require('../../assets/images/Mt. Mayon.jpg'),
    viewpoints: [
      { id: 'v22', name: 'Cagsawa Trailhead', x: 30, y: 75, latitude: 13.2400, longitude: 123.6800, elevation: '~500m', notes: 'Most popular route, permits needed' },
      { id: 'v23', name: 'Base Camp', x: 35, y: 65, latitude: 13.2450, longitude: 123.6850, elevation: '~1,200m', notes: '3-4 hours, water available' },
      { id: 'v24', name: 'Mid Slope Marker', x: 42, y: 50, latitude: 13.2500, longitude: 123.6880, elevation: '~1,700m', notes: 'Steep terrain begins' },
      { id: 'v25', name: 'Crater Rim', x: 50, y: 35, latitude: 13.2573, longitude: 123.6911, elevation: '~2,300m', notes: 'Final push, volcanic ash' },
      { id: 'v26', name: 'Mt. Mayon Summit', x: 55, y: 25, latitude: 13.2600, longitude: 123.6940, elevation: '~2,463m', notes: 'Perfect cone, scenic views' },
      { id: 'v27', name: 'Crater Lake Viewpoint', x: 52, y: 42, latitude: 13.2545, longitude: 123.6883, elevation: '~2,400m', notes: 'Alternative descent route' },
    ],
  },
  {
    id: '6',
    name: 'Mt. Batulao',
    description: 'A beginner-friendly mountain with rolling hills and scenic views of Batangas. Perfect for first-timers.',
    elevation: '811 m',
    difficulty: 'Easy',
    funnyWarning: '⚠️ Warning: "Easy" is relative. Your officemates said the same thing about the team building.',
    imageSource: require('../../assets/images/Mt.Batulao.jpg'),
    viewpoints: [
      { id: 'v28', name: 'Old Trail Junction', x: 25, y: 55, latitude: 13.7750, longitude: 120.8750, elevation: '~300m', notes: 'Beginner-friendly route' },
      { id: 'v29', name: 'Forest Section', x: 35, y: 45, latitude: 13.7800, longitude: 120.8800, elevation: '~500m', notes: 'Shaded trail, 1-2 hours' },
      { id: 'v30', name: 'Open Plateau', x: 45, y: 35, latitude: 13.7840, longitude: 120.8840, elevation: '~700m', notes: 'Grassland with views' },
      { id: 'v31', name: 'New Trail Route', x: 70, y: 50, latitude: 13.7900, longitude: 120.8900, elevation: '~550m', notes: 'Scenic alternate descent' },
      { id: 'v32', name: 'Summit Rest Point', x: 50, y: 25, latitude: 13.7867, longitude: 120.8867, elevation: '~811m', notes: 'Two peaks, Batangas views' },
      { id: 'v33', name: 'Sunset Viewpoint', x: 48, y: 30, latitude: 13.7860, longitude: 120.8860, elevation: '~800m', notes: 'Popular photo spot' },
    ],
  },
  {
    id: '7',
    name: 'Mt. Maculot',
    description: 'Known for its famous Rockies viewpoint overlooking Taal Lake. A popular day hike near Manila.',
    elevation: '930 m',
    difficulty: 'Easy',
    funnyWarning: '⚠️ Warning: You will take 47 photos of Taal Lake. Only 3 will be shareable.',
    imageSource: require('../../assets/images/Mt. Maculot.jpg'),
    viewpoints: [
      { id: 'v34', name: 'Sto. Tomas Trailhead', x: 25, y: 70, latitude: 13.8640, longitude: 120.9850, elevation: '~200m', notes: 'Easy starting point' },
      { id: 'v35', name: 'Grotto Shrine', x: 25, y: 60, latitude: 13.8650, longitude: 120.9860, elevation: '~400m', notes: 'Religious site, 30 mins' },
      { id: 'v36', name: 'Mid Trail Camp', x: 35, y: 50, latitude: 13.8680, longitude: 120.9880, elevation: '~650m', notes: '1 hour from Grotto' },
      { id: 'v37', name: 'Cable Bridge Area', x: 42, y: 42, latitude: 13.8700, longitude: 120.9890, elevation: '~800m', notes: 'Famous adventure spot' },
      { id: 'v38', name: 'The Rockies', x: 60, y: 40, latitude: 13.8747, longitude: 120.9917, elevation: '~920m', notes: 'Rock formations, Taal Lake view' },
      { id: 'v39', name: 'Mt. Maculot Summit', x: 40, y: 35, latitude: 13.8694, longitude: 120.9894, elevation: '~930m', notes: 'Monument peak, day hike' },
    ],
  },
  {
    id: '8',
    name: 'Mt. Ulap',
    description: 'Famous for its scenic grassland ridges and pine tree forests. The famous Gungal Rock is here.',
    elevation: '2,086 m',
    difficulty: 'Moderate',
    funnyWarning: '⚠️ Warning: Grassland ridges have zero shade. SPF 15 is not negotiable. You\'ve been warned.',
    imageSource: require('../../assets/images/Mt. Ulap.jpg'),
    viewpoints: [
      { id: 'v40', name: 'Dakak Trailhead', x: 30, y: 60, latitude: 16.5650, longitude: 120.8980, elevation: '~1,200m', notes: 'Mountain tourism area' },
      { id: 'v41', name: 'Ambanao Ridge Start', x: 35, y: 50, latitude: 16.5728, longitude: 120.9061, elevation: '~1,400m', notes: 'Grassland begins, 2-3 hours' },
      { id: 'v42', name: 'Pine Forest Section', x: 45, y: 42, latitude: 16.5765, longitude: 120.9095, elevation: '~1,600m', notes: 'Beautiful forest zone' },
      { id: 'v43', name: 'Gungal Rock', x: 55, y: 45, latitude: 16.5795, longitude: 120.9128, elevation: '~1,850m', notes: 'Famous boulder formation' },
      { id: 'v44', name: 'Upper Ridge Camp', x: 60, y: 35, latitude: 16.5830, longitude: 120.9160, elevation: '~2,000m', notes: 'Alpine meadows' },
      { id: 'v45', name: 'Mt. Ulap Summit', x: 45, y: 25, latitude: 16.5850, longitude: 120.9183, elevation: '~2,086m', notes: 'Twin peaks, Cordillera views' },
    ],
  },
  {
    id: '9',
    name: 'Mt. Pinatubo',
    description: 'A dormant volcano famous for its stunning crater lake formed after the 1991 eruption.',
    elevation: '1,486 m',
    difficulty: 'Moderate',
    funnyWarning: '⚠️ Warning: "Dormant" just means it\'s napping. Please do not wake the volcano.',
    imageSource: require('../../assets/images/Mt. Pinatubo.jpg'),
    viewpoints: [
      { id: 'v46', name: 'Santa Juliana Trailhead', x: 25, y: 75, latitude: 15.1200, longitude: 120.3300, elevation: '~500m', notes: 'Jeepney access available' },
      { id: 'v47', name: 'Lahar Valley Start', x: 30, y: 70, latitude: 15.1250, longitude: 120.3350, elevation: '~700m', notes: 'Gray volcanic sand' },
      { id: 'v48', name: 'Mid Valley Marker', x: 40, y: 65, latitude: 15.1300, longitude: 120.3400, elevation: '~1,000m', notes: '2-3 hours of hiking' },
      { id: 'v49', name: 'Crater Approach', x: 50, y: 55, latitude: 15.1350, longitude: 120.3450, elevation: '~1,300m', notes: 'Steep final push' },
      { id: 'v50', name: 'Crater Lake', x: 50, y: 40, latitude: 15.1383, longitude: 120.3500, elevation: '~1,486m', notes: 'Crater lake, post-eruption' },
      { id: 'v51', name: 'Crater Rim Overlook', x: 48, y: 50, latitude: 15.1370, longitude: 120.3475, elevation: '~1,450m', notes: 'Best crater views' },
    ],
  },
  {
    id: '10',
    name: 'Mt. Kanlaon',
    description: 'The highest peak in Negros and one of the most active volcanoes in the Philippines.',
    elevation: '2,465 m',
    difficulty: 'Hard',
    funnyWarning: '⚠️ Warning: Most active volcano in the Philippines. Your travel insurance agent already knows.',
    imageSource: require('../../assets/images/Mt. Kanlaon.jpg'),
    viewpoints: [
      { id: 'v52', name: 'Mananaon Trailhead', x: 35, y: 70, latitude: 10.3900, longitude: 123.1200, elevation: '~600m', notes: 'Main route, guides required' },
      { id: 'v53', name: 'Forest Zone Camp', x: 40, y: 60, latitude: 10.3950, longitude: 123.1250, elevation: '~1,300m', notes: '4-5 hours, shade available' },
      { id: 'v54', name: 'Alpine Transition', x: 48, y: 50, latitude: 10.4000, longitude: 123.1300, elevation: '~1,800m', notes: 'Temperature drops, open view' },
      { id: 'v55', name: 'Sulphur Vent Area', x: 40, y: 55, latitude: 10.4025, longitude: 123.1319, elevation: '~2,100m', notes: 'Geothermal features' },
      { id: 'v56', name: 'Summit Crater Camp', x: 50, y: 30, latitude: 10.4056, longitude: 123.1350, elevation: '~2,400m', notes: 'Final camp before summit' },
      { id: 'v57', name: 'Mt. Kanlaon Summit', x: 55, y: 22, latitude: 10.4080, longitude: 123.1370, elevation: '~2,465m', notes: 'Active crater, highest in Negros' },
      { id: 'v58', name: 'Margaja Valley', x: 65, y: 60, latitude: 10.4100, longitude: 123.1394, elevation: '~2,300m', notes: 'Scenic crater valley' },
    ],
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const [dimensions, setDimensions] = useState(Dimensions.get('screen'));
  const [profileCardVisible, setProfileCardVisible] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const isPortrait = dimensions.height > dimensions.width;

  useEffect(() => {
    // Force landscape orientation for the home screen
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    
    const subscription = Dimensions.addEventListener('change', ({ screen }) => {
      setDimensions(screen);
    });
    return () => {
      subscription?.remove();
      // Restore default orientation on unmount
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT);
    };
  }, []);

  const openProfileCard = () => setProfileCardVisible(true);
  const closeProfileCard = () => setProfileCardVisible(false);

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

  const DIFFICULTY_COLORS: Record<string, string> = {
    Easy: '#4CAF81',
    Moderate: '#F0A500',
    Hard: '#E05C3A',
    Expert: '#C0392B',
  };

  const renderMountainScreen = (mountain: MountainData, index: number) => {
    const isActive = index === activeIndex;
    const { width, height } = dimensions;
    const locked = mountain.id !== '1';
    const diffColor = DIFFICULTY_COLORS[mountain.difficulty] ?? '#FFF';
    const previousMountain = locked ? MOUNTAINS[index - 1] : null;

    return (
      <View
        key={mountain.id}
        style={[styles.fullScreenContainer, { width, height }]}
      >
        {/* Background */}
        <View style={styles.videoWrapper}>
          {mountain.videoSource ? (
            <VideoViewPlayer source={mountain.videoSource} isActive={isActive} />
          ) : mountain.imageSource ? (
            <Image
              source={mountain.imageSource}
              style={styles.fullScreenImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.fullScreenImagePlaceholder}>
              <Ionicons name="image-outline" size={80} color="#8B7355" />
            </View>
          )}
        </View>

        {/* Gradient overlay — stronger at bottom for legibility */}
        <View style={[styles.fullScreenGradient, locked && styles.fullScreenGradientLocked]} />

        {/* ── Unlocked: info panel ── */}
        {!locked && (
          <View style={[styles.floatingInfoContainer, isPortrait && styles.floatingInfoContainerPortrait]}>
            {/* Funny warning */}
            {mountain.funnyWarning && (
              <Text style={styles.funnyWarningText}>{mountain.funnyWarning}</Text>
            )}
            {/* Difficulty + elevation row */}
            <View style={styles.infoMetaRow}>
              <View style={[styles.difficultyBadge, { borderColor: diffColor }]}>
                <View style={[styles.difficultyDot, { backgroundColor: diffColor }]} />
                <Text style={[styles.difficultyText, { color: diffColor }]}>{mountain.difficulty}</Text>
              </View>
              <View style={styles.elevationPill}>
                <Ionicons name="trending-up-outline" size={11} color="rgba(255,255,255,0.7)" />
                <Text style={styles.elevationText}>{mountain.elevation}</Text>
              </View>
            </View>

            {/* Mountain name */}
            <Text
              style={[styles.floatingMountainName, isPortrait && styles.floatingMountainNamePortrait]}
              numberOfLines={1}
            >
              {mountain.name}
            </Text>

            {/* Short description */}
            <Text style={styles.mountainDescription} numberOfLines={2}>
              {mountain.description}
            </Text>
          </View>
        )}

        {/* Per-page CTA removed — global CTA rendered outside scroll for reliable touches */}

        {/* ── Locked: atmospheric overlay ── */}
        {locked && (
          <View style={styles.lockOverlay}>
            <View style={styles.lockCard}>
              <Ionicons name="lock-closed" size={22} color="rgba(255,255,255,0.6)" />
              <View style={styles.lockCardText}>
                <Text style={styles.lockCardName} numberOfLines={1}>{mountain.name}</Text>
                {previousMountain && (
                  <Text style={styles.lockCardSub}>
                    <Text style={styles.lockCardSubItalic}>
                      {`"Summit `}
                      <Text style={styles.lockCardSubBold}>{previousMountain.name}</Text>
                      {` first to unlock this peak."`}
                    </Text>
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
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

      {/* Floating Header */}
      <View style={[styles.transparentHeader, !isPortrait && styles.transparentHeaderLandscape]}>
        {MOUNTAINS[activeIndex]?.id === '1' && (
          <TouchableOpacity
            onPress={openProfileCard}
            style={styles.profileButton}
            activeOpacity={0.8}
          >
            {/* Avatar with gold ring */}
            <View style={styles.profileAvatarRing}>
              <View style={styles.profileAvatar}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.profileAvatarImage} />
                ) : (
                  <Text style={styles.profileInitials}>
                    {user?.name?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'H'}
                  </Text>
                )}
              </View>
            </View>
            {/* Text */}
            <View style={styles.profileTextContainer}>
              <Text style={styles.profileGreeting}>Hi,</Text>
              <Text style={styles.profileName} numberOfLines={1}>
                {user?.name?.split(' ')[0] || 'Hiker'}
              </Text>
            </View>
            {/* Chevron hint */}
            <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.5)" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        )}
      </View>

      <ProfileCard visible={profileCardVisible} onClose={closeProfileCard} profileImage={profileImage} />

      {/* Global CTA overlay placed outside of the scroll/video to avoid native view touch blocking */}
      {MOUNTAINS[activeIndex] && MOUNTAINS[activeIndex].id === '1' && (
        <TouchableOpacity
          style={[styles.ctaButton, styles.ctaAbsolute, isPortrait && styles.ctaAbsolutePortrait]}
          onPress={() => { console.log('Tara Saka pressed'); router.push('/MountainTop'); }}
          activeOpacity={0.85}
        >
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoPlaceholderText}>Logo</Text>
          </View>
          <Text style={styles.ctaText}>Tara, Saka</Text>
          <Ionicons name="arrow-forward" size={13} color="#FFF" />
        </TouchableOpacity>
      )}

      {/* Pagination — fixed at vertical center of right edge */}
      <View style={styles.paginationFixed}>
        <View style={styles.paginationStack}>
          {MOUNTAINS.map((mountain, index) => {
            const isActiveDot = index === activeIndex;
            const locked = mountain.id !== '1';

            if (locked) {
              return (
                <View key={index} style={styles.paginationLockWrap}>
                  <Ionicons
                    name="lock-closed"
                    size={8}
                    color={isActiveDot ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)'}
                  />
                </View>
              );
            }

            return (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  isActiveDot ? styles.paginationDotActive : styles.paginationDotInactive,
                ]}
              />
            );
          })}
        </View>
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
    borderRightWidth: 2,
    borderRightColor: 'rgba(201,169,110,0.3)',
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
    // Strong bottom vignette for info legibility, light top for header
    backgroundColor: 'transparent',
    // Simulated with a bottom-heavy dark layer
    borderBottomWidth: 0,
    // We use two overlapping Views for gradient effect
  },
  fullScreenGradientLocked: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    zIndex: 20,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  lockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  lockCardText: {
    gap: 2,
    flex: 1,
  },
  lockCardName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '700',
  },
  lockCardSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    letterSpacing: 0.3,
  },
  lockCardSubItalic: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  lockCardSubBold: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontStyle: 'italic',
    fontWeight: '700',
  },
  funnyWarningText: {
    color: 'rgba(255,255,220,0.7)',
    fontSize: 10,
    fontStyle: 'italic',
    marginBottom: 10,
    maxWidth: '65%',
    lineHeight: 14,
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
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    paddingHorizontal: 24,
    paddingBottom: 22,
    paddingTop: 40,
    // Bottom gradient via backgroundColor layering
    backgroundColor: 'rgba(0,0,0,0)',
  },
  floatingInfoContainerPortrait: {
    paddingBottom: 36,
  },
  ctaAbsolute: {
    position: 'absolute',
    bottom: 22,
    right: 24,
    zIndex: 250,
    elevation: 10,
  },
  ctaAbsolutePortrait: {
    bottom: 36,
  },

  infoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  elevationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  elevationText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '600',
  },
  mountainDescription: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    lineHeight: 17,
    maxWidth: '65%',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    gap: 8,
  },
  ctaText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  openMapButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 10,
  },
  logoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  floatingMountainName: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFF',
    lineHeight: 46,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    marginBottom: 6,
  },
  floatingMountainNamePortrait: {
    fontSize: 52,
    lineHeight: 56,
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
  transparentHeaderLandscape: {
    paddingTop: 18,
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
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingRight: 14,
    paddingLeft: 6,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  profileAvatarRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#C9A96E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
  },
  profileInitials: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  profileTextContainer: {
    justifyContent: 'center',
  },
  profileGreeting: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    lineHeight: 12,
  },
  profileName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 15,
  },

  
  // Pagination fixed at vertical center of right edge
  paginationFixed: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },

  paginationStack: {
    alignItems: 'center',
    gap: 5,
  },
  paginationDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  paginationDotActive: {
    backgroundColor: '#FFF',
    width: 5,
    height: 14,
    borderRadius: 3,
  },
  paginationDotInactive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  paginationLockWrap: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

});