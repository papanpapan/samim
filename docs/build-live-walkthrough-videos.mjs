/**
 * Long live walkthrough videos (5–8 min) — EN / BN / HI
 * Uses Playwright live UI recording (mouse cursor) + Edge neural voice.
 *
 * 1) node docs/record-live-walkthrough.mjs   (API + Vite must be running)
 * 2) node docs/build-live-walkthrough-videos.mjs
 *
 * Output folder:
 *   docs/nacecary_photos_and_flowers_for_testing/demo_videos/
 *     SN-ERMS_Live_Walkthrough_English.mp4
 *     SN-ERMS_Live_Walkthrough_Bangla.mp4
 *     SN-ERMS_Live_Walkthrough_Hindi.mp4
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { EdgeTTS } from 'edge-tts-universal';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'nacecary_photos_and_flowers_for_testing', 'demo_videos');
const workDir = path.join(outDir, '_work_live');
const silentWebm = path.join(outDir, 'SN-ERMS_Live_Walkthrough_Silent.webm');
const silentMp4 = path.join(workDir, 'silent_base.mp4');

fs.mkdirSync(workDir, { recursive: true });

const ffmpeg = String.raw`C:\Users\SAMIM\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe`;
const ffprobe = String.raw`C:\Users\SAMIM\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffprobe.exe`;

/** Expanded scripts — target ~5.5 to 7.5 minutes of speech per language. */
const scripts = {
  en: {
    voice: 'en-IN-NeerjaNeural',
    file: 'SN-ERMS_Live_Walkthrough_English.mp4',
    parts: [
      'Welcome to Saba Nursery E R M S. This is a full live walkthrough of the real application screen. You will see the mouse move through each module while I explain what the software is for, who should use it, and how to run a nursery day by day.',
      'Saba Nursery E R M S means Enterprise Resource and Smart Inventory Management System. It is nursery software for mother plant registers, new sapling batches, ready stock, counter sales, plant care, distribution, accounts reports, and danger alerts from a phone camera.',
      'Open the app on a computer or phone with H T T P S. On the login screen, enter your work email and password. In development you can tap Admin, Manager, Staff, or Cashier to fill demo accounts. Tap Admin again, then Sign in, to enter as the platform owner.',
      'After sign in, open Nursery control on the left. This is the platform owner home. Here you onboard a new nursery, set plan package limits, turn feature modules on or off, manage sales channels, and manage people for each nursery. Scroll the list so you can see nursery cards and actions.',
      'On each nursery card, use People to add staff with name, email, password, and role. Use Features to enable Mother Plants, Propagation, Inventory, P O S, Care, Alerts, and other modules. When you are ready to work inside that nursery, press Open. Open loads the nursery workspace and sets the nursery header for every A P I call.',
      'The home screen after Open is Today, also called Dashboard. Today is the daily command board. It shows next actions: open danger alerts, pending care tasks, low stock, propagation batches that need hardening or are ready for sale, unhealthy mother plants, and sellable stock counts. Hover the cards to learn where each number leads. Tap a card to jump straight to that screen.',
      'My nursery is where places and people for this nursery live. Create places like plot, greenhouse, mist chamber, or retail counter. Under each place, add staff with role Staff, Cashier, Manager, or Admin. Remember: Audit is only the activity log. Do not look for staff create under Audit. Staff create lives under My nursery or under Platform People for that nursery.',
      'Mother Plants is the mother tree register. Search by tag, plant name, variety, or plot. Add a mother with place, photos or short video, health status, and allowed propagation methods. Field staff can log scion or cutting harvests. Managers register new mothers. Keep photos updated so sales and care teams recognise the tree.',
      'Propagation Hub starts a new batch from a selected mother plant. Choose method such as grafting, cutting, or air layer. Move the batch through mist chamber, then hardening shade. When plants are strong enough, mark Ready for sale. That step creates sellable inventory rows with S K U, bag size, and channel prices.',
      'Plant Inventory lists ready plants. Check stock count, bag size, retail price, wholesale price, labels, and scan codes. Adjust mortality or stock when plants die or move. Inventory is what the counter can sell. If Ready for sale was never pressed on a batch, those plants will not appear here for P O S.',
      'Sales P O S is the sales counter. Scan a barcode or search a ready plant by name or S K U. Add lines to the cart, choose sales channel such as retail or wholesale, choose payment method, and optionally enter G S T percent for India rupee nurseries. Complete the sale, print the receipt, and watch stock decrease automatically. Do not sell from Mother Plants directly — sell only ready inventory.',
      'Danger alerts use the phone as the field camera. Choose type: fire, intrusion, flood, heat, disease, or other. Take a photo, optionally record a short video during the alarm, and send. The desk gets a case number and Q R. Live camera can watch for people during allowed hours. Close a case only after notes and review.',
      'Care schedule holds watering, spray, and field care tasks. Mark tasks done as the day goes. Vermicompost tracks compost batches. Distribution holds customer bookings and deliveries. Accounts reports show sales, expenses, and nursery money summaries for managers.',
      'Language can be Bangla or English in preferences. Speaker icons read the current screen aloud for training. Roles matter: platform owner manages many nurseries; nursery admin and manager run people and stock; staff work mothers, batches, and care; cashier runs P O S.',
      'A typical daily flow is: open Today, clear danger alerts and care tasks, check propagation stages, confirm ready stock on Inventory, sell on P O S, then review mother health before closing. Owners spend morning time on Platform for new nurseries and staff. Staff and cashiers stay on the floor and counter screens.',
      'Security notes for operators: never share passwords, always use H T T P S, and keep each nursery data separate with the nursery header. Uploads for photos and videos stay on the server under controlled limits. Do not paste tokens into chat or public notes.',
      'You have now walked login, platform, Today, My nursery, Mother Plants, Propagation, Inventory, P O S, Danger alerts, Care, and related modules on the live screen. Saba Nursery E R M S — one workspace for plants, stock, sales, care, and safety. Thank you for watching this full walkthrough.',
    ],
  },
  bn: {
    voice: 'bn-IN-TanishaaNeural',
    file: 'SN-ERMS_Live_Walkthrough_Bangla.mp4',
    parts: [
      'স্বাগতম সাবা নার্সারি ই আর এম এস। এটি পুরো অ্যাপের লাইভ স্ক্রিন ওয়াকথ্রু। মাউস প্রতিটি মডিউলে ঘুরবে, আর আমি বলব সফটওয়্যার কী কাজে লাগে, কে ব্যবহার করবে, আর প্রতিদিন কীভাবে চালাবেন।',
      'সাবা নার্সারি ই আর এম এস মানে এন্টারপ্রাইজ রিসোর্স অ্যান্ড স্মার্ট ইনভেন্টরি ম্যানেজমেন্ট সিস্টেম। মাদার প্ল্যান্ট রেজিস্টার, নতুন চারা ব্যাচ, রেডি স্টক, কাউন্টার বিক্রি, গাছের যত্ন, ডিস্ট্রিবিউশন, অ্যাকাউন্টস রিপোর্ট, আর ফোন ক্যামেরা দিয়ে বিপদ সতর্কতা—সব এক জায়গায়।',
      'কম্পিউটার বা ফোনে এইচ টি টি পি এস দিয়ে অ্যাপ খুলুন। লগইন স্ক্রিনে কাজের ইমেইল ও পাসওয়ার্ড দিন। ডেভেলপমেন্টে অ্যাডমিন, ম্যানেজার, স্টাফ বা ক্যাশিয়ার চাপলে ডেমো অ্যাকাউন্ট ভরে যায়। অ্যাডমিন বেছে সাইন ইন করলে প্ল্যাটফর্ম ওনার হিসেবে ঢোকেন।',
      'সাইন ইনের পর বাঁদিকে নার্সারি কন্ট্রোল খুলুন। এটি প্ল্যাটফর্ম ওনারের হোম। এখানে নতুন নার্সারি অনবোর্ড, প্ল্যান প্যাকেজ, ফিচার মডিউল চালু-বন্ধ, সেলস চ্যানেল, আর প্রতি নার্সারির পিপল ম্যানেজ করেন। লিস্ট স্ক্রল করে নার্সারি কার্ড ও অ্যাকশন দেখুন।',
      'প্রতি কার্ডে পিপল দিয়ে নাম, ইমেইল, পাসওয়ার্ড, রোলসহ স্টাফ যোগ করুন। ফিচার্সে মাদার প্ল্যান্টস, প্রোপাগেশন, ইনভেন্টরি, পি ও এস, কেয়ার, অ্যালার্ট চালু করুন। কাজ শুরু করতে ওপেন চাপুন। ওপেন সেই নার্সারির ওয়ার্কস্পেস লোড করে এবং প্রতি এ পি আই কলে নার্সারি হেডার সেট করে।',
      'ওপেনের পর হোম হলো টুডে বা ড্যাশবোর্ড। এটি দৈনিক কমান্ড বোর্ড। এখানে দেখায়: খোলা বিপদ অ্যালার্ট, বাকি কেয়ার, কম স্টক, হার্ডেনিং বা রেডি ব্যাচ, অস্বাস্থ্য মাদার, বিক্রির স্টক। কার্ডে মাউস রেখে বোঝুন কোন সংখ্যা কোথায় যায়। কার্ডে চাপলে সরাসরি সেই স্ক্রিনে যান।',
      'মাই নার্সারিতে এই নার্সারির জায়গা ও কর্মী। প্লট, গ্রিনহাউস, মিস্ট চেম্বার, রিটেইল কাউন্টার যোগ করুন। প্রতি জায়গায় স্টাফ, ক্যাশিয়ার, ম্যানেজার বা অ্যাডমিন রোল দিন। মনে রাখুন: অডিট শুধু অ্যাক্টিভিটি লগ। স্টাফ তৈরি অডিটে খুঁজবেন না। স্টাফ বানান মাই নার্সারি বা প্ল্যাটফর্ম পিপলে।',
      'মাদার প্ল্যান্টস হলো মাদার গাছের রেজিস্টার। ট্যাগ, গাছের নাম, ভ্যারাইটি বা প্লট দিয়ে খুঁজুন। জায়গা, ছবি বা ছোট ভিডিও, স্বাস্থ্য, অনুমোদিত পদ্ধতি দিয়ে মাদার যোগ করুন। ফিল্ড স্টাফ সিয়ন বা কাটিং লগ করতে পারে। ম্যানেজার নতুন মাদার রেজিস্টার করেন।',
      'প্রোপাগেশন হাবে মাদার থেকে নতুন ব্যাচ শুরু। গ্রাফটিং, কাটিং বা এয়ার লেয়ার বেছে নিন। মিস্ট চেম্বার, তারপর হার্ডেনিং শেডে সরান। গাছ শক্ত হলে রেডি ফর সেল চাপুন। তখন ইনভেন্টরিতে এস কে ইউ, ব্যাগ সাইজ ও চ্যানেল দামসহ বিক্রির স্টক তৈরি হয়।',
      'প্ল্যান্ট ইনভেন্টরিতে প্রস্তুত গাছের তালিকা। স্টক সংখ্যা, ব্যাগ, খুচরা ও পাইকারি দাম, লেবেল ও স্ক্যান কোড দেখুন। মৃত্যু বা স্থানান্তরে স্টক ঠিক করুন। কাউন্টার শুধু এখান থেকে বিক্রি করে। ব্যাচে রেডি ফর সেল না চাপলে পি ও এস এ আসবে না।',
      'সেলস পি ও এস কাউন্টার। বারকোড স্ক্যান বা নাম ও এস কে ইউ দিয়ে খুঁজে কার্টে নিন। রিটেইল বা হোলসেল চ্যানেল, পেমেন্ট পদ্ধতি বাছুন। ভারতীয় রুপির নার্সারিতে জি এস টি শতাংশ দিতে পারেন। সেল সম্পন্ন করে রসিদ প্রিন্ট করুন—স্টক নিজে কমে। মাদার প্ল্যান্ট থেকে সরাসরি বিক্রি করবেন না।',
      'ডেঞ্জার অ্যালার্টে ফোনই ফিল্ড ক্যামেরা। আগুন, অনুপ্রবেশ, বন্যা, গরম, রোগ বা অন্য বেছে ছবি তুলুন, প্রয়োজনে অ্যালার্মের সময় ছোট ভিডিও রেকর্ড করে পাঠান। ডেস্কে কেস নম্বর ও কিউ আর আসে। লাইভ ক্যামেরা নির্দিষ্ট সময়ে মানুষ দেখতে পারে। কেস বন্ধ করুন শুধু নোট ও রিভিউর পর।',
      'কেয়ার শিডিউলে পানি, স্প্রে ও ফিল্ড কাজ। দিনের কাজ শেষে টিক দিন। ভার্মিকম্পোস্টে কম্পোস্ট ব্যাচ। ডিস্ট্রিবিউশনে বুকিং ও ডেলিভারি। অ্যাকাউন্টস রিপোর্টে বিক্রি, খরচ ও নার্সারির টাকার সারাংশ।',
      'প্রেফারেন্সে ভাষা বাংলা বা ইংরেজি। স্পিকার আইকনে স্ক্রিন জোরে পড়ে—প্রশিক্ষণে কাজে লাগে। রোল: প্ল্যাটফর্ম ওনার অনেক নার্সারি; অ্যাডমিন ও ম্যানেজার মানুষ ও স্টক; স্টাফ মাদার, ব্যাচ, কেয়ার; ক্যাশিয়ার পি ও এস।',
      'প্রতিদিনের ফ্লো: টুডে খুলুন, অ্যালার্ট ও কেয়ার শেষ করুন, প্রোপাগেশন ধাপ দেখুন, ইনভেন্টরিতে রেডি স্টক নিশ্চিত করুন, পি ও এস এ বিক্রি করুন, শেষে মাদার স্বাস্থ্য দেখুন। ওনার সকালে প্ল্যাটফর্মে নতুন নার্সারি ও স্টাফ। স্টাফ ও ক্যাশিয়ার ফ্লোর ও কাউন্টারে থাকুন।',
      'নিরাপত্তা: পাসওয়ার্ড শেয়ার করবেন না, সবসময় এইচ টি টি পি এস ব্যবহার করুন, নার্সারি ডেটা আলাদা রাখুন। ছবি ও ভিডিও আপলোড সার্ভারের সীমার ভিতরে। টোকেন চ্যাটে বা পাবলিক নোটে পেস্ট করবেন না।',
      'এখন আপনি লাইভ স্ক্রিনে লগইন, প্ল্যাটফর্ম, টুডে, মাই নার্সারি, মাদার প্ল্যান্টস, প্রোপাগেশন, ইনভেন্টরি, পি ও এস, ডেঞ্জার অ্যালার্ট, কেয়ার ও সংশ্লিষ্ট মডিউল দেখেছেন। সাবা নার্সারি ই আর এম এস—গাছ, স্টক, বিক্রি, যত্ন ও নিরাপত্তা এক ওয়ার্কস্পেসে। পূর্ণ ওয়াকথ্রু দেখার জন্য ধন্যবাদ।',
    ],
  },
  hi: {
    voice: 'hi-IN-SwaraNeural',
    file: 'SN-ERMS_Live_Walkthrough_Hindi.mp4',
    parts: [
      'स्वागत है सबा नर्सरी ई आर एम एस में। यह पूरे ऐप का लाइव स्क्रीन वॉकथ्रू है। माउस हर मॉड्यूल पर घूमेगा, और मैं बताऊँगा सॉफ्टवेयर किसलिए है, कौन इस्तेमाल करे, और रोज़ कैसे चलाएँ।',
      'सबा नर्सरी ई आर एम एस यानी एंटरप्राइज़ रिसोर्स एंड स्मार्ट इन्वेंटरी मैनेजमेंट सिस्टम। मदर प्लांट रजिस्टर, नए पौधे बैच, रेडी स्टॉक, काउंटर बिक्री, देखभाल, डिस्ट्रीब्यूशन, अकाउंट्स रिपोर्ट, और फोन कैमरे से खतरे की चेतावनी—सब एक जगह।',
      'कंप्यूटर या फोन पर एच टी टी पी एस से ऐप खोलें। लॉगिन पर काम का ईमेल और पासवर्ड दें। डेवलपमेंट में एडमिन, मैनेजर, स्टाफ या कैशियर दबाने से डेमो अकाउंट भर जाता है। एडमिन चुनकर साइन इन करें तो प्लेटफ़ॉर्म ओनर बनकर अंदर जाएँ।',
      'साइन इन के बाद बाईं ओर नर्सरी कंट्रोल खोलें। यह प्लेटफ़ॉर्म ओनर का होम है। यहाँ नई नर्सरी ऑनबोर्ड, प्लान पैकेज, फीचर मॉड्यूल चालू-बंद, सेल्स चैनल, और हर नर्सरी के लोग मैनेज करें। लिस्ट स्क्रॉल करके कार्ड और ऐक्शन देखें।',
      'हर कार्ड पर पीपल से नाम, ईमेल, पासवर्ड, रोल के साथ स्टाफ जोड़ें। फीचर्स में मदर प्लांट्स, प्रोपेगेशन, इन्वेंटरी, पी ओ एस, केयर, अलर्ट चालू करें। काम शुरू करने के लिए ओपन दबाएँ। ओपन उस नर्सरी का वर्कस्पेस लोड करता है और हर ए पी आई कॉल पर नर्सरी हेडर सेट करता है।',
      'ओपन के बाद होम है टुडे यानी डैशबोर्ड। यह रोज़ का कमांड बोर्ड है। यहाँ दिखता है: खुले खतरे की अलर्ट, बाकी केयर, कम स्टॉक, हार्डनिंग या रेडी बैच, बीमार मदर, बिक्री योग्य स्टॉक। कार्ड पर माउस रखकर समझें संख्या कहाँ ले जाती है। कार्ड दबाकर सीधे उस स्क्रीन पर जाएँ।',
      'माई नर्सरी में इस नर्सरी की जगहें और कर्मचारी। प्लॉट, ग्रीनहाउस, मिस्ट चैंबर, रिटेल काउंटर जोड़ें। हर जगह पर स्टाफ, कैशियर, मैनेजर या एडमिन रोल दें। याद रखें: ऑडिट सिर्फ एक्टिविटी लॉग है। स्टाफ बनाना ऑडिट में मत खोजें। स्टाफ बनाएँ माई नर्सरी या प्लेटफ़ॉर्म पीपल में।',
      'मदर प्लांट्स मदर पेड़ों का रजिस्टर है। टैग, पौधे का नाम, वैरायटी या प्लॉट से खोजें। जगह, फोटो या छोटा वीडियो, स्वास्थ्य, अनुमति विधियों के साथ मदर जोड़ें। फ़ील्ड स्टाफ सायन या कटिंग लॉग कर सकता है। मैनेजर नए मदर रजिस्टर करते हैं।',
      'प्रोपेगेशन हब में मदर से नया बैच शुरू करें। ग्राफ्टिंग, कटिंग या एयर लेयर चुनें। मिस्ट चैंबर, फिर हार्डनिंग शेड में ले जाएँ। पौधे मज़बूत हों तो रेडी फॉर सेल दबाएँ। तब इन्वेंटरी में एस के यू, बैग साइज़ और चैनल दाम के साथ बिक्री स्टॉक बनता है।',
      'प्लांट इन्वेंटरी में तैयार पौधों की सूची। स्टॉक संख्या, बैग, खुदरा और थोक दाम, लेबल और स्कैन कोड देखें। मृत्यु या स्थानांतरण पर स्टॉक ठीक करें। काउंटर सिर्फ यहीं से बेचता है। बैच पर रेडी फॉर सेल न दबाने पर पी ओ एस में नहीं आएगा।',
      'सेल्स पी ओ एस काउंटर है। बारकोड स्कैन या नाम व एस के यू से खोजकर कार्ट में डालें। रिटेल या होलसेल चैनल, भुगतान चुनें। भारत रुपये नर्सरी में जी एस टी प्रतिशत दे सकते हैं। सेल पूरा कर रसीद प्रिंट करें—स्टॉक अपने आप घटता है। मदर प्लांट से सीधे मत बेचें।',
      'डेंजर अलर्ट में फोन ही फ़ील्ड कैमरा है। आग, घुसपैठ, बाढ़, गर्मी, बीमारी या अन्य चुनकर फोटो लें, ज़रूरत पर अलार्म के समय छोटा वीडियो रिकॉर्ड कर भेजें। डेस्क पर केस नंबर और क्यू आर आता है। लाइव कैमरा तय समय में व्यक्ति देख सकता है। केस बंद करें सिर्फ नोट और रिव्यू के बाद।',
      'केयर शेड्यूल में पानी, स्प्रे और फ़ील्ड काम। दिन के काम पर टिक लगाएँ। वर्मीकंपोस्ट में कंपोस्ट बैच। डिस्ट्रीब्यूशन में बुकिंग और डिलीवरी। अकाउंट्स रिपोर्ट में बिक्री, खर्च और नर्सरी पैसे का सार।',
      'प्रेफ़रेंस में भाषा बांग्ला या अंग्रेज़ी। स्पीकर आइकन स्क्रीन ज़ोर से पढ़ता है—ट्रेनिंग में काम आता है। रोल: प्लेटफ़ॉर्म ओनर कई नर्सरी; एडमिन और मैनेजर लोग व स्टॉक; स्टाफ मदर, बैच, केयर; कैशियर पी ओ एस।',
      'रोज़ का फ़्लो: टुडे खोलें, अलर्ट और केयर निपटाएँ, प्रोपेगेशन चरण देखें, इन्वेंटरी में रेडी स्टॉक पक्का करें, पी ओ एस पर बेचें, आखिर में मदर स्वास्थ्य देखें। ओनर सुबह प्लेटफ़ॉर्म पर नई नर्सरी और स्टाफ। स्टाफ और कैशियर फ़्लोर और काउंटर पर रहें।',
      'सुरक्षा: पासवर्ड शेयर न करें, हमेशा एच टी टी पी एस इस्तेमाल करें, नर्सरी डेटा अलग रखें। फोटो और वीडियो अपलोड सर्वर सीमा के अंदर। टोकन चैट या पब्लिक नोट में पेस्ट न करें।',
      'अब आपने लाइव स्क्रीन पर लॉगिन, प्लेटफ़ॉर्म, टुडे, माई नर्सरी, मदर प्लांट्स, प्रोपेगेशन, इन्वेंटरी, पी ओ एस, डेंजर अलर्ट, केयर और संबंधित मॉड्यूल देखे। सबा नर्सरी ई आर एम एस—पौधे, स्टॉक, बिक्री, देखभाल और सुरक्षा एक वर्कस्पेस में। पूरा वॉकथ्रू देखने के लिए धन्यवाद।',
    ],
  },
};

function run(bin, args) {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 80 * 1024 * 1024 });
  if (r.status !== 0) {
    throw new Error(`${path.basename(bin)} failed\n${(r.stderr || r.stdout || '').slice(-2000)}`);
  }
  return r;
}

function probeDuration(file) {
  const r = spawnSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', file], { encoding: 'utf8' });
  const n = Number.parseFloat((r.stdout || '').trim());
  if (!Number.isFinite(n)) throw new Error(`duration fail: ${file}`);
  return n;
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
  console.log(`  voice ${secs.toFixed(1)}s (${(secs / 60).toFixed(1)} min)`);
  return { mp3, secs };
}

function ensureSilentMp4() {
  if (!fs.existsSync(silentWebm)) {
    throw new Error(`Missing live recording. Run first:\n  node docs/record-live-walkthrough.mjs\nExpected: ${silentWebm}`);
  }
  console.log('Converting silent WebM → MP4…');
  run(ffmpeg, [
    '-y',
    '-i', silentWebm,
    '-an',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-movflags', '+faststart',
    silentMp4,
  ]);
  console.log(`  silent video ${probeDuration(silentMp4).toFixed(1)}s`);
}

function fitVideoToAudio(targetSecs, outPath) {
  const baseSecs = probeDuration(silentMp4);
  // Loop or trim so video length matches narration (±0.3s).
  if (baseSecs >= targetSecs - 0.2) {
    run(ffmpeg, [
      '-y',
      '-i', silentMp4,
      '-t', targetSecs.toFixed(3),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-an',
      outPath,
    ]);
  } else {
    const list = path.join(workDir, 'loop.txt');
    const loops = Math.ceil(targetSecs / baseSecs) + 1;
    const lines = [];
    for (let i = 0; i < loops; i++) lines.push(`file '${silentMp4.replace(/\\/g, '/')}'`);
    fs.writeFileSync(list, lines.join('\n'));
    const looped = path.join(workDir, 'looped.mp4');
    run(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', looped]);
    run(ffmpeg, [
      '-y',
      '-i', looped,
      '-t', targetSecs.toFixed(3),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-an',
      outPath,
    ]);
  }
}

function mux(video, mp3, outMp4) {
  run(ffmpeg, [
    '-y',
    '-i', video,
    '-i', mp3,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    '-movflags', '+faststart',
    outMp4,
  ]);
  const dur = probeDuration(outMp4);
  const mb = (fs.statSync(outMp4).size / (1024 * 1024)).toFixed(1);
  console.log(`OK ${path.basename(outMp4)} ${(dur / 60).toFixed(1)} min (${dur.toFixed(0)}s) ${mb} MB`);
}

async function main() {
  ensureSilentMp4();

  for (const [key, cfg] of Object.entries(scripts)) {
    const { mp3, secs } = await makeVoice(key, cfg);
    const fitted = path.join(workDir, `${key}_video.mp4`);
    fitVideoToAudio(secs + 0.4, fitted);
    mux(fitted, mp3, path.join(outDir, cfg.file));
  }

  const readme = path.join(outDir, 'README_LIVE_WALKTHROUGH.txt');
  fs.writeFileSync(
    readme,
    `SN-ERMS LIVE walkthrough videos (real UI + mouse cursor + Edge voice)
=======================================================================
Folder (absolute):
  ${outDir}

Files:
  SN-ERMS_Live_Walkthrough_English.mp4  — English voice (Neerja)
  SN-ERMS_Live_Walkthrough_Bangla.mp4   — বাংলা voice (Tanishaa)
  SN-ERMS_Live_Walkthrough_Hindi.mp4    — हिन्दी voice (Swara)
  SN-ERMS_Live_Walkthrough_Silent.webm  — silent live UI capture (source)

Length: about 5–8 minutes each (matches narration).

Rebuild:
  1) Start backend + client (npm run dev in both)
  2) node docs/record-live-walkthrough.mjs
  3) node docs/build-live-walkthrough-videos.mjs
`,
    'utf8',
  );

  console.log('Done →', outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
