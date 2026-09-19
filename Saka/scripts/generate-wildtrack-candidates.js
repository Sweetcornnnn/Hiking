#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const radius = Number(process.env.WILDTRACK_CANDIDATE_RADIUS_KM || 5);
const outputPath = path.resolve(__dirname, `../wildtrack-candidates-${radius}km.json`);
const limit = 50;
const excludedScientificNames = new Set([
  'felis catus',
  'columba livia domestica',
]);
const coastalTerms = ['plover', 'heron', 'mangrove', 'linckia', 'eel', 'kingfisher'];
const cultivatedTerms = ['guava', 'papaya', 'lantana', 'tridax', 'nightshade', 'caesar weed'];

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const fetchJson = async (url) => {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${url}`);
  return response.json();
};

const normalizeName = (name) => String(name || '').trim().toLowerCase();

const getReviewFlags = (candidate) => {
  const text = `${candidate.scientific_name} ${candidate.common_name || ''}`.toLowerCase();
  const flags = [];
  if (coastalTerms.some((term) => text.includes(term))) flags.push('possible coastal or lowland habitat');
  if (cultivatedTerms.some((term) => text.includes(term))) flags.push('possible cultivated or disturbed habitat');
  if ((candidate.distance_km ?? Infinity) > 3) flags.push('farther from coordinate');
  if (candidate.sources?.length === 1) flags.push('single source');
  return flags;
};

const getConfidenceScore = (candidate) => {
  let score = 0;
  score += (candidate.sources?.length || 0) * 3;
  score += Math.min(candidate.observation_count || 0, 3);
  if (candidate.distance_km != null && candidate.distance_km <= 2) score += 2;
  if (candidate.review_flags?.length) score -= candidate.review_flags.length;
  return Math.max(score, 0);
};

const distanceKm = (latitudeA, longitudeA, latitudeB, longitudeB) => {
  if ([latitudeA, longitudeA, latitudeB, longitudeB].some((value) => value == null)) return null;
  const radians = (value) => (value * Math.PI) / 180;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  return Number((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
};

const addCandidate = (map, candidate) => {
  const scientificName = candidate.scientific_name?.trim();
  if (!scientificName) return;

  const key = normalizeName(scientificName);
  if (excludedScientificNames.has(key)) return;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, candidate);
    return;
  }

  map.set(key, {
    ...existing,
    common_name: existing.common_name || candidate.common_name,
    gbif_id: existing.gbif_id || candidate.gbif_id,
    inaturalist_id: existing.inaturalist_id || candidate.inaturalist_id,
    image_url: existing.image_url || candidate.image_url,
    sources: Array.from(new Set([...(existing.sources || []), ...(candidate.sources || [])])),
    observation_count: (existing.observation_count || 0) + (candidate.observation_count || 0),
    distance_km: Math.min(existing.distance_km ?? Infinity, candidate.distance_km ?? Infinity),
  });
};

const getGbifCandidates = async (mountain) => {
  const url = new URL('https://api.gbif.org/v1/occurrence/search');
  url.searchParams.set('decimalLatitude', mountain.latitude);
  url.searchParams.set('decimalLongitude', mountain.longitude);
  url.searchParams.set('radius', radius);
  url.searchParams.set('limit', limit);
  url.searchParams.set('hasCoordinate', 'true');
  url.searchParams.set('country', 'PH');
  url.searchParams.set('taxonRank', 'SPECIES');

  const data = await fetchJson(url);
  return (data.results || [])
    .filter((record) => record.species)
    .map((record) => ({
      scientific_name: record.species,
      common_name: record.vernacularName,
      gbif_id: record.taxonKey,
      category: record.kingdom === 'Animalia' ? 'Fauna' : 'Flora',
      sources: ['GBIF'],
      observation_count: 1,
      distance_km: distanceKm(mountain.latitude, mountain.longitude, record.decimalLatitude, record.decimalLongitude),
    }));
};

const getINaturalistCandidates = async (mountain) => {
  const url = new URL('https://api.inaturalist.org/v1/observations');
  url.searchParams.set('lat', mountain.latitude);
  url.searchParams.set('lng', mountain.longitude);
  url.searchParams.set('radius', radius);
  url.searchParams.set('per_page', limit);
  url.searchParams.set('quality_grade', 'research');
  url.searchParams.set('taxon_rank', 'species');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('order_by', 'observed_on');

  const data = await fetchJson(url);
  return (data.results || [])
    .filter((observation) => observation.taxon?.name)
    .map((observation) => ({
      scientific_name: observation.taxon.name,
      common_name: observation.taxon.preferred_common_name,
      inaturalist_id: observation.taxon.id,
      image_url: observation.taxon.default_photo?.medium_url,
      category: observation.taxon.iconic_taxon_name || 'Unknown',
      sources: ['iNaturalist'],
      observation_count: 1,
      distance_km: distanceKm(
        mountain.latitude,
        mountain.longitude,
        observation.geojson?.coordinates?.[1],
        observation.geojson?.coordinates?.[0],
      ),
    }));
};

const generate = async () => {
  const { data: mountains, error } = await supabase
    .from('mountains')
    .select('id, name, latitude, longitude')
    .order('name');

  if (error) throw new Error(`Failed to load mountains: ${error.message}`);

  const result = {};
  for (const mountain of mountains || []) {
    if (mountain.latitude == null || mountain.longitude == null) {
      result[mountain.id] = { mountain, candidates: [], error: 'Missing coordinates' };
      continue;
    }

    try {
      const [gbifCandidates, inatCandidates] = await Promise.all([
        getGbifCandidates(mountain),
        getINaturalistCandidates(mountain),
      ]);
      const candidates = new Map();
      gbifCandidates.forEach((candidate) => addCandidate(candidates, candidate));
      inatCandidates.forEach((candidate) => addCandidate(candidates, candidate));
      result[mountain.id] = {
        mountain,
        candidates: Array.from(candidates.values())
          .map((candidate) => ({
            ...candidate,
            source_count: candidate.sources?.length || 0,
            review_flags: getReviewFlags(candidate),
            confidence_score: getConfidenceScore({ ...candidate, review_flags: getReviewFlags(candidate) }),
            review_status: candidate.sources?.length > 1
              ? 'stronger: both sources'
              : 'review: single source',
          }))
          .sort((a, b) => (
            (b.confidence_score - a.confidence_score)
            || (b.source_count - a.source_count)
            || ((b.observation_count || 0) - (a.observation_count || 0))
            || ((a.distance_km ?? Infinity) - (b.distance_km ?? Infinity))
          )),
      };
      console.log(`${mountain.name}: ${candidates.size} candidates`);
    } catch (error) {
      result[mountain.id] = { mountain, candidates: [], error: error.message };
      console.error(`${mountain.name}: ${error.message}`);
    }
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`Wrote review file: ${outputPath}`);
};

generate().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
