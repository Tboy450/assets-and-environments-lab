// Mission-view Vehicle Layers panel: layer switch, thermal legend, parts list and selection.
import { systemsModel, thermalZoneTemps } from "../mission-systems.mjs?v=dev";
import { thermalCss, thermalGradientCss, thermalRanges } from "../thermal-scale.mjs?v=dev";
import { $, flightCanvas, state } from "./context.mjs?v=dev";
import { partMarkers } from "./flight-view.mjs?v=dev";
import { samplingSequence } from "../science.mjs?v=dev";
import { updateInspectorUI } from "./vehicle-inspector.mjs?v=dev";
import { focusInspector } from "../vehicle-inspector.mjs?v=dev";

const sources = {
  mimu: ["Honeywell space MIMU: hardware image and family limits", "https://www.honeywellaerospace.com/us/en/products-and-services/products/navigation-and-sensors/inertial-measurement-units/miniature-inertial-measurement-unit"],
  mimuStudy: ["NASA/APL Uranus study appendix C, pages 184-185: MIMU / Dragonfly reference", "https://science.nasa.gov/wp-content/uploads/2023/10/uranus-orbiter-and-probe-appendix-c.pdf"],
  ocellusDesign: ["NASA Ocellus design dimensions (MSS 2023, page 6; CAD)", "https://ntrs.nasa.gov/citations/20230004117"],
  ocellus: ["NASA Ocellus lidar overview and MEB/FEB definitions", "https://technology.nasa.gov/patent/GSC-TOPS-353"],
  ocellusPackaging: ["NASA Optics 2023 page 13: identified Ocellus packaging CAD, not a photo", "https://ntrs.nasa.gov/citations/20230014147"],
  sqrliReview: ["NASA SQRLi 2024 review: related real hardware and shared development", "https://ntrs.nasa.gov/citations/20240010518"],
  ocellusReuse: ["NASA HTRL / Ocellus: SpaceCube Mini family reuse, exact generation unconfirmed", "https://techport.nasa.gov/projects/116315"],
  navigation: ["APL navigation-filter design: redundant IMUs (2023)", "https://arxiv.org/abs/2307.13513"],
  efield: ["IPM 2025: DraGMet design pp. 184-185; EFIELD hardware pp. 186-187", "https://zenodo.org/records/17056361"],
  dragmet: ["APL DraGMet instrument overview", "https://www.jhuapl.edu/destinations/instruments/dragmet"],
  dragmetCad: ["APL sensor-suite diagram (CAPS 2024, slide 42; CAD, not hardware photo)", "https://www.nationalacademies.org/cdn/materials/9fba0b12-d11a-482c-a46a-0b8de31e5dbd"],
  structureFit: ["NASA/APL top-deck fit check", "https://science.nasa.gov/blogs/dragonfly/2026/04/23/nasas-dragonfly-rotorcraft-gets-decked-out-tested/"],
  structureHarness: ["NASA/APL flight-fuselage harness integration, September 2026", "https://science.nasa.gov/blogs/dragonfly/2026/09/02/nasas-dragonfly-gets-wired-up-while-titan-landing-area-is-named/"],
  structureTest: ["APL structure tests and inverted fixture", "https://www.jhuapl.edu/news/news-releases/260709-dragonfly-clears-key-tests-as-assembly-comes-together"],
  thermal: ["Thermal layout (ICES 2023)", "https://ttu-ir.tdl.org/server/api/core/bitstreams/0737a596-5ba9-488b-9cc6-0b2ed93e2cd5/content"],
  thermal2020: ["Thermal design overview (ICES 2020)", "https://ttu-ir.tdl.org/server/api/core/bitstreams/40dace65-c244-4971-9245-67ae466f1e15/content"],
  integration: ["NASA integration update", "https://science.nasa.gov/blogs/dragonfly/2026/03/10/nasas-dragonfly-mission-begins-rotorcraft-integration-testing-stage/"],
  payload: ["APL payload reference", "https://dragonfly.jhuapl.edu/What-Is-Dragonfly/Spacecraft-and-Science-Payload.php"],
  spacecraft: ["NASA spacecraft and instruments", "https://science.nasa.gov/mission/dragonfly/spacecraft-and-instruments/"],
  sampling: ["NASA sample-transfer design", "https://science.nasa.gov/science-research/science-enabling-technology/technology-highlights/playing-lacrosse-on-titan/"],
  carousel: ["NASA carousel integration", "https://science.nasa.gov/blogs/dragonfly/2026/04/23/nasas-dragonfly-rotorcraft-gets-decked-out-tested/"],
  carouselPhotos: ["Carousel photos: NASA/Mike Guinto", "https://svs.gsfc.nasa.gov/15003"],
  carouselDesign: ["NASA carousel thermal-interface design (2024)", "https://ntrs.nasa.gov/api/citations/20230017316/downloads/AIAA_SCITECH2024_final_proof.pdf"],
  dragonCam: ["DragonCam Microscopic Camera paper (MSSS, 2026)", "https://arxiv.org/abs/2601.13221"],
  dracoPaper: ["DrACO drill design (Honeybee, APL, Goddard; LPSC 2022)", "https://www.hou.usra.edu/meetings/lpsc2022/pdf/1069.pdf"],
  psuPhoto: ["PSU testing photo: NASA/Johns Hopkins APL/Ed Whitman", "https://www.jhuapl.edu/news/news-releases/260312-dragonfly-integration-begins"],
  iemPhotos: ["IEM integration photos: NASA/Johns Hopkins APL", "https://www.jhuapl.edu/news/news-releases/260312-dragonfly-integration-begins"],
  frontierPhoto: ["Frontier radio photo: Johns Hopkins APL", "https://science.nasa.gov/image-detail/amf-48b4901b-44b0-4c89-802b-0c615842aa09/"],
  frontierSpecs: ["Frontier radio specifications (eoPortal)", "https://www.eoportal.org/satellite-missions/frontier-radio"],
  lroTwta: ["LRO TWTA photo and sizes (NASA/TM-2010-216262)", "https://ntrs.nasa.gov/api/citations/20100012836/downloads/20100012836.pdf"],
  mroTelecom: ["MRO 100 W X-band TWTA masses (JPL DESCANSO)", "https://descanso.jpl.nasa.gov/DPSummary/MRO_092106.pdf"],
  stellantTwt: ["Space TWT photos and weights (Stellant)", "https://stellantsystems.com/wp-content/uploads/2024/03/Stellant_TWTsSPACE_MARCH2024.pdf"],
  aplArm: ["HGA arm photo: NASA/Johns Hopkins APL/Ed Whitman", "https://www.jhuapl.edu/news/news-releases/260709-dragonfly-clears-key-tests-as-assembly-comes-together"],
  nasaHga: ["HGA test-chamber photo: NASA/Johns Hopkins APL/Ed Whitman", "https://science.nasa.gov/blogs/dragonfly/2026/06/01/nasas-dragonfly-flight-system-faces-heat/"],
  batteryModule: ["Battery thermal module and test photos (ICES 2022, APL)", "https://ttu-ir.tdl.org/items/a6b6bdc1-a09e-43a2-bc62-dbbea2e80660"],
  gsYuasaCells: ["GS Yuasa LSE space cell datasheet", "https://gsyuasa-lp.com/SpecSheets/GS_Yuasa_LSE_GEN_III_Power.pdf"],
  batteryArticle: ["11.5 kWh pack with GS Yuasa cells (Aerospace America, 2022)", "https://aerospaceamerica.aiaa.org/features/designing-dragonfly-nasas-titan-explorer/"],
};
const componentInfo = {
  "nose-electronics": ["Owner-approved outer-structure approximation, not a verified flight reconstruction. Ocellus MEB (main electronics box) and FEB (front-end box) retain NASA's 2023 design envelopes: 24.19 x 18.54 x 12.04 cm and 23.4 x 23.2 x 12.7 cm, not confirmed as-built dimensions. The MEB has an estimated machined frame, external stiffeners and removable lid; the FEB has a base, rear returns, receiver barrel and angled collimator housing with removable caps. Identified Ocellus CAD supports arrangement and scale; real related SQRLi/Kodiak hardware informs construction, not exact Ocellus appearance. Finishes, wall thickness, proportions, fasteners and installation remain estimates. Both Honeywell space MIMU FAMILY approximations are unchanged: ribbed housings, rounded covers, external connector shells and flanges. NASA/APL links MIMU to Dragonfly, not an exact flight variant; 233.7 mm diameter x 169.9 mm height is a supplier upper envelope. Shelf and installation are estimates. All four units clear rebuilt neighbors at source-envelope scale, with no completed equipment moved. Casings, covers, mounts and IMU interfaces hide independently. No hidden boards, detailed optical train, mirror, connector pins or flight harness are invented. Empty revealed space is unmodeled, not hollow flight hardware. SpaceCube family reuse does not establish a board stack; the related board photo contains an evaluation-only amplifier, not proof of flight qualification. Original number 05 and five focuses retained. Initial asset pass complete as a labeled approximation; flight identification and exact internal interfaces remain open. No physics or power/thermal constants changed.", "ocellusDesign"],
  "nose-bulkhead": ["Provisional structural-panel illustration, not a photo-matched nose bulkhead. NASA/APL's 2026 flight-structure photos inform the silver finish, perimeter joints, fasteners and local yellow identification tape. The April report describes honeycomb primary-structure panels designed at APL and manufactured by Lockheed Martin. ICES-2023 figure 3 provides the older thermal-model layout, not a dimensioned drawing. The complete nose face is not resolved by these photos. The 0.70 x 0.40 m envelope, 20 mm depth, 3 mm face, corners, flange profile, fastener counts and mounting feet are estimates. Covers hides the modeled face for inspection; this is not an asserted flight access hatch. The empty area behind it is unmodeled, not a claim of a hollow panel. No honeycomb cell pitch, hidden layup, plumbing, apertures or circuits are invented. Original part 03 and its thermal zone are retained; this pass remains unchecked on the realism checklist.", "structureHarness", "structureFit", "thermal"],
  "nose-sensors": ["The two EFIELD probes follow real engineering-model photos in Seese et al. (IPM 2025): published 30 cm conductive carbon-fiber stalks and 5 cm gold-plated aluminum balls, one upper starboard front and one lower port rear near the MMRTG. Atmospheric TEMP/MICRO are co-mounted, not sensors 20 and 21. METHAN is an approved design estimate, NOT photo-matched flight hardware. Lorenz et al. describes a cold mirrored absorption cell with metal-felt dust filters, connected through the insulation by optical fibers to sources and photodiodes in the warm DPU. The in-band source is 1.67 micrometers, with a continuum reference. Its casing, two filter cassettes, removable cover, brackets, finish, size and short fiber entry are illustrative estimates based on the published arrangement; the CAPS diagram is CAD. Hidden mirrors, path length, individual fiber count and DPU electronics are not reconstructed. EFIELD preamp size, exact mounts and pointing also remain estimated. Casings, covers, mounts, interfaces and harnesses hide independently. Thermal uses shared exterior temperature; no separate optical, electric-field or probe-temperature solver is implied.", "efield"],
  "aft-bulkhead": ["The aft structure supports the generator interface. Its gold-colored face, pocketed rim and ribbed circular feature follow real NASA/APL structure photos. The July 2026 article identifies the vibration-table structure as inverted; the upright aft/up orientation also agrees with APL's 2024 CAD cross-reference. The 25-degree tilt is an estimate, not a published flight angle. Plate size, thickness, coating, pocket/fastener details and installed position are estimated. The fans sit forward of the panel; their short adapter collar stops at its forward face. The actual air passage and internal generator connections are not revealed by these photos and are not reconstructed. The photographed cylinder is test hardware, not the flight MMRTG. Isolating this part includes the generator and fans; Thermal uses existing shared zone estimates.", "structureFit"],
  rde: ["Two rotor-drive electronics boxes control the propulsion motors. ICES-2023 describes internal cooling fans; the CAPS 2024 presentation shows RDE thermal testing in Titan conditions. This is a provisional enclosure illustration, not a replica of photographed flight hardware: sizes, finish, fan count and positions, vents, connector blanks and installed placement are estimates. Separate lids, casings and mounts prepare future layer controls; no circuit boards or flight pinouts are invented. Thermal color uses the existing modeled RDE temperature; the pictured fans do not add a new cooling solver. Part 09 remains open pending a clear hardware reference.", "thermal"],
  iem: ["Dragonfly's \"brain\": core avionics for commands and data, guidance and navigation, and communications in one box. Drawn from NASA/APL's full-resolution March 2026 photos: a black heat-sink top with fins parallel to the face and rows of fasteners, a copper ground strap, a silver face plate bolted round its edge with two rows of black connector windows, Micro-D connectors each mated to a labeled, silver-wrapped cable, and yellow tape strips. Mounted with its back to a wall panel beside a power switching unit, as photographed. No size is published: about 28 x 28 x 22 cm, scaled from the standard Micro-D connectors in the photos. The exact window layout (mostly hidden by cables in the photos), depth and which wall it is on are estimates. Temperature is the shared bay-air model.", "iemPhotos"],
  "power-units": ["The two power switching units control the flow of power to Dragonfly's instruments and systems. The face is mapped connector by connector from NASA/APL's full-resolution testing photo: eight vertical slices crossed by two ribs, large 25-way D-subs stacked two-high on the left, a cluster of small connectors, three D-subs and an uncapped port along the lower right, and an empty upper right; black top band, top and side covers. The photo shows them capped in pink for testing; here they are mated to the harness. Two units is published; size is not, so it is scaled from the standard D-sub sizes (about 20 x 24 x 19 cm). PSU 1 sits beside the IEM on the same wall, as photographed; where PSU 2 sits is not shown, and it is drawn like PSU 1. The readings below are for the whole vehicle; separate PSU currents are not modeled.", "psuPhoto"],
  "nose-cameras-inside": ["The nose cameras, built by Malin Space Science Systems: the Forward MAC (12.6 mm lens), the Forward WAC and two Side Cameras (5.8 mm lenses), and two redundant NavCams that guide terrain-relative navigation and connect straight to the spacecraft. All use the same camera body; the Forward MAC's lens is drawn with the black hood seen on one camera in the 2026 DragonCam paper (which camera carries it is an inference), and the NavCams with their pale-yellow top plates. They bolt to a camera panel behind the nose cap and look out through windows; the nose has no active airflow. Positions are read from the paper's 2026 CAD figures; pointing angles and which low unit is the WAC or the NavCams are estimates. The 2026 CAD's chin is fuller than this model's nose, so the low cameras stand out of the older nose shell until it is redrawn.", "dragonCam"],
  "side-cameras": ["Malin Space Science Systems' DragonCam cameras on the lower body. The Microscopic Camera (105 x 155 x 90 mm, 1.04 kg) sits on the port side aft of the drill and images the drill site 986 mm away at 52 degrees to the surface, with a focus mechanism for depth; APL's LED array beside it lights the site at night, including 365 nm UV for fluorescence. A Down Camera on each side looks straight down. Each camera sits in a cavity in the foam behind a 3 mm window. Drawn from the 2026 DragonCam paper; the Down Cameras' exact position, brackets and harness stubs are estimates, and the foam is drawn without the local thickening the Microscopic Camera needs.", "dragonCam"],
  "frontier-radio": ["APL's Frontier software-defined radio receives commands and sends data over X-band; stored instrument data stay queued until the radio and antenna are ready. Drawn from APL's photo: a black stack of four slices with labeled connectors, bolted feet and semi-rigid coax on top. Each slice is Frontier's published 4 x 6 inch package; APL lists the radio at 2.1 kg; the stack width, slice split, connector details, routes and its place on the bay floor are estimates from the photo. Whether Dragonfly flies a second unit is not published. Temperature is the shared bay model.", "frontierPhoto"],
  twta: ["The 100-watt traveling-wave tube amplifier (TWTA) boosts the Frontier radio's X-band signal for the Earth downlink. It is bolted to the underside of the top deck, sheds heat into the deck and the bay air, and is on and warm in flight; in cruise a leg of the cruise fluid loop serves the top deck (ICES 2020 and 2023 thermal papers). No photo or size of Dragonfly's unit is published, so it is drawn like published flight TWTAs of its kind: a black conduction-cooled tube on a flanged silver baseplate and a separate power conditioner (EPC) joined by a braided high-voltage cable (NASA's photo of LRO's TWTA; Stellant's space-tube photos). Sizes are scaled from published units (LRO's tube is 37 x 9 x 9 cm and its EPC 20 x 7 x 11 cm; MRO's 100 W X-band tubes are about 1 kg each): a 33 cm tube and a 21 cm EPC. One unit is drawn, as NASA's page names one (a 2020 paper says TWTAs). Its place under the starboard deck above the radio, the waveguide forward under the deck to the antenna gimbal, the input coax and the power harness are estimates. Its temperature is an estimate linked to radio operation.", "spacecraft"],
  "hga-actuators": ["The high-gain antenna's gimbal raises the 87.4 cm dish on a motorized arm when Dragonfly is landed, points it at Earth, and lowers it into its locks before each flight. Published: the arm (APL's July 2026 photo shows a gold actuator drum, the arm, and a gray truss pedestal under the dish center with a flexible feed line); azimuth and elevation actuators under tan foam just forward of the stowed dish, a launch lock under the dish and a flight lock on either side of it (ICES 2023); the gimbal's internal portion under the deck, the part above it under a 5 cm foam dome, and a thermally isolated joint to the dish (ICES 2020). The actuators are tied to Titan and run cold. Estimated: sizes, the 0.6 m arm and hinge position (measured on the 2023 figure against the dish's diameter), lock shapes and colors, the pedestal height, and how far the dish may turn: here it stops before it would swing into the attic, so when Earth is behind the lander it cannot point straight at it. The waveguide from the radio amplifier enters a rotary joint under the deck. Temperature is the cold-actuator estimate.", "aplArm"],
  drills: ["DrACO's two redundant rotary-percussive drills (Honeybee Robotics), one beside each side of the body just aft of the forward leg. Drawn from the 2022 DrACO paper's design figure: a gold drill head with separate percussion (top) and rotation (front) actuators and the percussion spring, riding a Z-stage rail driven by a motor and lead screw; a swivel with the pneumatic port; and a hollow bit with a side opening and a slotted crown that keeps out particles over 1.5 mm. While drilling the whole head slides down the rail and only the bit turns; material comes from up to 6 cm deep and is suctioned through the bit. Part sizes, colors and the exact fore-aft position are estimates; one drill is used in the animation and the other stays stowed.", "sampling"],
  "sample-lines": ["DrACO's pneumatic transport, as in the 2022 DrACO paper's layout: a flexible hose from each drill's pneumatic port (it follows the drill head down), rigid tubes forward under the body edges and up into the cold attic, a flow-diverter manifold on the carousel's sample inlet, and a return line down the port side to the blowers. Either drill can feed either the LDMS or GCMS cups using either blower; the cups catch particles from the moving Titan air. Tube size (about 13 mm) and routes are estimates; APL's published visualizations were used only to cross-check the run along the body side.", "dracoPaper"],
  "sample-carousel": ["Photo-referenced casing and cooling fins surround the sample cups; the drives sit below. The housing stays fixed. The indexing ring is a diagram cue, not visible flight hardware. Drum diameter (0.36 m), fittings and placement are estimates, not flight CAD. Thermal uses cold-attic temperature above and bay temperature for the drives; no separate sensor or fin-gradient simulation.", "carouselPhotos"],
  wonderwall: ["Separates the cold carousel region from warm DraMS. The published roughly 5 cm instrument separation is not wall thickness. This contoured interface, apertures and facing/core construction are estimates, not a verified flight material stack. Thermal colors use shared warm/cold nodes, not a solved temperature gradient. The rebuilt DraMS interface is aligned to this aperture; exact flight connections remain unverified.", "carouselDesign"],
  drams: ["DraMS analyzes samples by laser desorption or gas chromatography/mass spectrometry. This warm-side reconstruction has enclosed instrument bodies, separate covers and an interface through the modeled Wonderwall opening. Dimensions, enclosure details, routes and fan geometry are estimates, not flight CAD. Hidden electrodes, GC columns, laser optics and the sample oven are not reconstructed. Temperature is the shared bay model, not measured hardware telemetry.", "carouselDesign"],
  "drill-blower": ["DrACO's two redundant centrifugal blowers (forward and aft), with impellers designed for Titan air, behind the port forward arm and exposed to Titan (ICES-2023). An inlet flow diverter picks which blower pulls the air; each exhausts outboard and down. Sizes and shapes are estimates.", "dracoPaper"],
  battery: ["The battery supplies flight power and recharges from the MMRTG. The thermal model includes a phase-change buffer and inhibits charging outside its permitted band. Published: an 11.5 kWh pack built by APL with GS Yuasa cells, 134 Ah, 24 cells; fans that push heat into the lander air in flight, heat pipes in three directions to keep the cells within 5 C of each other, aluminum fins between the cell stacks, and 7.5 kg of phase-change wax as a buffer for flights. Drawn: 24 upright cells of GS Yuasa's 134 Ah space cell (130 x 50 x 271 mm; the cell model is an inference, not published), four across and six deep, with fins, copper heat pipes and bus straps. The enclosure's look follows real photos of APL's 9-cell thermal test module: a cream ribbed lower section, a bare aluminum upper housing with 2 in fans on its ends, small 1 in fans on the lower walls and round connectors. That is a test article, so the flight pack's enclosure, cell arrangement, fan layout, connectors and its place just forward of the aft arms (from NASA/APL's 2023 plan view) are estimates; where the wax sits is not published, so it is not drawn. The lid is see-through here so the cells show.", "batteryModule"],
  fan: ["Two circulation fans (Fan-A and Fan-B) at the MMRTG end pull its waste-heat-warmed, nitrogen-rich gas into the duct: 0.052 kg/s by design, within a 15 W allocation; their speed also controls the MMRTG fin-root temperature. Drawn from NASA/APL's 2023 thermal talk (plan view and controller diagram); size scaled from the plan view, housings estimated. Their revised fore-aft placement and adapter collar fit the estimated canted aft panel; the real passage through that panel is not reconstructed. A flight-like fan was tested at 5,000-6,200 rpm in the 2024 full-scale test.", "thermal"],
  "underfloor-duct": ["The warm duct runs forward under the equipment floor on the centerline, about 14 cm wide (scaled from the 2023 plan view), and turns up into the body below the nose; the gas then returns aft through the bay to the MMRTG. Its height is an estimate.", "thermal"],
  "trim-chimneys": ["The trim device, as in NASA/APL's 2023 and 2024 thermal talks: a cold bypass duct under the belly, outside the foam and exposed to Titan, between fore and aft diverter flaps. Opening the flaps sends 0-40% of the warm flow forward through the cold duct (in 2% steps, about every 10 minutes) to dump heat to Titan; a full-scale test reached 245.7 W at a 23.7-degree flap angle with a non-flight test duct. Duct section, housings and actuators are estimates. An earlier concept with a chimney in each side wall (ICES-2023) is archived.", "thermal"],
};

function liveComponentReading(name) {
  if (name === "iem") return `Vehicle mode: ${state.mode}. Flight plan: ${state.plan?.status ?? "none"}.`;
  if (name === "power-units") return `Vehicle load ${(state.power / 1000).toFixed(2)} kW; MMRTG generation ${state.generatedW.toFixed(0)} W. Modeled totals.`;
  if (["frontier-radio", "twta", "hga-actuators"].includes(name)) return `${state.downlinkW > 0 ? "Transmitting" : state.downlinkActive ? "Preparing antenna" : "Radio idle"}; ${(state.dataStoredBits / 1e6).toFixed(1)} Mbit queued. Downlink system load ${state.downlinkW.toFixed(0)} W (modeled).`;
  if (["drills", "sample-lines", "sample-carousel", "drams", "drill-blower"].includes(name)) return state.science.sampling
    ? `${samplingSequence(state).label}${state.hold ? " / paused" : ""}: ${(samplingSequence(state).progress * 100).toFixed(0)}% of the ${samplingSequence(state).duration} s training cycle; ${state.sciencePowerW.toFixed(0)} W instrument load (modeled).`
    : `Sampling idle; ${state.science.samples.length} completed sample records.`;
  if (["battery", "battery-sensor"].includes(name)) return `Charge ${state.battery.toFixed(1)}%; ${state.chargingBlocked ? "charging inhibited by temperature" : `${Math.abs(state.netBatteryW).toFixed(0)} W ${state.netBatteryW >= 0 ? "charging" : "discharging"}`} (modeled).`;
  if (["aft-bulkhead", "fan", "underfloor-duct", "trim-chimneys"].includes(name)) return `Gas flow ${state.gasFlow.toFixed(3)} kg/s; trim ${(state.effectiveTrim * 100).toFixed(0)}%; cold-duct heat rejection ${state.coldDuctW.toFixed(0)} W (modeled).`;
  return "";
}

// ---- Vehicle layers (Mission view) and the shared systems readouts ----
let partRows = "";
let detailKey = "";
const rowElements = new Map();
export function updateLayerPanel() {
  updateInspectorUI();
  const layered = state.missionLayer !== "exterior";
  $("component-temperatures").hidden = !layered;
  document.querySelectorAll("[data-layer]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.layer === state.missionLayer)));
  $("thermal-legend").hidden = !layered;
  const mock = layered && state.vehicleModel === "original";
  $("part-list").hidden = !layered;
  $("mock-banner").hidden = !mock;
  $("layer-note").hidden = !layered || mock;
  const range = thermalRanges[state.thermalRange];
  $("thermal-min").textContent = `${range.min} C`;
  $("thermal-max").textContent = `${range.max} C`;
  $("thermal-range").textContent = `Scale: ${range.label.toLowerCase()}`;
  $("airflow-panel").hidden = state.missionLayer !== "internal" || mock;
  if (state.missionLayer === "internal" && !mock) updateAirflowPanel();
  $("thermal-bar").style.background = thermalGradientCss(range);
  if (!layered) { $("part-detail").hidden = true; return; }
  const zones = thermalZoneTemps(state);
  const markers = partMarkers.length ? partMarkers : [];
  const rows = markers.map(marker => `${marker.index}|${marker.name}|${marker.label}`).join(";");
  if (rows !== partRows) {
    partRows = rows;
    rowElements.clear();
    $("part-list").replaceChildren(...markers.map(marker => {
      const item = document.createElement("li");
      item.dataset.part = marker.name;
      item.classList.toggle("active", marker.name === state.selectedPart);
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-pressed", String(marker.name === state.selectedPart));
      const zone = zones[marker.zone];
      const number = document.createElement("b");
      number.textContent = marker.index;
      const name = document.createElement("span");
      name.textContent = marker.label;
      const temp = document.createElement("em");
      temp.textContent = zone ? `${zone.c.toFixed(0)} C` : "";
      if (zone) temp.style.color = thermalCss(zone.c);
      button.append(number, name, temp);
      item.append(button);
      rowElements.set(marker.name, { item, button, temp });
      return item;
    }));
  }
  // Update in place so live telemetry never removes a focused component button.
  for (const marker of markers) {
    const { item, button, temp } = rowElements.get(marker.name);
    const active = marker.name === state.selectedPart;
    item.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    const zone = zones[marker.zone];
    temp.textContent = zone ? `${zone.c.toFixed(0)} C` : "";
    if (zone) temp.style.color = thermalCss(zone.c);
  }
  const selected = markers.find(marker => marker.name === state.selectedPart);
  $("part-detail").hidden = !selected;
  if (selected) {
    const zone = zones[selected.zone];
    $("part-title").textContent = `${selected.index}. ${selected.label}`;
    $("part-temperature").textContent = zone ? `${zone.c.toFixed(1)} C - ${zone.source}.` : "No temperature available.";
    $("part-placement").textContent = `Placement: ${selected.source}.`;
    const info = selected.mock ? null : componentInfo[selected.name];
    $("part-role").textContent = info?.[0] ?? "";
    $("part-role").hidden = !info;
    const reading = selected.mock ? "" : liveComponentReading(selected.name);
    $("part-live").textContent = reading;
    $("part-live").hidden = !reading;
    const key = `${selected.name}|${selected.mock}`;
    if (key !== detailKey) {
      detailKey = key;
      const entries = selected.mock ? [] : [...new Set([info?.[1] ?? "thermal", ...(selected.name === "sample-carousel" ? ["carouselDesign"] : ["wonderwall", "drams"].includes(selected.name) ? ["carouselPhotos", "thermal"] : selected.name === "frontier-radio" ? ["frontierSpecs", "spacecraft"] : ["iem", "power-units"].includes(selected.name) ? ["integration"] : ["side-cameras", "nose-cameras-inside"].includes(selected.name) ? ["spacecraft"] : selected.name === "drills" ? ["dracoPaper"] : selected.name === "sample-lines" ? ["sampling"] : selected.name === "drill-blower" ? ["thermal", "sampling"] : selected.name === "twta" ? ["thermal", "thermal2020", "lroTwta", "mroTelecom", "stellantTwt"] : selected.name === "hga-actuators" ? ["thermal", "thermal2020", "nasaHga", "spacecraft"] : selected.name === "battery" ? ["batteryArticle", "gsYuasaCells", "thermal", "thermal2020"] : []), "payload"])];
      if (selected.name === "aft-bulkhead") entries.splice(1, 0, "structureTest", "thermal");
      if (selected.name === "nose-bulkhead") entries.splice(1, 0, "structureFit", "thermal");
      if (selected.name === "nose-electronics") entries.splice(1, 0, "mimu", "mimuStudy", "ocellus", "ocellusPackaging", "sqrliReview", "ocellusReuse", "navigation", "thermal");
      if (selected.name === "nose-sensors") entries.splice(1, 0, "dragmet", "dragmetCad");
      $("part-sources").replaceChildren(...entries.map(id => {
        const link = document.createElement("a");
        [link.textContent, link.href] = sources[id];
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        return link;
      }));
    }
  }
}

// Live description of the warm-air loop: how it moves, how it is regulated, how it is measured.
function updateAirflowPanel() {
  const flow = state.gasFlow ?? systemsModel.gasMassFlow;
  const fan = Math.round((state.fan ?? 1) * 100);
  // Gas speed in the under-floor duct: density of the warm N2-rich gas at 146 kPa, divided into
  // the modeled duct's 14 x 4.5 cm section (width from the TFAWS 2023 plan view, height [EST]).
  const density = 146000 * 0.028 / (8.314 * (273.15 + (state.coreC ?? 12)));
  const ductSpeed = flow / density / (0.14 * 0.045);
  const trim = Math.round((state.effectiveTrim ?? 0) * 100);
  const next = Math.max(0, state.trimClock ?? 0);
  const clock = `${Math.floor(next / 60)}:${String(Math.floor(next % 60)).padStart(2, "0")}`;
  $("air-moves").textContent = `The two fans (${fan}%${state.fanIntegrity < 1 ? ", restricted" : ""}) move ${flow.toFixed(3)} kg/s `
    + `(design 0.052 kg/s) of nitrogen-rich Titan gas, warmed to ${(state.warmGasC ?? 0).toFixed(0)} C by the MMRTG's waste heat, `
    + `forward through the under-floor duct (about ${ductSpeed.toFixed(1)} m/s, estimate) and back through the bay at ${(state.coreC ?? 0).toFixed(0)} C.`;
  $("air-regulated").textContent = `The fore and aft diverter flaps send ${trim}% of the flow through the exposed cold duct under the belly (0-40% in 2% steps), `
    + `dumping ${(state.coldDuctW ?? 0).toFixed(0)} W to Titan. `
    + (state.trimFlightLocked ? "Held closed in flight. " : state.thermalAuto ? `Automatic; next adjustment in ${clock}. ` : "Manual setting. ")
    + "Dragonfly uses two controllers taking turns, on battery and MMRTG fin-root temperature, about every 10 minutes; this simulator uses one simplified loop on battery and bay temperature.";
  $("air-measured").textContent = `Battery ${(state.batteryC ?? 0).toFixed(1)} C and the MMRTG fin root (here, the modeled gas temperature) `
    + "are the controller inputs (green dots). The flow is the published design rate, not a live measurement. "
    + "NASA's full-scale ground test model carried 203 thermocouples and 15 air-velocity sensors.";
}

function selectPart(name) {
  state.selectedPart = state.selectedPart === name ? null : name;
  if (state.inspector.focusPart || state.inspector.followSampling || state.inspector.isolate) focusInspector(state, state.selectedPart);
  if (state.selectedPart) $("component-temperatures").open = true;
  updateLayerPanel();
}

document.querySelectorAll("[data-layer]").forEach(button => button.addEventListener("click", () => {
  state.missionLayer = button.dataset.layer;
  try { localStorage.setItem("dragonfly-mission-layer", state.missionLayer); } catch { /* optional */ }
  partRows = "";
  updateLayerPanel();
}));
$("thermal-range").addEventListener("click", () => {
  state.thermalRange = state.thermalRange === "full" ? "inside" : "full";
  partRows = "";
  updateLayerPanel();
});
$("part-list").addEventListener("click", (event) => {
  const row = event.target.closest("li[data-part]");
  if (row) selectPart(row.dataset.part);
});
flightCanvas.addEventListener("click", (event) => {
  if (state.view !== "mission" || !partMarkers.length) return;
  const rect = flightCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left, y = event.clientY - rect.top;
  const hit = partMarkers.reduce((best, marker) => {
    const distance = Math.hypot(marker.x - x, marker.y - y);
    return marker.drawn && distance < 18 && (!best || distance < best.distance) ? { marker, distance } : best;
  }, null);
  if (hit) selectPart(hit.marker.name);
});
try {
  const savedLayer = localStorage.getItem("dragonfly-mission-layer");
  if (["exterior", "internal", "thermal"].includes(savedLayer)) state.missionLayer = savedLayer;
} catch { /* optional */ }
