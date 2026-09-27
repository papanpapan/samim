/**
 * Client demo videos EN / BN / HI — natural Edge neural voice + photo slideshow.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { EdgeTTS } from 'edge-tts-universal';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, 'nacecary_photos_and_flowers_for_testing');
const outDir = path.join(root, 'demo_videos');
const workDir = path.join(outDir, '_work');
fs.mkdirSync(workDir, { recursive: true });

const ffmpeg = String.raw`C:\Users\SAMIM\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe`;
const ffprobe = String.raw`C:\Users\SAMIM\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffprobe.exe`;

const scripts = {
  en: {
    voice: 'en-IN-NeerjaNeural',
    file: 'SN-ERMS_Client_Demo_English.mp4',
    parts: [
      'Welcome to Saba Nursery ERMS, a complete digital system for modern nurseries.',
      'With this software, you can manage mother plants, create new saplings, track stock, and sell at the counter, all in one place.',
      'Take photos and short videos of your plants, attach them to each record, and share plant pages with customers.',
      'Live cameras watch your nursery fields. If someone enters, the system raises a danger alert with photo and video evidence.',
      'You can ask questions by voice, record treatments, and see accounts and reports clearly.',
      'It works on computer and mobile phone. Easy for staff. Powerful for owners.',
      'Saba Nursery ERMS. Grow your nursery with confidence. Thank you.',
    ],
  },
  bn: {
    voice: 'bn-IN-TanishaaNeural',
    file: 'SN-ERMS_Client_Demo_Bangla.mp4',
    parts: [
      'স্বাগতমতো সাবা নার্সারি ইআরএমএস। আধুনিক নার্সারির সম্পূর্ণ ডিজিটাল সিস্টেম।',
      'এই সফটওয়্যারে মাদার প্ল্যান্ট রাখুন, নতুন চারা তৈরি করুন, স্টক দেখুন, আর কাউন্টারে বিক্রি করুন। সব এক জায়গায়।',
      'গাছের ছবি ও ছোট ভিডিও তুলে রেকর্ডে জুড়ে দিন। গ্রাহককে গাছের পেজ শেয়ার করতে পারবেন।',
      'লাইভ ক্যামেরা নার্সারির জায়গা দেখে। কেউ ঢুকলে বিপদ সতর্কতা উঠে, সাথে ছবি ও ভিডিও প্রমাণ থাকে।',
      'কণ্ঠে প্রশ্ন করতে পারবেন, চিকিৎসা লিখতে পারবেন, হিসাব ও রিপোর্ট পরিষ্কার দেখতে পারবেন।',
      'কম্পিউটার ও মোবাইল দুটোতেই চলে। কর্মীদের জন্য সহজ, মালিকের জন্য শক্তিশালী।',
      'সাবা নার্সারি ইআরএমএস। আত্মবিশ্বাস নিয়ে নার্সারি বাড়ান। ধন্যবাদ।',
    ],
  },
  hi: {
    voice: 'hi-IN-SwaraNeural',
    file: 'SN-ERMS_Client_Demo_Hindi.mp4',
    parts: [
      'स्वागत है सबा नर्सरी ईआरएमएस में। आधुनिक नर्सरी के लिए पूरा डिजिटल सिस्टम।',
      'इस सॉफ्टवेयर में मदर प्लांट रखें, नए पौधे बनाएँ, स्टॉक देखें, और काउंटर पर बिक्री करें। सब एक जगह।',
      'पौधों की फोटो और छोटी वीडियो जोड़ें। ग्राहक के साथ प्लांट पेज शेयर कर सकते हैं।',
      'लाइव कैमरा नर्सरी की जगह देखता है। कोई घुसे तो खतरे की चेतावनी आती है, साथ में फोटो और वीडियो सबूत रहता है।',
      'आवाज़ से सवाल पूछ सकते हैं, इलाज लिख सकते हैं, हिसाब और रिपोर्ट साफ़ देख सकते हैं।',
      'कंप्यूटर और मोबाइल दोनों पर चलता है। स्टाफ के लिए आसान, मालिक के लिए शक्तिशाली।',
      'सबा नर्सरी ईआरएमएस। विश्वास के साथ नर्सरी बढ़ाएँ। धन्यवाद।',
    ],
  },
};

function run(bin, args) {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || '').slice(-1200);
    throw new Error(`${bin} failed\n${err}`);
  }
  return r;
}

function probeDuration(file) {
  const r = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', file], { encoding: 'utf8' });
  const n = Number.parseFloat((r.stdout || '').trim());
  if (!Number.isFinite(n)) throw new Error(`duration fail: ${file} :: ${r.stdout}`);
  return n;
}

function pickImages() {
  const picks = [
    '05_mother_plants/orchard_trees.jpg',
    '01_fruits/tropical_fruit.jpg',
    '02_flowers/sunflower.jpg',
    '03_indoor_plants/peace_lily.jpg',
    '04_outdoor_plants/garden_beds.jpg',
    '06_propagation/greenhouse.jpg',
    '07_inventory_stock/orchard_stock.jpg',
    '08_pos_marketing/garden_center.jpg',
    '09_alerts_danger/farm_fence.jpg',
    '12_care_field/garden_work.jpg',
    '13_live_camera/orchard_path.jpg',
    '05_mother_plants/fruit_tree.jpg',
  ];
  return picks.map((rel) => path.join(root, rel)).filter((p) => fs.existsSync(p) && fs.statSync(p).size > 8000);
}

async function makeVoice(langKey, cfg) {
  const partsDir = path.join(workDir, langKey);
  fs.mkdirSync(partsDir, { recursive: true });
  const partFiles = [];
  for (let i = 0; i < cfg.parts.length; i++) {
    const partPath = path.join(partsDir, `p${String(i).padStart(2, '0')}.mp3`);
    process.stdout.write(`TTS ${langKey} ${i + 1}/${cfg.parts.length}\n`);
    const tts = new EdgeTTS(cfg.parts[i], cfg.voice);
    const result = await tts.synthesize();
    fs.writeFileSync(partPath, Buffer.from(await result.audio.arrayBuffer()));
    partFiles.push(partPath);
  }
  const list = path.join(partsDir, 'audio.txt');
  fs.writeFileSync(list, partFiles.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
  const mp3 = path.join(workDir, `${langKey}.mp3`);
  try {
    run(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', mp3]);
  } catch {
    run(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'libmp3lame', '-q:a', '2', mp3]);
  }
  const secs = probeDuration(mp3);
  console.log(`  voice ${secs.toFixed(1)}s`);
  return { mp3, secs };
}

function buildSilentSlideshow(images, secs, silentMp4) {
  const per = Math.max(3, secs / images.length);
  const frames = Math.max(90, Math.round(per * 30)); // 30 fps
  const clipsDir = path.join(workDir, 'clips');
  fs.mkdirSync(clipsDir, { recursive: true });
  const clipFiles = [];
  images.forEach((img, i) => {
    const clip = path.join(clipsDir, `c${String(i).padStart(2, '0')}.mp4`);
    // FFmpeg 9: zoompan holds a still image for N frames (no -loop on jpg).
    run(ffmpeg, [
      '-y',
      '-i', img,
      '-vf', `scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0f1f14,zoompan=z=1:x=0:y=0:d=${frames}:s=1280x720:fps=30,format=yuv420p`,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-t', per.toFixed(3),
      clip,
    ]);
    clipFiles.push(clip);
  });
  const list = path.join(clipsDir, 'v.txt');
  fs.writeFileSync(list, clipFiles.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
  run(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silentMp4]);
}

function mux(silentMp4, mp3, outMp4) {
  run(ffmpeg, [
    '-y',
    '-i', silentMp4,
    '-i', mp3,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    '-movflags', '+faststart',
    outMp4,
  ]);
  const dur = probeDuration(outMp4);
  console.log(`OK ${path.basename(outMp4)} ${dur.toFixed(1)}s ${Math.round(fs.statSync(outMp4).size / 1024)}KB`);
}

async function main() {
  const images = pickImages();
  if (images.length < 4) throw new Error('need images');
  console.log(`images=${images.length}`);

  for (const [key, cfg] of Object.entries(scripts)) {
    const { mp3, secs } = await makeVoice(key, cfg);
    const silent = path.join(workDir, `${key}_silent.mp4`);
    buildSilentSlideshow(images, secs, silent);
    mux(silent, mp3, path.join(outDir, cfg.file));
  }

  fs.writeFileSync(
    path.join(outDir, 'README.txt'),
    `SN-ERMS client demo videos — natural Microsoft Edge neural voices
================================================================
SN-ERMS_Client_Demo_English.mp4  — English (en-IN Neerja)
SN-ERMS_Client_Demo_Bangla.mp4   — বাংলা (bn-IN Tanishaa)
SN-ERMS_Client_Demo_Hindi.mp4    — हिन्दी (hi-IN Swara)

Same folder as the user manual & demo photos.
Rebuild: node docs/build-demo-videos.mjs
`,
    'utf8',
  );

  fs.rmSync(workDir, { recursive: true, force: true });
  console.log('Done', outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
