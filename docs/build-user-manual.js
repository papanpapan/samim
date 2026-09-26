const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } = require('docx');

const outDir = path.join(__dirname, 'nacecary_photos_and_flowers_for_testing');
const outPath = path.join(outDir, 'SN-ERMS_User_Manual_Bangla.docx');
fs.mkdirSync(outDir, { recursive: true });

const font = 'Nirmala UI';

function h1(t) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text: t, bold: true, font, size: 32 })],
  });
}
function h2(t) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text: t, bold: true, font, size: 26 })],
  });
}
function p(t) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text: t, font, size: 22 })],
  });
}
function b(t) {
  return new Paragraph({
    spacing: { after: 60 },
    indent: { left: 360 },
    children: [new TextRun({ text: '•  ' + t, font, size: 22 })],
  });
}
function gap() {
  return new Paragraph({ children: [] });
}

const children = [
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: 'Saba Nursery ERMS', bold: true, font, size: 44 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: 'সম্পূর্ণ ব্যবহারকারী নির্দেশিকা', bold: true, font, size: 32 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: '(খুব সহজ ভাষায় — যে কেউ বুঝতে পারবেন)', font, size: 22, italics: true })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: 'SN-ERMS v3.0 · নার্সারি চালানোর সফটওয়্যার', font, size: 20 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: 'তারিখ: ' + new Date().toLocaleDateString('bn-BD'), font, size: 18 })],
  }),

  p('এই বই পড়ে আপনি কম্পিউটার বা ফোনে অ্যাপ খুলে নার্সারির কাজ করতে পারবেন। একবারে একটা ধাপ করুন। তাড়াহুড়ো করবেন না।'),

  h1('১) অ্যাপ কী?'),
  p('Saba Nursery ERMS (সংক্ষেপে SN-ERMS) হলো নার্সারির কাজ ও হিসাব রাখার অ্যাপ।'),
  b('মাদার প্ল্যান্ট (বড় গাছ) রাখা'),
  b('নতুন চারা তৈরি'),
  b('স্টক ও বিক্রি'),
  b('ক্যামেরা ও বিপদ সতর্কতা'),
  b('খরচ, রিপোর্ট, গাছের যত্ন'),
  p('সব এক জায়গায় থাকে। কাগজে আলাদা আলাদা হিসাব কম লাগে।'),

  h1('২) কীভাবে খুলবেন?'),
  h2('কম্পিউটারে'),
  b('Chrome বা Edge ব্রাউজার খুলুন।'),
  b('ঠিকানা লিখুন: https://localhost:5173'),
  b('সার্ভার বন্ধ থাকলে পাতা খুলবে না — যিনি সার্ভার চালান তাঁকে বলুন।'),
  h2('মোবাইল ফোনে'),
  b('ফোন ও কম্পিউটার একই Wi‑Fi বা হটস্পটে রাখুন।'),
  b('কম্পিউটারের IP দিয়ে খুলুন। উদাহরণ: https://10.x.x.x:5173'),
  b('সতর্কতা মেসেজ এলে Advanced চাপুন, তারপর Continue / Proceed।'),
  b('অ্যাড্রেস বার লুকাতে: Share → Add to Home Screen → হোম থেকে Saba ERMS খুলুন।'),

  h1('৩) লগইন (ঢোকা)'),
  p('প্রথম পাতায় দুটো জিনিস লাগে — ইমেইল আর পাসওয়ার্ড।'),
  b('ইমেইল বক্সে আপনার ইমেইল লিখুন।'),
  b('পাসওয়ার্ড বক্সে পাসওয়ার্ড লিখুন।'),
  b('চোখের আইকন চাপলে পাসওয়ার্ড দেখা যায়।'),
  b('Sign in / লগইন বোতাম চাপুন।'),
  p('ভুল হলে লাল মেসেজ আসবে। ঠিক হলে ভেতরের পাতা খুলবে।'),
  p('ডেমো / টেস্ট অ্যাকাউন্ট:'),
  b('admin@sabanursery.com   /   Admin@12345   (সব দেখতে পারে)'),
  b('manager@sabanursery.com   /   Manager@123'),
  b('staff@sabanursery.com   /   Staff@123'),
  b('cashier@sabanursery.com   /   Cashier@123'),
  p('বের হতে: উপরের ডানদিকে দরজার আইকন (Logout) চাপুন।'),

  h1('৪) উপরের বার (হেডার) কী কী?'),
  b('তিন দাগের মেনু — মোবাইলে বাম মেনু খোলে।'),
  b('← পিছনে আগের পাতা। → সামনে পরের পাতা।'),
  b('লগইন বা হোম পেজে ব্যাক দুইবার চাপলে জিজ্ঞেস করবে — বের হবেন কি না।'),
  b('ভাষা বোতাম — বাংলা বা ইংরেজি বেছে নিন।'),
  b('A আইকন — অক্ষর বড়/ছোট ও রঙের থিম।'),

  h1('৫) বাম মেনু — কোনটা কী কাজ?'),
  p('আপনার অনুমতি আছে শুধু সেই মেনু দেখাবে। না দেখলে সেই কাজ আপনার জন্য নয়।'),
  b('Dashboard — আজকের সারাংশ।'),
  b('My nursery — নার্সারির জায়গা (Place) ও ঠিকানা।'),
  b('Mother Plants — বড় মাদার গাছ।'),
  b('Propagation Hub — চারা তৈরির ব্যাচ।'),
  b('Plant Inventory — বিক্রির স্টক।'),
  b('Sales POS — কাউন্টারে বিক্রি।'),
  b('Vermicompost — কেঁচো সারের বেড।'),
  b('Care — গাছের যত্নের কাজ।'),
  b('Distribution — বুকিং ও পরিবহন।'),
  b('Accounts — টাকা ও লাভ-ক্ষতি।'),
  b('Admin — ইউজার তৈরি।'),
  b('Danger alerts — বিপদ অ্যালার্ট কেস।'),
  b('Voice desk — মুখে প্রশ্ন।'),
  b('Treatment — ওষুধ/স্প্রে রেকর্ড।'),
  b('Identify plant — পাতার ছবি দিয়ে গাছ চেনা।'),
  b('Nurseries — শুধু মালিক: নতুন নার্সারি যোগ।'),
  b('Live ক্যামেরা — কোণার/নিচের লাইভ বোতাম।'),

  h1('৬) ড্যাশবোর্ড'),
  p('লগইনের পর এখানে আসবেন। সংখ্যা দেখুন। কাজ করতে বাম মেনু থেকে অন্য পাতায় যান।'),

  h1('৭) আমার নার্সারি (Place)'),
  b('মেনু থেকে My nursery খুলুন।'),
  b('জায়গা (Place) যোগ বা দেখুন।'),
  b('ঠিকানা সেভ করুন।'),
  p('পরে ক্যামেরা ও স্টক কোন জায়গায় — সেটা এখান থেকেই আসে।'),

  h1('৮) Mother Plants (মাদার গাছ)'),
  h2('নতুন গাছ যোগ'),
  b('Add / নতুন বোতাম চাপুন।'),
  b('ট্যাগ নম্বর, জাতের নাম, লোকেশন লিখুন।'),
  b('ছবি যোগ: Choose file বা ক্যামেরা দিয়ে ছবি নিন।'),
  b('ভিডিও থাকলে আলাদা ভিডিও আপলোড করুন।'),
  b('Save চাপুন। সেভ হয়েছে কি না লিস্টে দেখুন।'),
  h2('ডেমো ফাইল কোথায়?'),
  p('কম্পিউটারে এই ফোল্ডার খুলুন:'),
  p('docs\\nacecary_photos_and_flowers_for_testing\\05_mother_plants'),
  b('ছবি = .jpg ফাইল'),
  b('ভিডিও = mother_demo.mp4'),

  h1('৯) Propagation (চারা তৈরি)'),
  b('Propagation Hub খুলুন।'),
  b('নতুন ব্যাচ — কোন মাদার থেকে, কতটা, কোন ধাপ।'),
  b('লেবেল/QR থাকলে দেখুন বা প্রিন্ট করুন।'),
  b('ডেমো: 06_propagation ফোল্ডার (batch_demo.mp4)।'),

  h1('১০) Inventory (স্টক)'),
  b('Plant Inventory খুলুন।'),
  b('বিক্রির গাছ এখানে থাকে।'),
  b('কোড/স্ক্যান দিয়ে খুঁজতে পারেন।'),
  b('ডেমো: 07_inventory_stock।'),
  p('স্টক শূন্য হলে বিক্রি হবে না — আগে স্টক দেখুন।'),

  h1('১১) Sales POS (কাউন্টার বিক্রি)'),
  b('Sales POS খুলুন।'),
  b('গাছ বেছে নিন বা স্ক্যান করুন → কার্টে যোগ।'),
  b('দাম ও সংখ্যা ঠিক আছে কি না দেখুন।'),
  b('পেমেন্ট শেষে সেল সম্পন্ন করুন।'),
  b('মার্কেটিং মিডিয়া: 08_pos_marketing।'),
  p('সতর্কতা: ভুল সেল সেভ করলে স্টক ভুল হবে। সেভের আগে দুইবার দেখুন।'),

  h1('১২) Vermicompost'),
  b('বেড যোগ করুন। অবস্থা/আর্দ্রতা লিখুন।'),
  b('ডেমো ছবি: 11_vermicompost।'),

  h1('১৩) Care (যত্ন)'),
  b('কোন গাছে কী কাজ — লিখে সেভ।'),
  b('কাজ শেষ হলে Done / সম্পন্ন চাপুন।'),
  b('ডেমো: 12_care_field।'),

  h1('১৪) Distribution'),
  b('বুকিং, পরিবহন, লিড এখানে।'),
  b('নতুন বুকিং → গন্তব্য ও মাল লিখে সেভ।'),

  h1('১৫) Accounts / Reports'),
  b('আয়-ব্যয় ও লাভ দেখা যায়।'),
  b('খরচ যোগ করতে ফর্ম পূরণ করে সেভ।'),
  p('সাধারণত ম্যানেজার/অ্যাডমিন দেখতে পারে।'),

  h1('১৬) Admin'),
  b('নতুন কর্মী যোগ: ইমেইল + পাসওয়ার্ড + রোল।'),
  b('রোল বলে দেয় কে কী মেনু দেখবে।'),

  h1('১৭) Danger alerts (বিপদ সতর্কতা)'),
  p('লাইভ ক্যামেরায় কেউ/কিছু ধরা পড়লে অ্যালার্ম বাজে। Stop alert চাপলে ছবি/ভিডিওসহ কেস সেভ হয়।'),
  b('Danger alerts মেনুতে সব কেস দেখুন।'),
  b('নার্সারি ও Place ফিল্টার দিয়ে খুঁজুন।'),
  b('Photo / Video চাপলে প্রমাণ বড় হয়।'),
  b('Share দিয়ে কেস লিঙ্ক পাঠানো যায়।'),
  b('ডেমো: 09_alerts_danger।'),
  p('শুধু সাইরেন বাজা = কেস হয় না। Stop alert (বা সময় শেষ) + প্রমাণ আপলোড হলে কেস আসে।'),

  h1('১৮) Live ক্যামেরা'),
  b('লাইভ বোতাম খুলুন।'),
  b('Place বেছে ক্যামেরা Start করুন (এক ফোনে এক ক্যামেরা)।'),
  b('ডিটেকশন চালু থাকলে মানুষ/প্রাণী দেখলে কণ্ঠ ও অ্যালার্ট বাজে।'),
  b('Stop alert চাপলে Danger alerts-এ কেস যায়।'),
  b('ডেমো দৃশ্য: 13_live_camera।'),

  h1('১৯) Voice desk'),
  b('লিখুন বা মাইকে বলুন। উদাহরণ: পেয়ারা কত স্টক?'),
  b('উত্তর স্ক্রিনে আসবে।'),

  h1('২০) Treatment ও Identify plant'),
  b('Treatment: ওষুধ/স্প্রে লিখে সেভ, পরে Done।'),
  b('Identify plant: পাতার ছবি তুলুন। অনুশীলনে 10_plant_id_leaves ফোল্ডার ব্যবহার করুন।'),

  h1('২১) Nurseries (শুধু প্ল্যাটফর্ম মালিক)'),
  b('নতুন নার্সারি যোগ, প্ল্যান/ফিচার চালু-বন্ধ।'),
  b('সাধারণ স্টাফ এই মেনু দেখবে না।'),

  h1('২২) ডেমো ছবি-ভিডিও ফোল্ডার'),
  p('সব ফাইল এখানে আছে:'),
  p('C:\\Project\\saba\\samim\\docs\\nacecary_photos_and_flowers_for_testing'),
  b('01_fruits — ফল'),
  b('02_flowers — ফুল'),
  b('03_indoor_plants — ঘরের গাছ'),
  b('04_outdoor_plants — বাইরের গাছ'),
  b('05_mother_plants — মাদার প্ল্যান্ট'),
  b('06_propagation — প্রোপাগেশন'),
  b('07_inventory_stock — স্টক'),
  b('08_pos_marketing — POS মার্কেটিং'),
  b('09_alerts_danger — অ্যালার্ট'),
  b('10_plant_id_leaves — পাতা চেনা'),
  b('11_vermicompost — কেঁচো সার'),
  b('12_care_field — যত্ন'),
  b('13_live_camera — লাইভ'),
  b('14_videos — সব ভিডিও একসাথে'),
  p('প্রতি ফোল্ডারের *_demo.mp4 দিয়ে ভিডিও আপলোড ডেমো করুন।'),

  h1('২৩) সমস্যা হলে'),
  b('পাতা খুলছে না → সার্ভার চালু? একই Wi‑Fi?'),
  b('লগইন হচ্ছে না → ইমেইল/পাসওয়ার্ড ঠিক? Caps Lock বন্ধ?'),
  b('ছবি উঠছে না → JPG/PNG ব্যবহার করুন; খুব বড় ফাইল নয়।'),
  b('ক্যামেরা খুলছে না → ব্রাউজারে ক্যামেরার অনুমতি দিন; HTTPS দিয়ে খুলুন।'),
  b('অ্যালার্ট লিস্ট খালি → Stop alert চেপেছেন? ফিল্টার “সব” আছে?'),
  b('স্টক ভুল → POS ও Inventory আবার চেক করুন।'),

  h1('২৪) সহজ নিয়ম'),
  b('এক কাজ → এক পাতা → Save চাপুন।'),
  b('সেভের আগে নাম, সংখ্যা, দাম দুইবার দেখুন।'),
  b('লাইভ নার্সারিতে স্টক/দাম নিয়ে খেলা করবেন না।'),
  b('কাজ শেষে Logout করুন।'),
  b('বুঝতে না পারলে এই ম্যানুয়াল হাতে নিয়ে অ্যাডমিনকে দেখান।'),

  gap(),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: '— শেষ —', bold: true, font, size: 22 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80 },
    children: [new TextRun({ text: 'Saba Nursery · SN-ERMS · সহজ ব্যবহারকারী নির্দেশিকা', font, size: 18 })],
  }),
];

const doc = new Document({
  styles: {
    default: {
      document: {
        styles: [{ id: 'Normal', run: { font, size: 22 } }],
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 720, bottom: 720, left: 720, right: 720 },
        },
      },
      children,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf);
  console.log('OK', outPath);
  console.log('KB', Math.round(buf.length / 1024));
});
