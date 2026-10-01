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
      'Major climb; listed difficulty is 8/9. Confirm the current route, duration, and fitness requirements with local authorities.',
      'Verify guide requirements, permits, and all fees with the authorized local office before departure.',
      'Prepare suitable hiking gear, food, and enough water for the confirmed itinerary.',
    ],
    safety: [
      'Ask local guides about current trail conditions and hazards before starting this major climb.',
      'Agree on an emergency contact and turnaround plan with your group and guide.',
      'For an injury or severe weather, stop in a safe location and contact your guide or local responders.',
    ],
    transportation: [
      'Confirm your chosen access point with the local tourism office; the mountain spans Culasi, Antique and Madalag, Aklan.',
      'Check current bus or van schedules and fares to your confirmed jump-off point.',
      'Arrange any last-mile ride in advance and verify the habal-habal fare before boarding.',
    ],
    trailTips: [
      'Request an updated route briefing and estimated hiking time from your guide.',
      'Ask which landmarks and water sources are reliable for your planned route.',
      'Start at the locally recommended time and follow your guide through difficult sections.',
    ],
    etiquette: [
      'Pack out all waste, including food scraps, and leave plants and wildlife undisturbed.',
      'Follow community guidance and ask permission before photographing residents or private property.',
      'Use only designated campsites and follow the guide’s conservation instructions.',
    ],
    alerts: [],
  },
  {
    id: '2cd5666c-1deb-4499-812e-eb95a992ef68',
    mountainName: 'Mt. Balinsayaw',
    preparation: [
      'This is described as an easy, beginner-friendly hike; confirm the current route and expected duration in Ibajay.',
      'Ask the local tourism office whether registration, a guide, permits, or fees are required.',
      'Bring comfortable footwear, sun and rain protection, water, and a charged phone.',
    ],
    safety: [
      'Check the day’s weather and ask locals whether any sections are slippery after rain.',
      'Keep your group together and let someone know your expected return time.',
      'If anyone feels unwell, pause in a safe place and contact your group lead or local help.',
    ],
    transportation: [
      'Confirm the current jump-off point and public transport options with your Ibajay host or tourism office.',
      'Verify bus or van operating times and fares before traveling.',
      'If a habal-habal is needed for the final stretch, agree on the fare and return pickup first.',
    ],
    trailTips: [
      'Ask for the latest trail map or a local route briefing before setting out.',
      'Check where water is available and carry enough for the full hike.',
      'Choose a start time that allows a relaxed return before dark.',
    ],
    etiquette: [
      'Take all rubbish back with you and avoid disturbing the beginner-friendly trail.',
      'Respect farms, homes, and community spaces near the route.',
      'Follow local instructions for staying on the established path.',
    ],
    alerts: [],
  },
  {
    id: 'd39ff04a-069b-4d90-b448-f66e6ae05772',
    mountainName: 'Mt. M',
    preparation: [
      'The hike is described as moderate; verify the route, duration, and current access rules with the Tangalan LGU.',
      'Confirm whether local registration, a guide, permits, or fees apply before traveling to Pudiot.',
      'Pack for a moderate hike and adjust your water and food to the confirmed itinerary.',
    ],
    safety: [
      'Request a current safety briefing from the LGU or local guide, especially after heavy rain.',
      'Share your route and return estimate with someone who is not hiking with you.',
      'In an emergency, stay with your group when safe and follow local responder instructions.',
    ],
    transportation: [
      'Ask the Tangalan LGU to confirm the correct Pudiot access point before choosing a route.',
      'Check up-to-date transport schedules and fares for travel to Tangalan.',
      'Confirm local ride availability and the return fare before proceeding to the trailhead.',
    ],
    trailTips: [
      'Have a local guide identify the route and notable landmarks before you begin.',
      'Verify water sources on the trail instead of relying on older route descriptions.',
      'Follow the start-time recommendation provided by the Tangalan LGU or your guide.',
    ],
    etiquette: [
      'Stay on the route approved by the community and leave no waste behind.',
      'Ask residents before entering land or taking photographs near homes.',
      'Help protect the area by leaving natural and cultural features as you find them.',
    ],
    alerts: [],
  },
  {
    id: 'aeffeadd-0cb8-418f-b356-5c6dab35b219',
    mountainName: 'Mt. Nausang',
    preparation: [
      'Confirm the current route, difficulty, hiking duration, and access arrangements with the relevant LGU before travel.',
      'Verify guide requirements, registration, permits, and fees with local authorities before setting out.',
      'Bring suitable footwear, weather protection, food, and water for the itinerary confirmed locally.',
    ],
    safety: [
      'Ask local authorities or your guide about current trail hazards and weather before starting the hike.',
      'Share your route and expected return time, and agree on a group turnaround plan.',
      'If conditions become unsafe, stop and follow your guide’s instructions or return plan.',
    ],
    transportation: [
      'Confirm the correct jump-off point and road access with the local tourism office.',
      'Check current bus or van schedules and fares for your route before traveling.',
      'Arrange any last-mile ride ahead of time and confirm the fare and return pickup.',
    ],
    trailTips: [
      'Request a current route briefing and learn which trail markers or landmarks to follow.',
      'Do not rely on unverified water sources; carry enough for your confirmed itinerary.',
      'Follow the locally recommended start time and allow enough daylight for your return.',
    ],
    etiquette: [
      'Stay on the route approved by the community and carry all waste back with you.',
      'Respect local access rules, private land, and community practices.',
      'Avoid damaging vegetation or disturbing wildlife along the trail.',
    ],
    alerts: [],
  },
  {
    id: 'f2173971-80bf-40dd-96e9-c6b015be194b',
    mountainName: 'Pandan Hills',
    preparation: [
      'This is described as an easy hike with no guide required; check local access conditions before leaving Altavas.',
      'Confirm whether any registration, access rules, or fees have changed with the local tourism office.',
      'Bring water, sun protection, and footwear suitable for the day’s weather.',
    ],
    safety: [
      'Check the forecast and avoid exposed areas during thunderstorms or strong winds.',
      'Tell someone your planned route and expected return, even for an easy outing.',
      'Use caution on wet ground and turn back if trail conditions are uncertain.',
    ],
    transportation: [
      'Confirm the current access point and road conditions with a local contact in Altavas.',
      'Check transport schedules and fares for your trip to and from the area.',
      'If using a local ride, confirm pickup arrangements and the fare before starting the hike.',
    ],
    trailTips: [
      'Ask locally which paths are open and follow the established route across the hills.',
      'Carry your own water and do not assume there are refill points along the way.',
      'Choose a clear-weather time with enough daylight for a comfortable return.',
    ],
    etiquette: [
      'Keep the hills clean by taking all rubbish home with you.',
      'Respect nearby residents, farms, and any posted access boundaries.',
      'Leave the landscape undisturbed for the next visitors.',
    ],
    alerts: [],
  },
];