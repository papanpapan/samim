/**
 * Full SN-ERMS walkthrough videos — EN / BN / HI
 * Real app screenshots + Edge neural voice narration.
 *
 * Output:
 *   docs/nacecary_photos_and_flowers_for_testing/demo_videos/
 *     SN-ERMS_Full_Walkthrough_English.mp4
 *     SN-ERMS_Full_Walkthrough_Bangla.mp4
 *     SN-ERMS_Full_Walkthrough_Hindi.mp4
 *
 * Run: node docs/build-full-walkthrough-videos.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { EdgeTTS } from 'edge-tts-universal';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, 'nacecary_photos_and_flowers_for_testing');
const outDir = path.join(root, 'demo_videos');
const shotsDir = path.join(outDir, 'walkthrough_shots');
const workDir = path.join(outDir, '_work_full');
fs.mkdirSync(workDir, { recursive: true });

const ffmpeg = String.raw`C:\Users\SAMIM\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe`;
const ffprobe = String.raw`C:\Users\SAMIM\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffprobe.exe`;

const photoExtras = [
  '05_mother_plants/orchard_trees.jpg',
  '06_propagation/greenhouse.jpg',
  '08_pos_marketing/garden_center.jpg',
  '13_live_camera/orchard_path.jpg',
  '12_care_field/garden_work.jpg',
].map((rel) => path.join(root, rel)).filter((p) => fs.existsSync(p));

/** Long detailed scripts — full example flow. */
const scripts = {
  en: {
    voice: 'en-IN-NeerjaNeural',
    file: 'SN-ERMS_Full_Walkthrough_English.mp4',
    parts: [
      'Welcome to Saba Nursery E R M S. This video explains the full application: what it is for, who uses it, and how to work day by day.',
      'Saba Nursery E R M S is nursery software. It helps you register mother plants, make new saplings, keep stock, sell at the counter, care for plants, and raise danger alerts from a phone camera.',
      'Open the app on computer or mobile. Use HTTPS. On the login screen, enter work email and password. In development you can tap Admin, Manager, Staff, or Cashier to fill demo accounts. Then tap Sign in.',
      'If you are the platform owner, you land on Nursery control. Here you onboard a nursery, set plan limits, turn modules on or off, set sales channels, manage people, and press Open to work inside that nursery.',
      'After Open, the home screen is Today. Today shows next actions: open danger alerts, pending care, low stock, batches that need hardening or ready for sale, unhealthy mothers, and sellable stock. Tap a card to jump to that screen.',
      'My nursery is where places and people live. Add staff under each place with name, email, password, and role. Audit is only the activity log. Do not look for staff create there.',
      'Mother Plants is the mother tree register. Search by tag, plant, variety, or plot. Add a mother plant with place, photos or video, health, and methods. Staff can log scions. Managers register new mothers.',
      'Propagation Hub starts a batch from a mother plant. Move the batch through mist chamber, hardening shade, then mark ready for sale so plants enter inventory as sellable stock with S K U and prices.',
      'Plant Inventory shows ready plants: stock count, bag size, retail and wholesale price, labels and scan. Adjust mortality or stock when needed.',
      'Sales P O S is the counter. Scan or search a ready plant, add to cart, choose channel and payment, optional G S T percent for India rupee nurseries, then Complete sale. Print the receipt. Stock decreases automatically.',
      'Danger alerts use the phone as the camera. Choose fire, intrusion, flood, heat, disease, or other, take a photo, send. The desk sees the case. Live camera can watch for people during allowed hours.',
      'Care schedule holds watering and spray tasks. Vermicompost, distribution bookings, and accounts reports support the full nursery. Language can be Bangla or English. Speaker icons read the screen aloud.',
      'Typical daily flow: open Today, finish care and alerts, check batches, sell on P O S, review mother health. Owners manage nurseries on Platform. Staff and cashiers work the floor and counter.',
      'Saba Nursery E R M S. One workspace for plants, stock, sales, and safety. Thank you for watching.',
    ],
  },
  bn: {
    voice: 'bn-IN-TanishaaNeural',
    file: 'SN-ERMS_Full_Walkthrough_Bangla.mp4',
    parts: [
      'স্বাগতমতো সাবা নার্সারি ই আর এম এস। এই ভিডিওতে পুরো অ্যাপ্লিকেশন বোঝানো হয়েছে: কী কাজে লাগে, কে ব্যবহার করে, আর প্রতিদিন কীভাবে চালাবেন।',
      'সাবা নার্সারি ই আর এম এস নার্সারির সফটওয়্যার। মাদার প্ল্যান্ট রেজিস্টার, নতুন চারা, স্টক, কাউন্টার বিক্রি, গাছের যত্ন, আর ফোন ক্যামেরা দিয়ে বিপদ সতর্কতা—সব এক জায়গায়।',
      'কম্পিউটার বা মোবাইলে অ্যাপ খুলুন। এইচ টি টি পি এস ব্যবহার করুন। লগইন স্ক্রিনে ইমেইল ও পাসওয়ার্ড দিন। ডেমোতে অ্যাডমিন, ম্যানেজার, স্টাফ বা ক্যাশিয়ার চাপলে ফর্ম ভরে যায়। তারপর সাইন ইন।',
      'প্ল্যাটফর্ম ওনার হলে নার্সারি কন্ট্রোল পেজে যাবেন। এখানে নতুন নার্সারি অনবোর্ড, প্ল্যান, মডিউল, সেলস চ্যানেল, পিপল ম্যানেজ, আর ওপেন চাপলে সেই নার্সারির ভিতরে ঢোকেন।',
      'ওপেনের পর হোম হলো টুডে বা আজ। এখানে পরের কাজ দেখায়: বিপদ অ্যালার্ট, কেয়ার, কম স্টক, হার্ডেনিং বা রেডি ব্যাচ, অস্বাস্থ্য মাদার, বিক্রির স্টক। কার্ডে চাপলে সেই স্ক্রিনে যায়।',
      'মাই নার্সারি তে জায়গা ও কর্মী। প্রতি জায়গায় নাম, ইমেইল, পাসওয়ার্ড, রোল দিয়ে স্টাফ যোগ করুন। অডিট শুধু লগ। স্টাফ তৈরি অডিটে খুঁজবেন না।',
      'মাদার প্ল্যান্টস হলো মাদার গাছের রেজিস্টার। ট্যাগ, গাছ, ভ্যারাইটি বা প্লট দিয়ে খুঁজুন। নতুন মাদার যোগ করুন ছবি বা ভিডিওসহ। স্টাফ সিয়ন লগ করতে পারে।',
      'প্রোপাগেশন হাবে মাদার থেকে ব্যাচ শুরু। মিস্ট, হার্ডেনিং, তারপর রেডি ফর সেল চাপলে ইনভেন্টরিতে বিক্রির স্টক হয়।',
      'প্ল্যান্ট ইনভেন্টরিতে প্রস্তুত গাছ, সংখ্যা, ব্যাগ, দাম, লেবেল ও স্ক্যান। প্রয়োজেন স্টক বা মৃত্যু হার ঠিক করুন।',
      'সেলস পি ও এস কাউন্টার। স্ক্যান বা খুঁজে গাছ কার্টে নিন, চ্যানেল ও পেমেন্ট বাছুন, ভারতীয় রুপির নার্সারিতে জি এস টি শতাংশ দিতে পারেন, তারপর সেল সম্পন্ন ও রসিদ প্রিন্ট। স্টক নিজে কমে।',
      'ডেঞ্জার অ্যালার্টে ফোনই ক্যামেরা। আগুন, অনুপ্রবেশ, বন্যা, গরম, রোগ বা অন্য—ছবি তুলে পাঠান। ডেস্ক কেস দেখে। লাইভ ক্যামেরা নির্দিষ্ট সময়ে মানুষ দেখতে পারে।',
      'কেয়ার শিডিউলে পানি ও স্প্রে। ভার্মিকম্পোস্ট, ডিস্ট্রিবিউশন, অ্যাকাউন্টস রিপোর্টও আছে। ভাষা বাংলা বা ইংরেজি। স্পিকার আইকনে স্ক্রিন শোনা যায়।',
      'প্রতিদিনের ফ্লো: টুডে খুলুন, কেয়ার ও অ্যালার্ট শেষ করুন, ব্যাচ দেখুন, পি ও এস এ বিক্রি করুন, মাদার স্বাস্থ্য দেখুন। ওনার প্ল্যাটফর্মে নার্সারি চালান। স্টাফ ও ক্যাশিয়ার ফ্লোর ও কাউন্টার চালান।',
      'সাবা নার্সারি ই আর এম এস। গাছ, স্টক, বিক্রি ও নিরাপত্তা এক ওয়ার্কস্পেসে। দেখার জন্য ধন্যবাদ।',
    ],
  },
  hi: {
    voice: 'hi-IN-SwaraNeural',
    file: 'SN-ERMS_Full_Walkthrough_Hindi.mp4',
    parts: [
      'स्वागत है सबा नर्सरी ई आर एम एस में। इस वीडियो में पूरा ऐप समझाया गया है: किसलिए है, कौन इस्तेमाल करता है, और रोज़ कैसे चलाएँ।',
      'सबा नर्सरी ई आर एम एस नर्सरी सॉफ्टवेयर है। मदर प्लांट रजिस्टर, नए पौधे, स्टॉक, काउंटर बिक्री, देखभाल, और फोन कैमरे से खतरे की चेतावनी—सब एक जगह।',
      'कंप्यूटर या मोबाइल पर ऐप खोलें। एच टी टी पी एस इस्तेमाल करें। लॉगिन पर ईमेल और पासवर्ड दें। डेमो में एडमिन, मैनेजर, स्टाफ या कैशियर दबाएँ तो फॉर्म भर जाता है। फिर साइन इन।',
      'प्लेटफ़ॉर्म ओनर हों तो नर्सरी कंट्रोल पर पहुँचेंगे। यहाँ नर्सरी ऑनबोर्ड, प्लान, मॉड्यूल, सेल्स चैनल, लोग, और ओपन दबाकर उस नर्सरी के अंदर जाएँ।',
      'ओपन के बाद होम है टुडे यानी आज। अगले काम दिखते हैं: खतरे की अलर्ट, केयर, कम स्टॉक, हार्डनिंग या रेडी बैच, बीमार मदर, बिक्री योग्य स्टॉक। कार्ड दबाकर उस स्क्रीन पर जाएँ।',
      'माई नर्सरी में जगह और कर्मचारी। हर जगह पर नाम, ईमेल, पासवर्ड, रोल से स्टाफ जोड़ें। ऑडिट सिर्फ लॉग है। स्टाफ बनाना वहाँ मत खोजें।',
      'मदर प्लांट्स मदर पेड़ों का रजिस्टर है। टैग, पौधा, वैरायटी या प्लॉट से खोजें। फोटो या वीडियो के साथ मदर जोड़ें। स्टाफ सायन लॉग कर सकता है।',
      'प्रोपेगेशन हब में मदर से बैच शुरू करें। मिस्ट, हार्डनिंग, फिर रेडी फॉर सेल से इन्वेंटरी में बिक्री स्टॉक बनता है।',
      'प्लांट इन्वेंटरी में तैयार पौधे, संख्या, बैग, दाम, लेबल और स्कैन। ज़रूरत पर स्टॉक या मृत्यु दर ठीक करें।',
      'सेल्स पी ओ एस काउंटर है। स्कैन या खोज से पौधा कार्ट में डालें, चैनल और भुगतान चुनें, भारत रुपये नर्सरी में जी एस टी प्रतिशत दे सकते हैं, फिर सेल पूरा और रसीद प्रिंट। स्टॉक अपने आप घटता है।',
      'डेंजर अलर्ट में फोन ही कैमरा है। आग, घुसपैठ, बाढ़, गर्मी, बीमारी या अन्य—फोटो लेकर भेजें। डेस्क केस देखता है। लाइव कैमरा तय समय में व्यक्ति देख सकता है।',
      'केयर शेड्यूल में पानी और स्प्रे। वर्मीकंपोस्ट, डिस्ट्रीब्यूशन, अकाउंट्स रिपोर्ट भी हैं। भाषा बांग्ला या अंग्रेज़ी। स्पीकर आइकन से स्क्रीन सुन सकते हैं।',
      'रोज़ का फ़्लो: टुडे खोलें, केयर और अलर्ट निपटाएँ, बैच देखें, पी ओ एस पर बेचें, मदर स्वास्थ्य देखें। ओनर प्लेटफ़ॉर्म पर नर्सरी चलाए। स्टाफ और कैशियर फ़्लोर और काउंटर चलाएँ।',
      'सबा नर्सरी ई आर एम एस। पौधे, स्टॉक, बिक्री और सुरक्षा एक वर्कस्पेस में। देखने के लिए धन्यवाद।',
    ],
  },
};

function run(bin, args) {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 });
  if (r.status !== 0) {
    throw new Error(`${path.basename(bin)} failed\n${(r.stderr || r.stdout || '').slice(-1500)}`);
  }
  return r;
}

function probeDuration(file) {
  const r = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', file], { encoding: 'utf8' });
  const n = Number.parseFloat((r.stdout || '').trim());
  if (!Number.isFinite(n)) throw new Error(`duration fail: ${file}`);
  return n;
}

function pickImages() {
  const ordered = [
    '01_login.png',
    '02_platform.png',
    '03_dashboard_today.png',
    '04_my_nursery.png',
    '05_mother_plants.png',
    '06_propagation.png',
    '07_inventory.png',
    '08_pos.png',
    '09_alerts.png',
    '10_care.png',
  ].map((name) => path.join(shotsDir, name)).filter((p) => fs.existsSync(p) && fs.statSync(p).size > 20_000);
  const merged = [...ordered, ...photoExtras];
  if (merged.length < 6) throw new Error(`need screenshots in ${shotsDir}`);
  return merged;
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
  const per = Math.max(4.5, secs / images.length);
  const frames = Math.max(120, Math.round(per * 30));
  const clipsDir = path.join(workDir, 'clips');
  fs.mkdirSync(clipsDir, { recursive: true });
  const clipFiles = [];
  images.forEach((img, i) => {
    const clip = path.join(clipsDir, `c${String(i).padStart(2, '0')}.mp4`);
    process.stdout.write(`  slide ${i + 1}/${images.length}\n`);
    run(ffmpeg, [
      '-y',
      '-i', img,
      '-vf', `scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0f1f14,zoompan=z='min(zoom+0.0004,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1280x720:fps=30,format=yuv420p`,
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
  console.log(`images=${images.length}`);

  for (const [key, cfg] of Object.entries(scripts)) {
    const { mp3, secs } = await makeVoice(key, cfg);
    const silent = path.join(workDir, `${key}_silent.mp4`);
    buildSilentSlideshow(images, secs, silent);
    mux(silent, mp3, path.join(outDir, cfg.file));
  }

  fs.writeFileSync(
    path.join(outDir, 'README_FULL_WALKTHROUGH.txt'),
    `SN-ERMS full walkthrough videos (app screens + Edge neural voice)
================================================================
SN-ERMS_Full_Walkthrough_English.mp4  — English (en-IN Neerja)
SN-ERMS_Full_Walkthrough_Bangla.mp4   — বাংলা (bn-IN Tanishaa)
SN-ERMS_Full_Walkthrough_Hindi.mp4    — हिन्दी (hi-IN Swara)

Covers: login, platform, Today home, people, mothers, propagation,
inventory, POS+GST note, danger alerts, care, daily flow.

Rebuild: node docs/build-full-walkthrough-videos.mjs
Screenshots: demo_videos/walkthrough_shots/
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
