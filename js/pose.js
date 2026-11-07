/* ShuttleIQ - on-device body tracking.
   Measures real numbers from the clip (how far the player covered, how deep
   the knees bend, how far the arm extends) so the AI is given FACTS instead
   of guessing motion from frozen pictures.

   Nothing leaves the device here. The model runs in the browser.
   It is optional: about 15MB downloads once, then it is cached. If anything
   fails, the app carries on exactly as before. */

/* Built from the PAGE url, not this script's, so it still resolves if the app
   is ever served from a sub-folder. */
const POSE_DIR = new URL('vendor/pose/', document.baseURI).href;
const POSE_MODEL = POSE_DIR + 'pose_landmarker_lite.task';

/* MediaPipe body points we care about. */
const PT = {
  nose: 0,
  lShoulder: 11, rShoulder: 12,
  lElbow: 13, rElbow: 14,
  lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24,
  lKnee: 25, rKnee: 26,
  lAnkle: 27, rAnkle: 28,
};

let posePromise = null;

function poseEnabled() {
  return state.settings.usePose === true;
}

/* Angle at point B, in degrees, for the corner A-B-C. */
function angleAt(a, b, c) {
  if (!a || !b || !c) return null;
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const n1 = Math.hypot(v1x, v1y), n2 = Math.hypot(v2x, v2y);
  if (!n1 || !n2) return null;
  let cos = (v1x * v2x + v1y * v2y) / (n1 * n2);
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
}

function mean(list) {
  const nums = list.filter(n => typeof n === 'number' && isFinite(n));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

/* Load the tracker once. Heavy, so it is only fetched when actually used. */
function loadPose(onStatus) {
  if (posePromise) return posePromise;
  posePromise = (async () => {
    if (onStatus) onStatus('Loading the body tracker (one-time download)...', null);
    const mod = await import(POSE_DIR + 'vision_bundle.mjs');
    const fileset = await mod.FilesetResolver.forVisionTasks(POSE_DIR);
    let landmarker;
    try {
      landmarker = await mod.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
    } catch {
      // older phones have no usable GPU path
      landmarker = await mod.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
    }
    return landmarker;
  })().catch(err => {
    posePromise = null;
    throw err;
  });
  return posePromise;
}

/* Walk the clip, track the body, and turn it into measurements.
   Returns null when tracking is off, unavailable, or finds nobody. */
async function poseMetrics(videoEl, { onStatus, maxSamples = 60 } = {}) {
  if (!poseEnabled()) return null;
  if (!videoEl || !videoEl.videoWidth) return null;

  let landmarker;
  try {
    landmarker = await loadPose(onStatus);
  } catch (err) {
    console.warn('Body tracking unavailable:', err);
    return null;
  }

  const duration = await ensureDuration(videoEl);
  if (!duration || !isFinite(duration)) return null;

  // A fixed budget of samples spread across the clip, so a long clip costs the
  // same as a short one. 60 points is ample for averages, ranges and peaks.
  const samples = Math.max(20, Math.min(maxSamples, Math.round(duration * 2)));
  const frames = [];
  const deadline = Date.now() + 35000; // hard stop, then use whatever we have

  for (let i = 0; i < samples; i++) {
    if (Date.now() > deadline) break;
    const t = (duration * (i + 0.5)) / samples;
    try {
      await seekTo(videoEl, t, 1200);
      const found = landmarker.detectForVideo(videoEl, Math.round(t * 1000));
      const lm = found && found.landmarks && found.landmarks[0];
      if (lm) frames.push({ t, lm });
    } catch {
      /* a single bad frame must not stop the run */
    }
    if (onStatus && i % 10 === 0) {
      onStatus('Tracking your body through the clip...', 5 + Math.round((i / samples) * 45));
    }
  }

  if (frames.length < 8) return null;   // too little to say anything honest

  // --- where the player went (hips are the steadiest centre) ---
  const centres = frames.map(f => {
    const lh = f.lm[PT.lHip], rh = f.lm[PT.rHip];
    return { t: f.t, x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
  });
  const xs = centres.map(c => c.x), ys = centres.map(c => c.y);
  const xRange = Math.max(...xs) - Math.min(...xs);
  const yRange = Math.max(...ys) - Math.min(...ys);

  let travel = 0, flips = 0, lastDir = 0;
  for (let i = 1; i < centres.length; i++) {
    const dx = centres[i].x - centres[i - 1].x;
    travel += Math.hypot(dx, centres[i].y - centres[i - 1].y);
    const dir = dx > 0.004 ? 1 : dx < -0.004 ? -1 : 0;
    if (dir && lastDir && dir !== lastDir) flips++;
    if (dir) lastDir = dir;
  }

  const midX = xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const nearCentre = centres.filter(c => Math.abs(c.x - midX) < 0.12).length / centres.length;

  // --- body shape ---
  const kneeAngles = [], elbowAngles = [], stances = [], reaches = [];
  for (const f of frames) {
    const L = f.lm;
    const kL = angleAt(L[PT.lHip], L[PT.lKnee], L[PT.lAnkle]);
    const kR = angleAt(L[PT.rHip], L[PT.rKnee], L[PT.rAnkle]);
    const knee = mean([kL, kR]);
    if (knee != null) kneeAngles.push(knee);

    const eL = angleAt(L[PT.lShoulder], L[PT.lElbow], L[PT.lWrist]);
    const eR = angleAt(L[PT.rShoulder], L[PT.rElbow], L[PT.rWrist]);
    const elbow = Math.max(eL == null ? 0 : eL, eR == null ? 0 : eR);
    if (elbow) elbowAngles.push(elbow);

    stances.push(Math.abs(L[PT.lAnkle].x - L[PT.rAnkle].x));
    // y grows downwards, so a smaller wrist y means a higher hand
    const shoulderY = (L[PT.lShoulder].y + L[PT.rShoulder].y) / 2;
    reaches.push(shoulderY - Math.min(L[PT.lWrist].y, L[PT.rWrist].y));
  }

  const round = (n, d = 0) => (n == null ? null : Number(n.toFixed(d)));
  return {
    tracked: frames.length,
    sampled: samples,
    detectionRate: round((frames.length / samples) * 100),
    seconds: round(duration, 1),
    courtCoverage: { sideways: round(xRange * 100), depth: round(yRange * 100) },
    distanceMoved: round(travel, 1),   // in screen widths, not percent
    directionChanges: flips,
    timeNearCentre: round(nearCentre * 100),
    kneeAngle: { average: round(mean(kneeAngles)), deepest: round(Math.min(...kneeAngles)) },
    armExtension: { best: round(Math.max(...elbowAngles)), average: round(mean(elbowAngles)) },
    stanceWidth: round(mean(stances) * 100),
    overheadReach: round(Math.max(...reaches) * 100),
  };
}

/* Plain-language lines, so a player sees the numbers without a biomechanics
   degree - and so the coach can sanity-check them. */
function poseReadout(m) {
  if (!m) return [];
  return [
    { label: 'Court covered', value: m.courtCoverage.sideways + '% wide, ' + m.courtCoverage.depth + '% deep' },
    { label: 'Distance moved', value: m.distanceMoved + ' screen widths' },
    { label: 'Direction changes', value: String(m.directionChanges) },
    { label: 'Time near your base', value: m.timeNearCentre + '%' },
    { label: 'Knee bend (lower is deeper)', value: m.kneeAngle.average + '\u00B0 average, ' + m.kneeAngle.deepest + '\u00B0 deepest' },
    { label: 'Arm extension (higher is straighter)', value: m.armExtension.best + '\u00B0 best' },
    { label: 'Stance width', value: m.stanceWidth + '% of frame' },
    { label: 'Body tracked in', value: m.detectionRate + '% of frames' },
  ];
}
