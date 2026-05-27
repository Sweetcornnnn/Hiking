import type { Species } from '../store/wildtrackStore';

export interface CuratedSpeciesData {
  species: Species;
  mountainIds: string[];
  isFeatured?: boolean;
}

export interface MountainBiodiversity {
  id: string;
  name: string;
  curated_species_count: number;
  description: string;
  endemic_species_count: number;
  key_species: string[];
  ecosystem: string;
  conservationStatus: string;
}

export const MOUNTAIN_BIODIVERSITY: MountainBiodiversity[] = [
  {
    id: '1',
    name: 'Mt. Madjaas',
    curated_species_count: 142,
    description: 'Mt. Madjaas is one of Panay\'s biodiversity hotspots and home to several endemic Visayan species including the Visayan Hornbill and Rafflesia. The mountain features diverse ecosystems from lowland dipterocarp forests to mossy forests at the summit.',
    endemic_species_count: 48,
    key_species: ['Rafflesia speciosa', 'Visayan Hornbill', 'Panay Monitor Lizard'],
    ecosystem: 'Dipterocarp and mossy forests',
    conservationStatus: 'Protected Landscape',
  },
  {
    id: '2',
    name: 'Mt. Guiting-Guiting',
    curated_species_count: 118,
    description: 'Mt. Guiting-Guiting in Romblon is known for its unique biodiversity with many species found nowhere else on Earth. The rugged terrain has created isolated ecosystems fostering endemic evolution.',
    endemic_species_count: 52,
    key_species: ['Guiting-Guiting Forest Frog', 'Romblon Hawk-Eagle', 'Negros Bleeding-heart'],
    ecosystem: 'Lowland and montane forests',
    conservationStatus: 'Protected Area',
  },
  {
    id: '3',
    name: 'Mt. Pulag',
    curated_species_count: 156,
    description: 'Mt. Pulag, the third highest peak in the Philippines, hosts diverse flora and fauna across its elevational gradient. Famous for its sea of clouds and unique montane forest ecosystem.',
    endemic_species_count: 38,
    key_species: ['Benguet Pine', 'Philippine Deer', 'Cloud Rat'],
    ecosystem: 'Montane and mossy forests',
    conservationStatus: 'National Park',
  },
  {
    id: '4',
    name: 'Mt. Apo',
    curated_species_count: 189,
    description: 'Mt. Apo, the highest mountain in the Philippines, boasts exceptional biodiversity with numerous endemic species. Its diverse habitats range from tropical rainforests to alpine meadows.',
    endemic_species_count: 67,
    key_species: ['Philippine Eagle', 'Warty Pig', 'Nepenthes attenboroughii'],
    ecosystem: 'Diverse forest types and volcanic formations',
    conservationStatus: 'Protected Area and Natural Park',
  },
  {
    id: '5',
    name: 'Mayon Volcano',
    curated_species_count: 134,
    description: 'Mayon Volcano\'s slopes support rich biodiversity despite volcanic activity. The surrounding areas feature unique adaptations of flora and fauna to volcanic soils.',
    endemic_species_count: 29,
    key_species: ['Albay Forest Frog', 'Mayon Montane Forest Mouse', 'Philippine Tarsier'],
    ecosystem: 'Volcanic tropical forests',
    conservationStatus: 'Natural Park',
  },
  {
    id: '6',
    name: 'Mt. Kanlaon',
    curated_species_count: 127,
    description: 'Mt. Kanlaon in Negros Island is a biodiversity treasure with significant endemic species. The active volcano\'s forests provide critical habitat for threatened wildlife.',
    endemic_species_count: 44,
    key_species: ['Negros Fruit Dove', 'Visayan Warty Pig', 'Flame-templed Babbler'],
    ecosystem: 'Dipterocarp and montane forests',
    conservationStatus: 'National Park',
  },
];

export const CURATED_SPECIES: CuratedSpeciesData[] = [
  {
    species: {
      id: 1,
      scientific_name: 'Rafflesia speciosa',
      common_name: 'Rafflesia',
      category: 'Plants',
      conservation_status: 'Endangered',
      description: 'A parasitic plant known for producing the largest individual flower on Earth. Found in the forests of Panay including Mt. Madjaas.',
      habitat: 'Tropical rainforests',
      fun_facts: 'The flower emits a smell like rotting meat to attract flies for pollination.',
      is_endemic: true,
      gbif_id: 5361926,
      inaturalist_id: 120861,
    },
    mountainIds: ['1'],
    isFeatured: true,
  },
  {
    species: {
      id: 2,
      scientific_name: 'Penelopides panini',
      common_name: 'Visayan Hornbill',
      category: 'Birds',
      conservation_status: 'Critically Endangered',
      description: 'A large hornbill species endemic to the Visayas islands. Plays a crucial role in seed dispersal in the forest ecosystem.',
      habitat: 'Primary and secondary forests',
      fun_facts: 'Known locally as "Talusi", it is one of the most endangered hornbill species.',
      is_endemic: true,
      gbif_id: 2495404,
      inaturalist_id: 5503,
    },
    mountainIds: ['1'],
    isFeatured: true,
  },
  {
    species: {
      id: 3,
      scientific_name: 'Varanus mabitang',
      common_name: 'Panay Monitor Lizard',
      category: 'Reptiles',
      conservation_status: 'Endangered',
      description: 'A large arboreal monitor lizard endemic to Panay Island. One of the rarest monitor lizards in the world.',
      habitat: 'Dipterocarp forests',
      fun_facts: 'It is a frugivorous lizard, primarily eating fruits unlike most monitor lizards.',
      is_endemic: true,
      gbif_id: 2447288,
      inaturalist_id: 39436,
    },
    mountainIds: ['1'],
    isFeatured: true,
  },
  {
    species: {
      id: 4,
      scientific_name: 'Platymantis guentheri',
      common_name: 'Guiting-Guiting Forest Frog',
      category: 'Amphibians',
      conservation_status: 'Vulnerable',
      description: 'A endemic frog species found only on Mt. Guiting-Guiting. Adapted to the mossy forest habitat.',
      habitat: 'Montane mossy forests',
      fun_facts: 'This frog has unique toe pads that allow it to climb on wet mossy surfaces.',
      is_endemic: true,
      gbif_id: 2429088,
      inaturalist_id: 25957,
    },
    mountainIds: ['2'],
    isFeatured: true,
  },
  {
    species: {
      id: 5,
      scientific_name: 'Nisaetus pinskeri',
      common_name: 'Romblon Hawk-Eagle',
      category: 'Birds',
      conservation_status: 'Vulnerable',
      description: 'A majestic raptor endemic to the Romblon island group. Named after Austrian ornithologist Wilhelm Pinsker.',
      habitat: 'Lowland and montane forests',
      fun_facts: 'It was only recognized as a distinct species in 2005.',
      is_endemic: true,
      gbif_id: 2495398,
      inaturalist_id: 144470,
    },
    mountainIds: ['2'],
    isFeatured: true,
  },
  {
    species: {
      id: 6,
      scientific_name: 'Gallicolumba keayi',
      common_name: 'Negros Bleeding-heart',
      category: 'Birds',
      conservation_status: 'Critically Endangered',
      description: 'A rare ground-dwelling pigeon with a distinctive red patch on its breast. Critically endangered due to habitat loss.',
      habitat: 'Lowland forests',
      fun_facts: 'The red patch on its chest resembles a bleeding wound, hence its name.',
      is_endemic: true,
      gbif_id: 2495158,
      inaturalist_id: 3134,
    },
    mountainIds: ['2'],
    isFeatured: true,
  },
  {
    species: {
      id: 7,
      scientific_name: 'Pinus kesiya',
      common_name: 'Benguet Pine',
      category: 'Plants',
      conservation_status: 'Least Concern',
      description: 'The dominant pine species in the Luzon tropical pine forests. Forms extensive pine forests on Mt. Pulag.',
      habitat: 'Montane pine forests',
      fun_facts: 'Also known as "Khasi pine", it is one of the few pine species native to Southeast Asia.',
      is_endemic: false,
      gbif_id: 2685488,
      inaturalist_id: 135814,
    },
    mountainIds: ['3'],
    isFeatured: true,
  },
  {
    species: {
      id: 8,
      scientific_name: 'Cervus mariannus',
      common_name: 'Philippine Deer',
      category: 'Mammals',
      conservation_status: 'Vulnerable',
      description: 'The largest endemic deer species in the Philippines. Found in forested areas across Luzon including Mt. Pulag.',
      habitat: 'Primary and secondary forests',
      fun_facts: 'Also known as "Sambar deer", it is an important prey species for the Philippine Eagle.',
      is_endemic: true,
      gbif_id: 2440992,
      inaturalist_id: 75051,
    },
    mountainIds: ['3'],
    isFeatured: true,
  },
  {
    species: {
      id: 9,
      scientific_name: 'Phloeomys pallidus',
      common_name: 'Luzon Forest Rat',
      category: 'Mammals',
      conservation_status: 'Near Threatened',
      description: 'A large arboreal rodent endemic to Luzon. Known locally as "Cloud Rat" due to its habitat in mossy forests.',
      habitat: 'Montane and mossy forests',
      fun_facts: 'These gentle rodents are important seed dispersers in the forest ecosystem.',
      is_endemic: true,
      gbif_id: 2441152,
      inaturalist_id: 45163,
    },
    mountainIds: ['3'],
    isFeatured: true,
  },
  {
    species: {
      id: 10,
      scientific_name: 'Pithecophaga jefferyi',
      common_name: 'Philippine Eagle',
      category: 'Birds',
      conservation_status: 'Critically Endangered',
      description: 'One of the rarest and largest eagles in the world. The national bird of the Philippines and apex predator of the forest.',
      habitat: 'Dipterocarp forests',
      fun_facts: 'It takes 5-7 years for a Philippine Eagle to reach breeding age.',
      is_endemic: true,
      gbif_id: 2495392,
      inaturalist_id: 5413,
    },
    mountainIds: ['4'],
    isFeatured: true,
  },
  {
    species: {
      id: 11,
      scientific_name: 'Sus philippensis',
      common_name: 'Philippine Warty Pig',
      category: 'Mammals',
      conservation_status: 'Vulnerable',
      description: 'A wild pig species endemic to the Philippines. Important ecosystem engineer in forest habitats.',
      habitat: 'Forest and grassland areas',
      fun_facts: 'Males have prominent facial warts that grow larger with age.',
      is_endemic: true,
      gbif_id: 2440998,
      inaturalist_id: 42133,
    },
    mountainIds: ['4'],
    isFeatured: true,
  },
  {
    species: {
      id: 12,
      scientific_name: 'Nepenthes attenboroughii',
      common_name: 'Attenborough\'s Pitcher Plant',
      category: 'Plants',
      conservation_status: 'Critically Endangered',
      description: 'A giant pitcher plant discovered on Mt. Apo in 2007. Named after Sir David Attenborough.',
      habitat: 'Montane mossy forests',
      fun_facts: 'This pitcher plant can trap and digest small rodents and birds.',
      is_endemic: true,
      gbif_id: 5361928,
      inaturalist_id: 52970,
    },
    mountainIds: ['4'],
    isFeatured: true,
  },
  {
    species: {
      id: 13,
      scientific_name: 'Platymantis luzonensis',
      common_name: 'Albay Forest Frog',
      category: 'Amphibians',
      conservation_status: 'Near Threatened',
      description: 'An endemic frog species found in the forests around Mayon Volcano. Adapted to volcanic soil conditions.',
      habitat: 'Montane forests',
      fun_facts: 'This frog has developed resistance to the acidic conditions of volcanic environments.',
      is_endemic: true,
      gbif_id: 2429092,
      inaturalist_id: 25974,
    },
    mountainIds: ['5'],
    isFeatured: true,
  },
  {
    species: {
      id: 14,
      scientific_name: 'Apomys gracilirostris',
      common_name: 'Mayon Montane Forest Mouse',
      category: 'Mammals',
      conservation_status: 'Vulnerable',
      description: 'A small rodent endemic to the forests of Mayon Volcano. One of the many endemic mammals of the Bicol region.',
      habitat: 'Montane forests',
      fun_facts: 'This mouse species has a longer snout than most forest mice, adapted for its diet.',
      is_endemic: true,
      gbif_id: 2441184,
      inaturalist_id: 74074,
    },
    mountainIds: ['5'],
    isFeatured: true,
  },
  {
    species: {
      id: 15,
      scientific_name: 'Tarsius syrichta',
      common_name: 'Philippine Tarsier',
      category: 'Mammals',
      conservation_status: 'Near Threatened',
      description: 'One of the smallest primates in the world. Found in the forests of southern Luzon including areas near Mayon.',
      habitat: 'Tropical rainforests',
      fun_facts: 'Their eyes are larger than their brain and stomach combined.',
      is_endemic: true,
      gbif_id: 2441212,
      inaturalist_id: 1369286,
    },
    mountainIds: ['5'],
    isFeatured: true,
  },
  {
    species: {
      id: 16,
      scientific_name: 'Ptilinopus arcanus',
      common_name: 'Negros Fruit Dove',
      category: 'Birds',
      conservation_status: 'Critically Endangered',
      description: 'An extremely rare fruit dove endemic to Negros Island. Possibly the rarest bird in the Philippines.',
      habitat: 'Montane forests',
      fun_facts: 'This species was only rediscovered in 1993 after being thought extinct for decades.',
      is_endemic: true,
      gbif_id: 2495184,
      inaturalist_id: 2844,
    },
    mountainIds: ['6'],
    isFeatured: true,
  },
  {
    species: {
      id: 17,
      scientific_name: 'Sus cebifrons',
      common_name: 'Visayan Warty Pig',
      category: 'Mammals',
      conservation_status: 'Critically Endangered',
      description: 'A critically endangered pig species endemic to the Visayas. Found in the forests of Negros including Mt. Kanlaon.',
      habitat: 'Forest and grassland areas',
      fun_facts: 'Males grow a distinctive tuft of hair during mating season.',
      is_endemic: true,
      gbif_id: 2441000,
      inaturalist_id: 42129,
    },
    mountainIds: ['6'],
    isFeatured: true,
  },
  {
    species: {
      id: 18,
      scientific_name: 'Stachyris speciosa',
      common_name: 'Flame-templed Babbler',
      category: 'Birds',
      conservation_status: 'Endangered',
      description: 'A colorful babbler endemic to Negros and Panay. Named for its distinctive flame-colored crown patch.',
      habitat: 'Lowland and montane forests',
      fun_facts: 'This bird is highly territorial and pairs stay together for life.',
      is_endemic: true,
      gbif_id: 2493092,
      inaturalist_id: 15532,
    },
    mountainIds: ['6'],
    isFeatured: true,
  },
  {
    species: {
      id: 19,
      scientific_name: 'Dicaeum quadricolor',
      common_name: 'Bicolored Flowerpecker',
      category: 'Birds',
      conservation_status: 'Near Threatened',
      description: 'A small colorful bird endemic to the Philippines. Important for seed dispersal of mistletoe plants.',
      habitat: 'Forest canopies',
      fun_facts: 'They play a crucial role in seed dispersal for mistletoe plants.',
      is_endemic: true,
      gbif_id: 2495248,
      inaturalist_id: 13402,
    },
    mountainIds: ['1', '2', '3', '4', '5', '6'],
  },
  {
    species: {
      id: 20,
      scientific_name: 'Ptilinopus merrilli',
      common_name: 'Merrill\'s Fruit Dove',
      category: 'Birds',
      conservation_status: 'Near Threatened',
      description: 'A colorful fruit dove endemic to the Philippines. Found in Luzon and some Visayan islands.',
      habitat: 'Primary and secondary forests',
      fun_facts: 'They feed almost exclusively on fruits.',
      is_endemic: true,
      gbif_id: 2495180,
      inaturalist_id: 1650502,
    },
    mountainIds: ['1', '3', '4'],
  },
  {
    species: {
      id: 21,
      scientific_name: 'Naja philippinensis',
      common_name: 'Philippine Cobra',
      category: 'Reptiles',
      conservation_status: 'Near Threatened',
      description: 'A highly venomous spitting cobra endemic to the Philippines. Found in forest edges and agricultural areas.',
      habitat: 'Forest edges, agricultural areas',
      fun_facts: 'It can spit venom up to 3 meters with accuracy.',
      is_endemic: true,
      gbif_id: 2447280,
      inaturalist_id: 73875,
    },
    mountainIds: ['1', '2', '3', '4', '5', '6'],
  },
  {
    species: {
      id: 22,
      scientific_name: 'Heteropoda davidbowie',
      common_name: 'Bowie Spider',
      category: 'Insects',
      conservation_status: 'Data Deficient',
      description: 'A large huntsman spider named after David Bowie due to its bright orange coloring.',
      habitat: 'Tropical forests',
      fun_facts: 'Named after David Bowie due to its bright orange coloring.',
      is_endemic: true,
      gbif_id: 2447320,
      inaturalist_id: 542254,
    },
    mountainIds: ['1', '2', '3', '4'],
  },
];

export const getSpeciesByMountain = (mountainId: string): Species[] => {
  return CURATED_SPECIES
    .filter(item => item.mountainIds.includes(mountainId))
    .map(item => ({
      ...item.species,
      is_endemic: item.species.is_endemic,
    }));
};

export const getFeaturedSpeciesByMountain = (mountainId: string): Species[] => {
  return CURATED_SPECIES
    .filter(item => item.mountainIds.includes(mountainId) && item.isFeatured)
    .map(item => item.species);
};

export const searchCuratedSpecies = (query: string): Species[] => {
  const lowerQuery = query.toLowerCase();
  return CURATED_SPECIES
    .filter(item => {
      const species = item.species;
      return (
        species.scientific_name.toLowerCase().includes(lowerQuery) ||
        species.common_name.toLowerCase().includes(lowerQuery) ||
        species.category.toLowerCase().includes(lowerQuery) ||
        (species.description && species.description.toLowerCase().includes(lowerQuery))
      );
    })
    .map(item => item.species);
};

export const getSpeciesById = (id: number): Species | null => {
  const found = CURATED_SPECIES.find(item => item.species.id === id);
  return found ? found.species : null;
};

export const getMountainBiodiversity = (mountainId: string): MountainBiodiversity | null => {
  return MOUNTAIN_BIODIVERSITY.find(m => m.id === mountainId) || null;
};
