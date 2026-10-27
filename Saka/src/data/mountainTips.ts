export interface Alert {
  type: 'danger' | 'warning' | 'info';
  title: string;
  message: string;
  date?: string;
}

export interface MountainTips {
  id: string;
  mountainName: string;
  preparation: string[];
  safety: string[];
  transportation: string[];
  trailTips: string[];
  etiquette: string[];
  alerts: Alert[];
}

export const MOUNTAIN_TIPS: MountainTips[] = [
  {
    id: '219d0ca0-dba5-41cd-b6cd-414c5d7e98e6',
    mountainName: 'Mt. Madja-as',
    preparation: [
      'Major climb, rated 8/9 difficulty. Plan for 3–4 days, with about 14 hours to the summit.',
      'A guide is mandatory. Register at Culasi Police Station before the hike.',
      'Permit: ₱150 per person per day; barangay fee: ₱20 per person; guide fee: ₱350 per guide per day.',
      'Strictly not for beginners. Bring a tent, dry bag, headlamp, rain jacket, power bank, trail food, first-aid kit, and 2–3 L of water.',
    ],
    safety: [
      'Knife-edge sections are present near the summit. Move carefully and follow your guide’s instructions.',
      'Leeches (limatiks), muddy sections, loose rocks, and steep vertical ascents may be encountered.',
      'Weather can change suddenly. Log in and out at Culasi Police Station, and agree on an emergency plan with your guide.',
    ],
    transportation: [
      'Travel from Kalibo Airport to Culasi by bus or van (about 2–3 hours), then take a habal-habal to Barangay Flores (about 10–15 km).',
      'Meet-up points may be Kalibo Airport or Culasi Municipal Hall.',
      'Organizer packages start at ₱5,500 and may include a jeep, permits, guide, meals, food porter, and certificate. Confirm package inclusions and current prices before booking.',
    ],
    trailTips: [
      'Day 1: Trek to Bantang Camp 1 (1,030 m). Day 2: Summit assault via Camp 2 (1,770 m) and Camp 3 (2,040 m).',
      'Landmarks include Libog Falls, the View Deck, Mossy Forest, and Knife Edge.',
      'Streams are available near the initial section and campsites; water is limited on Days 2–3. Confirm current sources with your guide and carry enough water.',
    ],
    etiquette: [
      'Pack out all waste, including food scraps, and leave plants and wildlife undisturbed.',
      'Mt. Madja-as is sacred in Visayan mythology and associated with Sidapa and Bulalakaw. Respect local beliefs and traditions.',
    ],
    alerts: [
      {
        type: 'warning',
        title: 'Major climb — not for beginners',
        message: 'Ensure you are physically prepared. The trail requires a permit, mandatory guide, and police-station registration. Verify current requirements and trail conditions before departure.',
      },
    ],
  },
  {
    id: '2cd5666c-1deb-4499-812e-eb95a992ef68',
    mountainName: 'Mt. Balinsasayaw',
    preparation: [
      'Easy hike suitable for all fitness levels. The summit trek takes about 1 hour; the full trekking activity is about 4 hours.',
      'Guides and on-site guide fees are included in tour packages. Entrance fees and pick-up/drop-off within Kalibo or Caticlan may also be included; confirm package details.',
      'Not suitable for children under 13. Bring hiking shoes, extra clothes, sunscreen, insect repellent, and a waterproof bag.',
    ],
    safety: [
      'Use caution on steep sections.',
      'Extreme weather may make some destinations inaccessible; tour operators may provide alternative sites.',
      'Check the weather and follow local guide instructions throughout the visit.',
    ],
    transportation: [
      'Pick-up and drop-off are available within Kalibo or Caticlan on participating tours.',
      'The tour lasts about 8–9 hours in total and includes transportation during the tour.',
      'Confirm the operator, itinerary, and included transport before booking.',
    ],
    trailTips: [
      'The summit trail is straightforward and takes about 1 hour to hike.',
      'Nearby points of interest include the Katunggan it Ibajay mangrove boardwalk and Nawidwid Falls (about 50 m high; around a 1.5-hour trek).',
      'The area covers 8,016.05 hectares and has elevations of about 830–846 m. Panoramic views and photo spots are popular.',
    ],
    etiquette: [
      'Follow Leave No Trace principles and do not litter.',
      'Katunggan it Ibajay protects the Philippines’ largest api-api (Avicennia rumphiana) mangrove tree.',
      'Respect the local communities that manage the park and follow posted conservation guidance.',
    ],
    alerts: [
      {
        type: 'info',
        title: 'Tour cancellation',
        message: 'The stated policy offers a full refund when canceled at least 24 hours before departure. Confirm the policy with your tour operator.',
      },
      {
        type: 'warning',
        title: 'Weather advisory',
        message: 'Extreme weather may cause destination closures or itinerary changes.',
      },
    ],
  },
  {
    id: 'd39ff04a-069b-4d90-b448-f66e6ae05772',
    mountainName: 'Mt. M',
    preparation: [
      'Data pending — coordinate with the Tangalan Municipal Tourism Office for verified trail difficulty, duration, fees, and guide requirements.',
    ],
    safety: [
      'Trail-specific safety information is not available. Coordinate with the Tangalan LGU before hiking and follow standard hiking precautions.',
    ],
    transportation: [
      'Kalibo to Tangalan is approximately 30 minutes by bus or van. Confirm current schedules, fares, and the Pudiot jump-off point with the Tangalan LGU.',
    ],
    trailTips: [
      'Data pending — coordinate with the Tangalan LGU for the route, landmarks, water sources, and current trail conditions.',
    ],
    etiquette: [
      'Follow Leave No Trace principles, carry out all trash, and respect the local community.',
    ],
    alerts: [
      {
        type: 'info',
        title: 'Data pending — coordinate with LGU',
        message: 'Contact the Tangalan Municipal Tourism Office for current trail information and advisories. The Aklan Provincial Tourism Office can be reached at (036) 272-7000 local 6500.',
      },
    ],
  },
  {
    id: 'aeffeadd-0cb8-418f-b356-5c6dab35b219',
    mountainName: 'Mt. Opaw (Buruanga)',
    preparation: [
      'Data pending — coordinate with the Buruanga Municipal Tourism Office for verified trail difficulty, duration, fees, and guide requirements.',
    ],
    safety: [
      'Trail-specific safety information is not available. Coordinate with the Buruanga LGU before hiking and follow standard hiking precautions.',
    ],
    transportation: [
      'Kalibo to Buruanga is approximately 1.5–2 hours by bus or van. Confirm current schedules, fares, and the jump-off point with the Buruanga LGU.',
    ],
    trailTips: [
      'Data pending — coordinate with the Buruanga LGU for the route, landmarks, water sources, and current trail conditions.',
    ],
    etiquette: [
      'Follow Leave No Trace principles, carry out all trash, and respect the local community.',
    ],
    alerts: [
      {
        type: 'info',
        title: 'Data pending — coordinate with LGU',
        message: 'Contact the Buruanga Municipal Tourism Office for current trail information and advisories. The Aklan Provincial Tourism Office can be reached at (036) 272-7000 local 6500.',
      },
    ],
  },
  {
    id: 'f2173971-80bf-40dd-96e9-c6b015be194b',
    mountainName: 'Pandan Hills',
    preparation: [
      'Easy hike; no guide is required. The straightforward trail takes a few minutes to reach the hills.',
      'Bring comfortable clothing, water, and sun protection.',
    ],
    safety: [
      'Rain is expected during the monsoon season (June–February). The trail may be slippery in rainy conditions.',
      'Check the weather before setting out and use caution on wet ground.',
    ],
    transportation: [
      'From Kalibo town proper, take a tricycle to the jeepney terminal for Altavas. Ride to the junction for Barangay Bay-ang (about 1 hour), then charter a motorcycle to the jump-off.',
      'From Caticlan, take a van to Kalibo (about 1.5 hours), then a jeepney to Barangay Bay-ang.',
      'A listed Kalibo tricycle contact is Kuya Rex: 09388216786. Confirm availability and the fare before travel.',
    ],
    trailTips: [
      'The straightforward trek takes a few minutes to reach the hills.',
      'The hills overlook the Sibuyan Sea. Dry season (November–April) is recommended.',
    ],
    etiquette: [
      'Observe Leave No Trace principles and respect the local community.',
    ],
    alerts: [
      {
        type: 'warning',
        title: 'Weather advisory',
        message: 'Expect rain during the monsoon season (June–February); check conditions before visiting.',
      },
    ],
  },
];