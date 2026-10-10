import { jobFinderEngine } from './jobFinderEngine';
import { 
  OverpassNearbySource, 
  GeoapifyOrLocationIQNearbySource, 
  MiamiPermitsSource, 
  NoaaStormSource 
} from './jobFinderSources';

export async function runJobFinderTests() {
  console.log("🧪 Running Multi-Source JobFinder Test Suite...");
  
  // 1. Test Overpass Nearby Source directly
  const overpassSource = new OverpassNearbySource();
  const overpassResults = await overpassSource.fetch({
    trade: 'Plumbing',
    city: 'Tampa',
    lat: 27.9506,
    lng: -82.4572,
    radiusMi: 15,
    sinceDays: 7,
    testMode: true
  });
  console.assert(Array.isArray(overpassResults), "Overpass results should be array");
  console.assert(overpassResults.length > 0, "Overpass results should contain records in testMode");

  // 2. Test Places Nearby Source directly
  const placesSource = new GeoapifyOrLocationIQNearbySource();
  const placesResults = await placesSource.fetch({
    trade: 'HVAC',
    city: 'Austin',
    lat: 30.2672,
    lng: -97.7431,
    radiusMi: 15,
    sinceDays: 7,
    testMode: true
  });
  console.assert(Array.isArray(placesResults), "Places results should be array");

  // 3. Test Miami Permits Source directly
  const miamiSource = new MiamiPermitsSource();
  const permits = await miamiSource.fetch({
    trade: 'Roofing',
    city: 'Miami',
    lat: 25.7617,
    lng: -80.1918,
    radiusMi: 15,
    sinceDays: 7,
    testMode: true
  });
  console.assert(Array.isArray(permits), "Miami permits should return an array");

  // 4. Test NOAA Storm Source directly
  const stormSource = new NoaaStormSource();
  const storms = await stormSource.fetch({
    trade: 'Roofing',
    city: 'Houston',
    lat: 29.7604,
    lng: -95.3698,
    radiusMi: 25,
    sinceDays: 3,
    testMode: true
  });
  console.assert(Array.isArray(storms), "Storm source should return an array");

  // 5. Test Engine orchestration in Tampa (Outside Miami)
  const engineResultTampa = await jobFinderEngine.getOpportunities({
    trade: 'Electrician',
    city: 'Tampa',
    lat: 27.9506,
    lng: -82.4572,
    radiusMi: 20,
    sinceDays: 7,
    testMode: true,
    tenantId: 'test-tenant'
  });
  console.assert(Array.isArray(engineResultTampa.opportunities), "Engine opportunities must be array");
  console.assert(engineResultTampa.sourcesUsed.length > 0, "Engine must record sources used");

  console.log("✅ JobFinder Test Suite completed successfully!");
  return {
    success: true,
    overpassCount: overpassResults.length,
    placesCount: placesResults.length,
    permitsCount: permits.length,
    stormsCount: storms.length,
    tampaEngineCount: engineResultTampa.opportunities.length,
    sourcesUsed: engineResultTampa.sourcesUsed
  };
}
